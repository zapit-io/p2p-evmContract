// SPDX-License-Identifier: None
pragma solidity ^0.8.24;

import "../interfaces/IERC20.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibMeta} from "../libraries/LibMeta.sol";

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
error InvalidSignatureLength();
error AmountHigherThanAvailable();

struct Escrow {
    // External identifier that references the escrow;
    bytes32 _extUniqueIdentifier;
    // Address of the buyer
    address payable buyer;
    // Address of the seller
    address payable seller;
    // Currency address, address(0) if it's Native currency
    address currency;
    // Value of the escrow
    uint256 value;
    // The timestamp when the escrow was created
    uint256 createdAt;
    // Fees based on bps
    uint16 _fee;
    // To check if the escrow exists
    bool exists;
}

struct AppStorage {
  // Address of the arbitrator
  address arbitrator;
  
  // Address of the owner (who can withdraw collected fees)
  address owner;

  // Address that gets the fee for each order
  address feeAddress;

  // Fee Basis Points: fees for owner inclusive of bases points
  uint16 escrowFeeBP;

  // Cumulative balance of collected fees
  uint256 feesAvailableForWithdraw;
  // Cumulative balance for collected fees for erc20 tokens
  mapping(address => uint256) feesAvailableForWithdrawErc20;

  // List of whitelisted ERC20 tokens for escrow
  mapping(address => bool) whitelistedCurrencies;

  // External identifier to escrow mapping (external identifier could be a trade id)
  mapping(bytes32 => bytes32) extIdentifierToEscrow;

  // Counter of escrows, this counter gets incremented by 1 each time a new escrow is created
  uint256 escrowCounter;

  // Mapping of active trades. The key here is a hash of the trade properties
  mapping(bytes32 => Escrow) escrows;
}

library LibAppStorage {
  function diamondStorage() internal pure returns (AppStorage storage ds) {
    assembly {
      ds.slot := 0
    }
  }
}

library LibEvents {
  /// @notice Event: Created, triggered when the escrow is created by the seller
  /// @param _tradeHash               Hash of the escrow
  /// @param _seller                  Seller address of the escrow
  /// @param _buyer                   Buyer address of the escrow
  /// @param _extUniqueIdentifier     External identifier that references the escrow
  /// @param _currency                Currency of the order, native or ERC20
  /// @param _value                   Value of the trade either in native currency or ERC20 token (Excluding fee)
  /// @param _escrowFeeBP             The contract level fee setting of the time when trade was created
  event Created(
      bytes32 indexed _tradeHash,
      address indexed _seller,
      address indexed _buyer,
      bytes32 _extUniqueIdentifier,
      address _currency,
      uint256 _value,
      uint16 _escrowFeeBP
  );

  /// @notice Event: CancelledByBuyer, triggered when the trade is cancelled by the buyer
  /// @param _tradeHash               Hash of the escrow
  /// @param _extUniqueIdentifier     External identifier that references the escrow
  event CancelledByBuyer(
      bytes32 indexed _tradeHash,
      bytes32 indexed _extUniqueIdentifier
  );

  /// @notice Event: DisputeClaimed, triggered when the disputed trade is resolved with the help of arbitrator
  /// and the winning party claims the funds
  /// @param _tradeHash               Hash of the escrow
  /// @param _favourOf                Address of the party in favour of whom the dispute is resolved
  /// @param _extUniqueIdentifier     External identifier that references the escrow
  /// @param _signature               Signature of the arbitrator
  event DisputeClaimed(
      bytes32 indexed _tradeHash,
      address indexed _favourOf,
      bytes32 indexed _extUniqueIdentifier,
      bytes _signature
  );

  /// @notice Event: TradeCompleted, triggered when the trade is successfully completed
  /// @param _tradeHash               Hash of the escrow
  /// @param _extUniqueIdentifier     External identifier that references the escrow
  /// @param _signature               Signature of the seller
  event TradeCompleted(
      bytes32 indexed _tradeHash,
      bytes32 indexed _extUniqueIdentifier,
      bytes _signature
  );

  /// @notice Event: ArbitratorChanged, triggered when arbitrator is changed
  /// @param _newArbitrator           Address of the new arbitrator
  event ArbitratorChanged(address indexed _newArbitrator);

  /// @notice Event: OwnerChanged, triggered when owner is changed
  /// @param _newOwner                Address of the new owner
  event OwnerChanged(address indexed _newOwner);

  /// @notice Event: FeesChanged, triggered when escrowFeeBP is changed
  /// @param _newFees                 New fee with basis points
  event FeesChanged(uint16 indexed _newFees);

  /// @notice Event: FeeAddressChanged, triggered when fee address is changed
  /// @param _feeAddress           Address of the new fee address
  event FeeAddressChanged(address indexed _feeAddress);

  /**
   * @dev Emitted when the pause is triggered by `account` i.e the owner of the contracts.
   */
  event Paused(address account);

  /**
   * @dev Emitted when the pause is lifted by `account` i.e the owner of the contracts.
   */
  event Unpaused(address account);
}

