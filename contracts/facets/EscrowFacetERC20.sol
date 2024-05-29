// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "../shared/interfaces/IERC20.sol";
import { AppStorage, LibAppStorage, LibEvents, Modifiers, Escrow, TradeExists, IncorrectEth, EscrowDoesNotExist, TradeWithSelf, ExtUniqueIdentifierExists, InvalidArbitratorSignature, InvalidSellerSignature, NotBuyer } from "../shared/libraries/LibAppStorage.sol";
import { SignatureFacet } from "../shared/facets/SignatureFacet.sol";

/// @title Zapit P2P Escrows
/// @author Zapit
contract EscrowFacetERC20 is Modifiers, SignatureFacet {
  /***********************
	+   User-Functions   +
	***********************/

  /// @notice Create and fund a new escrow for ERC20 token.
  /// @param _buyer The buying party
  /// @param _value The amount of the escrow, exclusive of the fee
  /// @param _currency The address of the currency to be used for the escrow
  /// @param _extUniqueIdentifier The external unique identifier, could be hash of the escrow
  function createEscrowERC20(
    address _buyer,
    uint256 _value,
    address _currency,
    bytes32 _extUniqueIdentifier
  )
    external
    payable
    nonReentrant
    nonContract
    onlyWhitelistedCurrencies(_currency)
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

    // checking if the trade already exists
    if (ds.escrows[_tradeID].exists) {
      revert TradeExists();
    }

    /**
     * @description value + seller fees = msg.value
     */
    uint256 _sellerFees = (_value * ds.escrowFeeBP) / (10000 * 2);

    uint256 toTransfer = _value + _sellerFees;
    require(
      IERC20(_currency).balanceOf(address(this)) >= toTransfer,
      "Insufficient amount"
    );
    require(
      IERC20(_currency).transferFrom(msg.sender, address(this), toTransfer),
      "Currency not approved"
    );

    // To prevent stack too deep.
    uint256 value = _value;

    // Add the escrow to the public mapping
    ds.escrows[_tradeID] = Escrow(
      _extUniqueIdentifier,
      payable(_buyer),
      payable(msg.sender),
      _currency,
      value,
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
      _currency,
      value,
      ds.escrowFeeBP
    );
  }

  /// @notice Called by the favourable party for whom the order has been resolved by the arbitrator
  /// @param _tradeID Escrow "tradeID" parameter
  /// @param _sig Signature from the arbiter, signing TradeID + address of the party that is getting the
  /// dispute resolved in their favour
  function claimDisputedOrderERC20(
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
      IERC20(_escrow.currency).transfer(
        _escrow.seller,
        _escrow.value + _tradeFeeAmount
      );
    } else {
      // If it is resolved in favour of the buyer then this is a 'completed' trade and we charge a fee
      IERC20(_escrow.currency).transfer(
        _escrow.buyer,
        _escrow.value - _tradeFeeAmount
      );
      // Transfer the fee to fee address
      IERC20(_escrow.currency).transfer(s.feeAddress, _tradeFeeAmount * 2);
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

    if (_signatory != _escrow.seller) {
      revert InvalidSellerSignature();
    }

    // transfer the funds to the msg.sender
    _escrow.exists = false;

    // Gather the fee that is supposed to be transferred when the buyer executes/completes the order.
    // Since the seller already funded the escrow the value added to the escrow was value + sellerFee
    // So the amount to be transferred to the buyer should be value - buyer fee
    uint256 _tradeFeeAmount = (_escrow.value * _escrow.fee) / (10000 * 2);
    uint256 _totalTransferValue = _escrow.value - _tradeFeeAmount;

    IERC20(_escrow.currency).transfer(_escrow.buyer, _totalTransferValue);
    // Half the fee is paid by the buyer and half is paid by the seller
    IERC20(_escrow.currency).transfer(s.feeAddress, _tradeFeeAmount * 2);

    emit LibEvents.TradeCompleted(_tradeID, _escrow.extUniqueIdentifier, _sig);
  }

  ///@notice Called buy the buyer to cancel the escrow and returning the funds to the seller
  ///@param _tradeID Escrow "tradeID" parameter
  function buyerCancelERC20(
    bytes32 _tradeID
  ) external nonReentrant nonContract {
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
    IERC20(_escrow.currency).transfer(_escrow.seller, _totalTransferValue);

    emit LibEvents.CancelledByBuyer(_tradeID, _escrow.extUniqueIdentifier);
  }
}
