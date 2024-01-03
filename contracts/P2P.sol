// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Zapit P2P Escrows
/// @author Zapit
contract P2PEscrow is ReentrancyGuard {
    /***********************
    +   Global settings   +
    ***********************/

    struct Escrow {
        // Address of the buyer
        address payable buyer;
        // Address of the seller
        address payable seller;
        // Currency address, address(0) if it's Native currency
        address currency;
        // The timestamp when the escrow was created
        uint256 createdAt;
        // Value of the escrow
        uint256 value;
        // Fees based on bps
        uint16 _fee;
        // To check if the escrow exists
        bool exists;
    }

    // Address of the arbitrator
    address public arbitrator;
    // Address of the owner (who can withdraw collected fees)
    address public owner;
    
    // Fee Basis Points: fees for owner inclusive of bases points
    uint16 public escrowFeeBP;

    // Cumulative balance of collected fees
    uint256 public feesAvailableForWithdraw;
    // Cumulative balance for collected fees for erc20 tokens
    mapping(address => uint256) public feesAvailableForWithdrawErc20;

    // List of accepted ERC20 tokens for escrow
    mapping(address => bool) public acceptedCurrencies;

    // External identifier to escrow mapping (external identifier could be a trade id)
    mapping(bytes32 => bytes32) public extIdentifierToEscrow;

    // Counter of escrows, this counter gets incremented by 1 each time a new escrow is created
    uint256 private escrowCounter;

    // Mapping of active trades. The key here is a hash of the trade properties
    mapping(bytes32 => Escrow) public escrows;

    /***********************
    +  Custom Errors  +
    ***********************/

    error NotAnOwner();
    error ZeroAddress();
    error CannotBeAContract();
    error NotAnArbitrator();
    error FeesOutOfRange();
    error TradeExists();
    error IncorrectEth();
    error CurrencyNotAccepted(address _currency);
    error IncorrectCurrencyAmount(address _currency);
    error EscrowDoesNotExist();
    error InvalidArbitratorSignature();
    error InvalidSellerSignature();
    error NotABuyer();
    error InvalidSignatureLength();
    error AmountHigherThanAvailable();

    /***********************
    +       Events        +
    ***********************/

    /// @notice Event: Created, triggered when the escrow is created by the seller
    /// @param _tradeHash               Hash of the escrow
    /// @param _seller                  Seller address of the escrow
    /// @param _buyer                   Buyer address of the escrow 
    /// @param _value                   Value of the trade either in native currency or ERC20 token (Excluding fee)
    /// @param _escrowFeeBP             The contract level fee setting of the time when trade was created
    /// @param _extUniqueIdentifier     External identifier that references the escrow
    event Created(
        bytes32 indexed _tradeHash,
        address indexed _seller,
        address indexed _buyer,
        uint256 _value,
        uint16 _escrowFeeBP,
        bytes32 _extUniqueIdentifier
    );

    /// @notice Event: CancelledByBuyer, triggered when the trade is cancelled by the buyer
    /// @param _tradeHash               Hash of the escrow
    event CancelledByBuyer(bytes32 indexed _tradeHash);

    /// @notice Event: DisputeClaimed, triggered when the disputed trade is resolved with the help of arbitrator
    /// and the winning party claims the funds
    /// @param _tradeHash               Hash of the escrow
    event DisputeClaimed(bytes32 indexed _tradeHash);

    /// @notice Event: TradeCompleted, triggered when the trade is successfully completed
    /// @param _tradeHash               Hash of the escrow
    event TradeCompleted(bytes32 indexed _tradeHash);

    /// @notice Event: ArbitratorChanged, triggered when arbitrator is changed
    /// @param _newArbitrator           Address of the new arbitrator
    event ArbitratorChanged(address indexed _newArbitrator);

    /// @notice Event: OwnerChanged, triggered when owner is changed
    /// @param _newOwner                Address of the new owner
    event OwnerChanged(address indexed _newOwner);

    /// @notice Event: FeesChanged, triggered when escrowFeeBP is changed
    /// @param _newFees                 New fee with basis points
    event FeesChanged(uint16 indexed _newFees);

    /// @notice Event: FeeWithdrawn, triggered when fee is withdrawn
    /// @param _to                      The address to which the fee has gone to
    /// @param _currency                Native or token currency withdrawn
    /// @param _amount                  Amount that is withdrawn
    event FeeWithdrawn(
        address indexed _to,
        address indexed _currency,
        uint256 _amount
    );

    /***************************
    +       Modifiers        +
    ****************************/

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
        _;
    }

    // Modifier for restricting only accepted currencies
    modifier onlyAcceptedCurrencies(address _address) {
        // check if the token is accepted
        if (!acceptedCurrencies[_address]) {
            revert CurrencyNotAccepted(_address);
        }
        _;
    }

    // Modifier for checking the address is owner of the contract
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotAnOwner();
        }
        _;
    }

    // Modifier for checking the address is arbitrator
    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) {
            revert NotAnArbitrator();
        }
        _;
    }

    /// @notice Initialize the contract.
    constructor(uint16 _escrowFeeBP) {
        owner = msg.sender;
        arbitrator = msg.sender;
        if (_escrowFeeBP > 10000) {
            revert FeesOutOfRange();
        }
        escrowFeeBP = _escrowFeeBP; // stored in terms of basis-points
    }

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
        bytes32 trade = extIdentifierToEscrow[_extUniqueIdentifier];

        // Check if the external identifier for the trade already exists.
        // This is a strick check for the enternally provided information
        // to prevent duplicate trades that refer the same external identifier
        if (trade != bytes32(0)) {
            revert TradeExists();
        }

        bytes32 _tradeID = keccak256(
            abi.encodePacked(
                escrowCounter++,
                msg.sender,
                _buyer,
                _value,
                _extUniqueIdentifier
            )
        );

        // checking if the trade already exists
        if (escrows[_tradeID].exists) {
            revert TradeExists();
        }

        // Check transaction value against passed _value and make sure it is not 0
        /**
         @description: value + seller fees = msg.value
         */
        uint256 _sellerFees = (_value * escrowFeeBP) / (10000 * 2);

        if (msg.value == 0 || msg.value != (_value + _sellerFees)) {
            revert IncorrectEth();
        }

        // Add the escrow to the public mapping
        escrows[_tradeID] = Escrow(
            payable(_buyer),
            payable(msg.sender),
            address(0),
            block.number,
            _value,
            escrowFeeBP,
            true
        );
        extIdentifierToEscrow[_extUniqueIdentifier] = _tradeID;
        emit Created(
            _tradeID,
            msg.sender,
            _buyer,
            _value,
            escrowFeeBP,
            _extUniqueIdentifier
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
    ) external payable nonReentrant onlyAcceptedCurrencies(_currency) {
        bytes32 trade = extIdentifierToEscrow[_extUniqueIdentifier];

        // Check if the external identifier for the trade already exists.
        // This is a strick check for the enternally provided information
        // to prevent duplicate trades that refer the same external identifier
        if (trade != bytes32(0)) {
            revert TradeExists();
        }

        bytes32 _tradeID = keccak256(
            abi.encodePacked(
                escrowCounter++,
                msg.sender,
                _buyer,
                _value,
                _extUniqueIdentifier
            )
        );

        // checking if the trade already exists
        if (escrows[_tradeID].exists) {
            revert TradeExists();
        }

        // Add the escrow to the public mapping
        escrows[_tradeID] = Escrow(
            payable(_buyer),
            payable(msg.sender),
            _currency,
            block.number,
            _value,
            escrowFeeBP,
            true
        );
        extIdentifierToEscrow[_extUniqueIdentifier] = _tradeID;

        /**
          @description value + seller fees = msg.value
         */
        uint256 _sellerFees = (_value * escrowFeeBP) / (10000 * 2);

        uint256 toTransfer = _value + _sellerFees;
        require(IERC20(_currency).balanceOf(address(this)) >= toTransfer, "Insufficient amount");
        require(
            IERC20(_currency).transferFrom(msg.sender, address(this), _value),
            "Currency not approved"
        );

        emit Created(
            _tradeID,
            msg.sender,
            _buyer,
            _value,
            escrowFeeBP,
            _extUniqueIdentifier
        );
    }

    /// @notice Called by the favourable party for whom the order has been resolved by the arbitrator
    /// @param _tradeID Escrow "tradeID" parameter
    /// @param _sig Signature from either party
    function claimDisputedOrder(
        bytes32 _tradeID,
        bytes memory _sig
    ) external nonReentrant {
        Escrow storage _escrow = escrows[_tradeID];

        if (!_escrow.exists) {
            revert EscrowDoesNotExist();
        }

        // Concat a message out of the tradeID and the msg.sender
        bytes32 messageHash = getMessageHash(_tradeID, msg.sender);
        bytes32 signedMessageHash = getEthSignedMessageHash(messageHash);
        address _signatory = recoverSigner(signedMessageHash, _sig);

        if (_signatory != arbitrator) {
            revert InvalidArbitratorSignature();
        }

        /**
         *   @notes
         * - disputed in favour of seller, no fees
         * - disputed in favour of buyer, fees will be there
         */
        uint16 fee = msg.sender == _escrow.seller ? 0 : _escrow._fee;

        // transfer the funds to the msg.sender
        _escrow.exists = false;
        transferMinusFees(
            payable(msg.sender),
            _escrow.value,
            fee,
            false,
            address(0)
        );
        emit DisputeClaimed(_tradeID);
    }

    /// @notice Called by the seller for completing the order
    /// @param _tradeID Escrow "tradeID" parameter
    /// @param _recipient Recipient address
    /// @param _sig Signature from either party
    function executeOrder(
        bytes32 _tradeID,
        address _recipient,
        bytes memory _sig
    ) external nonReentrant {
        Escrow storage _escrow = escrows[_tradeID];

        if (!_escrow.exists) {
            revert EscrowDoesNotExist();
        }

        // concat a message out of the tradeID and the msg.sender
        bytes32 messageHash = getMessageHash(_tradeID, _recipient);
        bytes32 signedMessageHash = getEthSignedMessageHash(messageHash);
        address _address = recoverSigner(signedMessageHash, _sig);

        if (_address != _escrow.seller) {
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
        emit TradeCompleted(_tradeID);
    }

    ///@notice Called buy the buyer to cancel the escrow and returning the funds to the seller
    ///@param _tradeID Escrow "tradeID" parameter
    ///@return bool

    function buyerCancel(bytes32 _tradeID) external nonReentrant returns (bool) {
        return _buyerCancel(_tradeID);
    }

    /***********************
    +   Util-Functions   +
    ***********************/

    /// @notice Getting a message-hash
    /// @param _message Message that was signed
    /// @param recipient Recipient address
    /// @return bytes32 Message hash
    function getMessageHash(
        bytes32 _message,
        address recipient
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_message, recipient));
    }

    /// @notice Creating the signed message hash of a message-hash
    /// @param _messageHash Message hash
    function getEthSignedMessageHash(
        bytes32 _messageHash
    ) public pure returns (bytes32) {
        /*
        Signature is produced by signing a keccak256 hash with the following format:
        "\x19Ethereum Signed Message\n" + len(msg) + msg
        */
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
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
         * @description: here we are initializing the variables with an assumption that the transfer is for a good order as in completed
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
                feesAvailableForWithdrawErc20[_currency] += _totalFees;
            } else {
                feesAvailableForWithdraw += _totalFees;
            }
        }
        if (isErc20) {
            IERC20(_currency).transfer(_to, _totalTransferValue);
        } else {
            payable(_to).transfer(_totalTransferValue);
        }
    }

    /// @notice Cancels the trade and returns the ETH to the seller. Can only be called the buyer.
    /// @param _tradeID Escrow "tradeID" parameter
    /// @return bool
    function _buyerCancel(bytes32 _tradeID) private returns (bool) {
        Escrow storage _escrow = escrows[_tradeID];

        if (!_escrow.exists) {
            revert EscrowDoesNotExist();
        }
        if (msg.sender != _escrow.buyer) {
            revert NotABuyer();
        }

        emit CancelledByBuyer(_tradeID);
        transferMinusFees(
            _escrow.seller,
            _escrow.value,
            escrowFeeBP,
            false,
            address(0)
        );
        return true;
    }

    /// @notice Recover the address of the signer of a message.
    /// @param _ethSignedMessageHash The hash of the signed message
    /// @return address
    function recoverSigner(
        bytes32 _ethSignedMessageHash,
        bytes memory _signature
    ) public pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(
        bytes memory sig
    ) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        if (sig.length != 65) {
            revert InvalidSignatureLength();
        }

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    /***********************
    +   Admin-Functions   +
    ***********************/

    /// @notice Withdraw fees collected by the contract. Only the owner can call this.
    /// @param _to Address to withdraw fees in to
    /// @param _amount Amount to withdraw
    /// @param _currency Address of the token
    function withdrawFees(
        address payable _to,
        uint256 _amount,
        address _currency
    ) external onlyOwner nonReentrant {
        // This check also prevents underflow
        if (_amount > feesAvailableForWithdraw) {
            revert AmountHigherThanAvailable();
        }

        if (_currency != address(0)) {
            if (_amount > feesAvailableForWithdrawErc20[_currency]) {
                revert AmountHigherThanAvailable();
            }
            feesAvailableForWithdrawErc20[_currency] -= _amount;
            IERC20(_currency).transfer(_to, _amount);
        } else {
            feesAvailableForWithdraw -= _amount;
            payable(_to).transfer(_amount);
        }
        emit FeeWithdrawn(_to, _currency, _amount);
    }

    ///@notice Setting the accepted currencies for escrow
    ///@param _currency Address of the currency
    function setAcceptedCurrencies(address _currency) external onlyOwner {
        acceptedCurrencies[_currency] = !acceptedCurrencies[_currency];
    }

    /// @notice Set the arbitrator to a new address. Only the owner can call this.
    /// @param _newArbitrator Address of the replacement arbitrator
    function setArbitrator(address _newArbitrator) external onlyOwner {
        arbitrator = _newArbitrator;
        emit ArbitratorChanged(_newArbitrator);
    }

    /// @notice Change the owner to a new address. Only the owner can call this.
    /// @param _newOwner Address of the replacement owner
    function setOwner(address _newOwner) external onlyOwner {
        owner = _newOwner;
        emit OwnerChanged(_newOwner);
    }

    /// @notice Setting the fees of the contract
    /// @param _fees Fees in basis-points
    function setFees(uint16 _fees) public onlyOwner {
        require(_fees <= 10000, "Fees must be less than 10000");
        escrowFeeBP = _fees; // stored in terms of basis-points
        emit FeesChanged(_fees);
    }
}
