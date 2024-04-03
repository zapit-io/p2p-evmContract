// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "../shared/interfaces/IERC20.sol";
import {
  AppStorage,
  LibAppStorage,
  LibEvents,
  Modifiers,
  Escrow
} from "../shared/libraries/LibAppStorage.sol";
import { Signature } from "../shared/libraries/Signature.sol";


error NotAnOwner();
error ZeroAddress();
error CannotBeAContract();
error NotAnArbitrator();
error FeesOutOfRange();
error TradeExists();
error IncorrectEth();
error CurrencyNotWhitelisted(address _currency);
error IncorrectCurrencyAmount(address _currency);
error EscrowDoesNotExist();
error InvalidArbitratorSignature();
error InvalidSellerSignature();
error NotBuyer();
error AmountHigherThanAvailable();


/// @title Zapit P2P Escrows
/// @author Zapit
contract P2PEscrow is Modifiers {
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
	) external payable nonReentrant {
			AppStorage storage ds = LibAppStorage.diamondStorage();

			bytes32 trade = ds.extIdentifierToEscrow[_extUniqueIdentifier];

			// Check if the external identifier for the trade already exists.
			// This is a strick check for the externally provided information
			// to prevent duplicate trades that refer the same external identifier
			if (trade != bytes32(0)) {
					revert TradeExists();
			}

			bytes32 _tradeID = keccak256(
					abi.encodePacked(
							ds.escrowCounter++,
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

			// Check transaction value against passed _value and make sure it is not 0
			/**
				@description: value + seller fees = msg.value
				*/
			uint256 _sellerFees = (_value * ds.escrowFeeBP) / (10000 * 2);

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
	) external payable nonReentrant onlyWhitelistedCurrencies(_currency) {
			AppStorage storage ds = LibAppStorage.diamondStorage();
			bytes32 trade = ds.extIdentifierToEscrow[_extUniqueIdentifier];

			// Check if the external identifier for the trade already exists.
			// This is a strick check for the enternally provided information
			// to prevent duplicate trades that refer the same external identifier
			if (trade != bytes32(0)) {
					revert TradeExists();
			}

			bytes32 _tradeID = keccak256(
					abi.encodePacked(
							ds.escrowCounter++,
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

			// Add the escrow to the public mapping
			ds.escrows[_tradeID] = Escrow(
					_extUniqueIdentifier,
					payable(_buyer),
					payable(msg.sender),
					_currency,
					_value,
					block.number,
					ds.escrowFeeBP,
					true
			);
			ds.extIdentifierToEscrow[_extUniqueIdentifier] = _tradeID;

			/**
				@description value + seller fees = msg.value
				*/
			uint256 _sellerFees = (_value * ds.escrowFeeBP) / (10000 * 2);

			uint256 toTransfer = _value + _sellerFees;
			require(
					IERC20(_currency).balanceOf(address(this)) >= toTransfer,
					"Insufficient amount"
			);
			require(
					IERC20(_currency).transferFrom(msg.sender, address(this), _value),
					"Currency not approved"
			);

			emit LibEvents.Created(
					_tradeID,
					msg.sender,
					_buyer,
					_extUniqueIdentifier,
					_currency,
					_value,
					ds.escrowFeeBP
			);
	}

	/// @notice Called by the favourable party for whom the order has been resolved by the arbitrator
	/// @param _tradeID Escrow "tradeID" parameter
	/// @param _sig Signature from the party in favour of whom the dispute is resolved
	function claimDisputedOrder(
			bytes32 _tradeID,
			bytes memory _sig
	) external nonReentrant {
			AppStorage storage ds = LibAppStorage.diamondStorage();
			Escrow storage _escrow = ds.escrows[_tradeID];

			if (!_escrow.exists) {
					revert EscrowDoesNotExist();
			}

			// Concat a message out of the tradeID and the msg.sender
			bytes32 messageHash = Signature.getMessageHash(_tradeID, msg.sender);
			bytes32 signedMessageHash = Signature.getEthSignedMessageHash(messageHash);
			address _signatory = Signature.recoverSigner(signedMessageHash, _sig);

			if (_signatory != ds.arbitrator) {
					revert InvalidArbitratorSignature();
			}

			/**
				*   @notes
				* - disputed in favour of seller, no fees
				* - disputed in favour of buyer, fees will be there
				*/
			uint16 fee = msg.sender == _escrow.seller ? 0 : _escrow._fee;

			_escrow.exists = false;

			// transfer the funds to the msg.sender
			transferMinusFees(
					payable(msg.sender),
					_escrow.value,
					fee,
					false,
					address(0)
			);
			emit LibEvents.DisputeClaimed(_tradeID, msg.sender, _escrow._extUniqueIdentifier, _sig);
	}

	/// @notice Called by the seller or any one that has the access to signature for completing the order
	/// @param _tradeID Escrow "tradeID" parameter
	/// @param _sig Signature from seller
	function executeOrder(
			bytes32 _tradeID,
			bytes memory _sig
	) external nonReentrant {
			AppStorage storage ds = LibAppStorage.diamondStorage();
			Escrow storage _escrow = ds.escrows[_tradeID];

			if (!_escrow.exists) {
					revert EscrowDoesNotExist();
			}

			// concat a message out of the tradeID and the msg.sender
			bytes32 messageHash = Signature.getMessageHash(_tradeID, _escrow.buyer);
			bytes32 signedMessageHash = Signature.getEthSignedMessageHash(messageHash);
			address _signatory = Signature.recoverSigner(signedMessageHash, _sig);

			if (_signatory != _escrow.seller) {
					revert InvalidSellerSignature();
			}

			// transfer the funds to the msg.sender
			_escrow.exists = false;
			transferMinusFees(
					payable(_escrow.buyer),
					_escrow.value,
					_escrow._fee,
					false,
					address(0)
			);
			emit LibEvents.TradeCompleted(_tradeID, _escrow._extUniqueIdentifier, _sig);
	}

	///@notice Called buy the buyer to cancel the escrow and returning the funds to the seller
	///@param _tradeID Escrow "tradeID" parameter
	///@return bool
	function buyerCancel(
			bytes32 _tradeID
	) external nonReentrant returns (bool) {
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
			transferMinusFees(
					_escrow.seller,
					_escrow.value,
					ds.escrowFeeBP,
					false,
					address(0)
			);
			emit LibEvents.CancelledByBuyer(_tradeID, _escrow._extUniqueIdentifier);
			return true;
	}

	/// @notice Transfer the value of an escrow, minus the fees
	/// @param _to Recipient address
	/// @param _value Value of the transfer
	function transferMinusFees(
			address payable _to,
			uint256 _value,
			uint256 _fee,
			bool isErc20,
			address _currency
	) private {
			/**
				* @description: Here we are initializing the variables with an assumption that the transfer is for a good order as in completed
				*/
			uint256 _totalFees = (_value * _fee) / 10000; // total-fees
			uint256 _totalTransferValue = _value - _totalFees / 2; // buyer-side fees which is 50% of the _totalFees
			/**
				* @description: if the fee is 0 and the caller is the seller(i.e. msg.sender) then we don't charge any fee(s) on that escrow
				*/
			if (_fee == 0 && _to == msg.sender) {
					_totalFees = _totalFees / 2;
					_totalTransferValue = _value + _totalFees;
			} else {
					if (isErc20) {
							IERC20(_currency).transfer(s.feeAddress, _totalTransferValue);
					} else {
							payable(s.feeAddress).transfer(_totalFees);
					}
			}
			if (isErc20) {
					IERC20(_currency).transfer(_to, _totalTransferValue);
			} else {
					payable(_to).transfer(_totalTransferValue);
			}
	}

}
