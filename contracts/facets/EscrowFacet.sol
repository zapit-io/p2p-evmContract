// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
import "../shared/interfaces/IERC20.sol";
import { AppStorage, Escrow, EscrowDoesNotExist, ExtUniqueIdentifierExists, IncorrectEth, InvalidArbitratorSignature, InvalidSellerSignature, LibAppStorage, LibEvents, Modifiers, NotBuyer, TradeExists, TradeWithSelf } from "../shared/libraries/LibAppStorage.sol";
import { SignatureFacet } from "../shared/facets/SignatureFacet.sol";

/// @title Zapit P2P Escrows
/// @author Zapit
contract EscrowFacet is Modifiers, SignatureFacet {
  /***********************
	+   User-Functions   +
	***********************/

  /// @notice Create and fund a new escrow.
  /// @param _buyer The buying party
  /// @param _value The amount of the escrow, exclusive of the fee
  /// @param _extUniqueIdentifier The external unique identifier, could be hash of the escrow
  function createEscrowNative(
    address _buyer,
    uint256 _value,
    bytes32 _extUniqueIdentifier
  )
    external
    payable
    nonReentrant
    nonContract
    onlyWhitelistedCurrencies(address(0))
  {
    AppStorage storage ds = LibAppStorage.diamondStorage();
    bytes32 trade = ds.extIdentifierToEscrow[_extUniqueIdentifier];

    // Check if the external identifier for the trade already exists.
    // This is a strick check for the externally provided information
    // to prevent duplicate trades that refer the same external identifier
    if (trade != bytes32(0)) {
      revert ExtUniqueIdentifierExists();
    }

    // Cannot trade with self
    if (msg.sender == _buyer) {
      revert TradeWithSelf();
    }

    bytes32 _tradeID = keccak256(
      abi.encodePacked(
        ds.escrowCounter++, // Counter keeps on increasing to maintain uniqueness
        msg.sender,
        _buyer,
        _value,
        _extUniqueIdentifier
      )
    );

    // Checking if the trade already exists
    if (ds.escrows[_tradeID].exists) {
      revert TradeExists();
    }

    // Check transaction value against passed _value and make sure it is not 0
    /**
     * @description: value + seller fees = msg.value
     */
    uint256 _sellerFees = (_value * ds.escrowFeeBP) / (10000 * 2);

    // The value send should be equal to the value of the trade + the seller fee
    if (msg.value == 0 || msg.value != (_value + _sellerFees)) {
      revert IncorrectEth();
    }

    // Add the escrow to the public mapping
    ds.escrows[_tradeID] = Escrow(
      _extUniqueIdentifier,
      payable(_buyer),
      payable(msg.sender),
      address(0),
      _value,
      block.number,
      ds.escrowFeeBP,
      true
    );

    // Store the unique identifier key and map it to trade ID.
    ds.extIdentifierToEscrow[_extUniqueIdentifier] = _tradeID;
    emit LibEvents.Created(
      _tradeID,
      msg.sender,
      _buyer,
      _extUniqueIdentifier,
      address(0),
      _value,
      ds.escrowFeeBP
    );
  }

  /// @notice Called by the favourable party for whom the order has been resolved by the arbitrator.
  /// @param _tradeID Escrow "tradeID" parameter
  /// @param _sig Signature from the arbiter, signing TradeID + address of the party that is getting the
  /// dispute resolved in their favour
  function claimDisputedOrder(
    bytes32 _tradeID,
    bytes memory _sig
  ) external nonReentrant nonContract {
    AppStorage storage ds = LibAppStorage.diamondStorage();
    Escrow storage _escrow = ds.escrows[_tradeID];

    if (!_escrow.exists) {
      revert EscrowDoesNotExist();
    }

    // Concat a message out of the tradeID and the msg.sender
    bytes32 messageHash = getMessageHash(_tradeID, msg.sender);
    bytes32 signedMessageHash = getEthSignedMessageHash(messageHash);
    address _signatory = recoverSigner(signedMessageHash, _sig);

    // @notice: The provided signature should be from the arbitrator,
    // enabling the party whose dispute was resolved in their favor to claim it.
    if (_signatory != ds.arbitrator) {
      revert InvalidArbitratorSignature();
    }

    // Set the value of escrow exists to false
    _escrow.exists = false;

    /**
     *   @notes
     * - disputed in favour of seller, no fees
     * - disputed in favour of buyer, fees will be there
     */
    uint256 _tradeFeeAmount = (_escrow.value * _escrow.fee) / (10000 * 2);

    // If the seller is claiming the funds then transfer the entire amount including the fee paid earlier
    if (msg.sender == _escrow.seller) {
      (bool success, ) = _escrow.seller.call{
        value: _escrow.value + _tradeFeeAmount
      }("");
      require(success, "Transfer failed");
    } else {
      // If it is resolved in favour of the buyer then this is a 'completed' trade and we charge a fee
      (bool buyerSuccess, ) = _escrow.buyer.call{
        value: _escrow.value - _tradeFeeAmount
      }("");
      require(buyerSuccess, "Transfer to buyer failed");

      (bool feeSuccess, ) = s.feeAddress.call{ value: _tradeFeeAmount * 2 }("");
      require(feeSuccess, "Transfer of fees failed");
    }

    emit LibEvents.DisputeClaimed(
      _tradeID,
      msg.sender,
      _escrow.extUniqueIdentifier,
      _sig
    );
  }

  /// @notice Called by the seller or any one that has the access to signature for completing the order
  /// @param _tradeID Escrow "tradeID" parameter
  /// @param _sig Signature from seller
  function executeOrder(
    bytes32 _tradeID,
    bytes memory _sig
  ) external nonReentrant nonContract {
    AppStorage storage ds = LibAppStorage.diamondStorage();
    Escrow storage _escrow = ds.escrows[_tradeID];

    if (!_escrow.exists) {
      revert EscrowDoesNotExist();
    }

    // concat a message out of the tradeID and the msg.sender
    bytes32 messageHash = getMessageHash(_tradeID, _escrow.buyer);

    bytes32 signedMessageHash = getEthSignedMessageHash(messageHash);
    address _signatory = recoverSigner(signedMessageHash, _sig);

    // The signature provided must be from the seller
    if (_signatory != _escrow.seller) {
      revert InvalidSellerSignature();
    }

    // Mark the escrow exists as false.
    _escrow.exists = false;

    // Gather the fee that is supposed to be transferred when the buyer executes/completes the order.
    // Since the seller already funded the escrow the value added to the escrow was value + sellerFee
    // So the amount to be transferred to the buyer should be value - buyer fee
    uint256 _buyerFees = (_escrow.value * _escrow.fee) / (10000 * 2);
    uint256 _totalTransferValue = _escrow.value - _buyerFees;
    (bool buyerSuccess, ) = _escrow.buyer.call{ value: _totalTransferValue }(
      ""
    );
    require(buyerSuccess, "Transfer to buyer failed");

    (bool feeSuccess, ) = s.feeAddress.call{ value: _buyerFees * 2 }("");
    require(feeSuccess, "Transfer of fees failed");

    emit LibEvents.TradeCompleted(_tradeID, _escrow.extUniqueIdentifier, _sig);
  }

  ///@notice Called by the buyer to cancel the escrow and returning the funds to the seller
  ///@param _tradeID Escrow "tradeID" parameter
  function buyerCancel(bytes32 _tradeID) external nonReentrant nonContract {
    AppStorage storage ds = LibAppStorage.diamondStorage();
    Escrow storage _escrow = ds.escrows[_tradeID];

    if (!_escrow.exists) {
      revert EscrowDoesNotExist();
    }
    if (msg.sender != _escrow.buyer) {
      revert NotBuyer();
    }

    // Set the escrow exists to false
    _escrow.exists = false;

    // Gather the fee that is supposed to be transferred when the buyer cancels the order
    // Since the seller already funded the escrow the value added to the escrow was value + sellerFee
    // So the amount to be transferred back to the seller should be value + seller fee
    uint256 _sellerFees = (_escrow.value * _escrow.fee) / (10000 * 2);
    uint256 _totalTransferValue = _escrow.value + _sellerFees;
    (bool success, ) = _escrow.seller.call{ value: _totalTransferValue }("");
    require(success, "Transfer to seller failed");

    emit LibEvents.CancelledByBuyer(_tradeID, _escrow.extUniqueIdentifier);
  }
}