/**
 * @dev Library and storage for maintaining reentrancy guard functionality in the protocol
 */
library ReentrancyGuardStorage {
  struct Layout {
    uint256 _status;
  }

  bytes32 internal constant STORAGE_SLOT = keccak256("zapit.contracts.storage.reentrancyGuard");

  function layout() internal pure returns (Layout storage l) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      l.slot := slot
    }
  }
}

/**
 * @dev Library and storage for maintaining pausable functionality in the protocol
 */
library PausableStorage {
  struct Layout {
    bool _paused;
  }

  bytes32 internal constant STORAGE_SLOT = keccak256("zapit.contracts.storage.Pausable");

  function layout() internal pure returns (Layout storage l) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      l.slot := slot
    }
  }
}

/**
 * @dev Library and storage for maintaining modifiers and internal core functionalities
 */
contract Modifiers {
  using ReentrancyGuardStorage for ReentrancyGuardStorage.Layout;
  using PausableStorage for PausableStorage.Layout;

  AppStorage internal s;
  uint256 private constant _NOT_ENTERED = 1;
  uint256 private constant _ENTERED = 2;

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    LibDiamond.enforceIsContractOwner();
    _;
  }

  /**
   * @dev Prevents from re-entrancy attacks
   */
  modifier nonReentrant() {
    // On the first call to nonReentrant, _notEntered will be true
    require(ReentrancyGuardStorage.layout()._status != _ENTERED, "ReentrancyGuard: reentrant call");

    // Any calls to nonReentrant after this point will fail
    ReentrancyGuardStorage.layout()._status = _ENTERED;

    _;

    // By storing the original value once again, a refund is triggered (see
    // https://eips.ethereum.org/EIPS/eip-2200)
    ReentrancyGuardStorage.layout()._status = _NOT_ENTERED;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    bool _isPaused = PausableStorage.layout()._paused;
    require(!_isPaused, "Pausable: paused");
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    bool _isPaused = PausableStorage.layout()._paused;
    require(_isPaused, "Pausable: not paused");
    _;
  }

      // Modifier for restricting a zero address
    modifier nonZeroAddress(address _address) {
        if (_address == address(0)) {
            revert ZeroAddress();
        }
        _;
    }

    // Modifier for restricting the address to be a non-contract address
    modifier nonContract(address _address) {
        uint256 size;
        assembly {
            size := extcodesize(_address)
        }
        if (size > 0) {
            revert CannotBeAContract();
        }

        if(msg.sender != tx.origin){
            revert CannotBeAContract();
        }
        _;
    }

    // Modifier for restricting only accepted currencies
    modifier onlyWhitelistedCurrencies(address _address) {
        // check if the token is accepted
        if (!s.whitelistedCurrencies[_address]) {
            revert CurrencyNotWhitelisted(_address);
        }
        _;
    }

    // Modifier for checking the address is arbitrator
    modifier onlyArbitrator() {
        if (msg.sender != s.arbitrator) {
            revert NotAnArbitrator();
        }
        _;
    }
}
