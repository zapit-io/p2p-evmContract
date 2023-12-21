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

    // Address of the arbitrator
    address public arbitrator;
    // Address of the owner (who can withdraw collected fees)
    address public owner;
    uint16 public fees; // fees for zapit in bps

    // Cumulative balance of collected fees
    uint256 public feesAvailableForWithdraw;

    // Cumulative balance for collected fees for erc20 tokens
    mapping(address => uint256) public feesAvailableForWithdrawErc20;

    // list of accepted erc20 tokens for escrow
    mapping(address => bool) public acceptedTokens;

    // trade-id to escrow mapping
    mapping(bytes32 => bytes32) public tradeIdToEscrow;

    // counter of escrows
    uint256 private escrowCounter;

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
    error TokenNotAccepted(address _token);
    error IncorrectTokenAmount(address _token);
    error EscrowDoesNotExist();
    error InvalidArbitratorSignature();
    error InvalidSellerSignature();
    error NotABuyer();
    error InvalidSignatureLength();
    error AmountHigherThanAvailable();

    // custom order expiration option
    // uint32 private ORDER_EXPIRATION = 4 hours;

    /***********************
    +       Events        +
    ***********************/

    event Created(
        bytes32 indexed _tradeHash,
        uint16 _fees,
        address indexed _seller,
        address indexed _buyer,
        uint256 _value,
        bytes32 _extUniqueHash
    );
    event CancelledByBuyer(bytes32 indexed _tradeHash);
    event Released(bytes32 indexed _tradeHash);
    event DisputeClaimed(bytes32 indexed _tradeHash);
    event TradeCompleted(bytes32 indexed _tradeHash);
    event ArbitratorChanged(address indexed _newArbitrator);
    event OwnerChanged(address indexed _newOwner);
    event FeesChanged(uint16 indexed _newFees);
    event FeeWithdrawn(
        address indexed _to,
        uint256 _amount,
        address indexed _token
    );

    struct Escrow {
        // So we know the escrow exists
        bool exists;
        // storing the timestamp when the escrow was created
        uint256 createdAt;
        // fees based on bps
        uint16 _fee;
        // token address
        address token; // 0 if ETH
        // address of the buyer
        address payable buyer;
        // address of the seller
        address payable seller;
        // value of the escrow
        uint256 value;
    }

    // Mapping of active trades. The key here is a hash of the trade proprties
    mapping(bytes32 => Escrow) public escrows;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotAnOwner();
        }
        _;
    }

    // modifier for checking a zero address
    modifier nonZeroAddress(address _address) {
        if (_address == address(0)) {
            revert ZeroAddress();
        }
        _;
    }

    // modifier for checking the address is not a contract

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

    modifier onlyArbitrator() {
        if (msg.sender != arbitrator) {
            revert NotAnArbitrator();
        }
        _;
    }

    /// @notice Initialize the contract.
    constructor(uint16 _fees) {
        owner = msg.sender;
        arbitrator = msg.sender;
        if (_fees > 10000) {
            revert FeesOutOfRange();
        }
        fees = _fees; // stored in terms of basis-points
    }

    /***********************
    +   User-Functions   +
    ***********************/

    /// @notice Create and fund a new escrow.
    /// @param _buyer The buying party
    /// @param _value The amount of the escrow, exclusive of the fee
    /// @param _extUniqueHash The external unique hash of the escrow
    function createEscrow(
        address _buyer,
        uint256 _value,
        bytes32 _extUniqueHash
    ) external payable {
        bytes32 trade = tradeIdToEscrow[_extUniqueHash];

        // check if the trade already exists
        if (trade != bytes32(0)) {
            revert TradeExists();
        }

        bytes32 _tradeID = keccak256(
            abi.encodePacked(
                escrowCounter++,
                msg.sender,
                _buyer,
                _value,
                _extUniqueHash
            )
        );

        // checking if the trade already exists
        if (escrows[_tradeID].exists) {
            revert TradeExists();
        }

        // Check transaction value against passed _value and make sure is not 0
        /**
         @description: value + seller fees = msg.value
         */
        uint256 _sellerFees = (_value * fees) / (10000 * 2);

        if (msg.value == 0 || msg.value != (_value + _sellerFees)) {
            revert IncorrectEth();
        }

        // Add the escrow to the public mapping
        escrows[_tradeID] = Escrow(
            true,
            block.number,
            fees,
            address(0),
            payable(_buyer),
            payable(msg.sender),
            _value
        );
        tradeIdToEscrow[_extUniqueHash] = _tradeID;
        emit Created(
            _tradeID,
            fees,
            msg.sender,
            _buyer,
            _value,
            _extUniqueHash
        );
    }

    /// @notice Create and fund a new escrow for token.
    /// @param _buyer The buying party
    /// @param _value The amount of the escrow, exclusive of the fee
    /// @param _token The address of the token to be used for the escrow
    /// @param _extUniqueHash The external unique hash of the escrow
    function createTokenEscrow(
        address _buyer,
        uint256 _value,
        address _token,
        bytes32 _extUniqueHash
    ) external payable {
        bytes32 trade = tradeIdToEscrow[_extUniqueHash];

        // check if the trade already exists
        if (trade != bytes32(0)) {
            revert TradeExists();
        }

        bytes32 _tradeID = keccak256(
            abi.encodePacked(
                block.number,
                msg.sender,
                _buyer,
                _value,
                _extUniqueHash
            )
        );

        // checking if the trade already exists
        if (escrows[_tradeID].exists) {
            revert TradeExists();
        }

        // check if the token is accepted
        if (!acceptedTokens[_token]) {
            revert TokenNotAccepted(_token);
        }

        uint256 prevTokenBalance = IERC20(_token).balanceOf(address(this));

        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _value),
            "Tokens not approved"
        );

        // checking the current token balance of the contract after the transfer
        uint256 currentTokenBalance = IERC20(_token).balanceOf(address(this));

        // Check transaction value against transferred value to the contract

        /**
          @description value + seller fees = msg.value
         */
        uint256 _sellerFees = (_value * fees) / (10000 * 2);

        if (
            (currentTokenBalance - prevTokenBalance) != (_value + _sellerFees)
        ) {
            revert IncorrectTokenAmount(_token);
        }

        // Add the escrow to the public mapping
        escrows[_tradeID] = Escrow(
            true,
            block.number,
            fees,
            _token,
            payable(_buyer),
            payable(msg.sender),
            _value
        );
        tradeIdToEscrow[_extUniqueHash] = _tradeID;
        emit Created(
            _tradeID,
            fees,
            msg.sender,
            _buyer,
            _value,
            _extUniqueHash
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
        require(_escrow.exists, "Escrow does not exist");

        // concat a message out of the tradeID and the msg.sender
        bytes32 messageHash = getMessageHash(_tradeID, msg.sender);
        bytes32 signedMessageHash = getEthSignedMessageHash(messageHash);
        address _signature = recoverSigner(signedMessageHash, _sig);

        require(
            _signature == arbitrator,
            "Signature must be from the arbitrator"
        );

        /**
         *   @notes
         * - disputed in favour of seller, no fees
         * - disputed in favour of buyer, fees will be there
         */
        uint16 fee = msg.sender == _escrow.seller ? 0 : _escrow._fee;

        // tranfer the funds to the msg.sender
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

        // tranfer the funds to the msg.sender
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

    function buyerCancel(bytes32 _tradeID) external returns (bool) {
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
        address _token
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
                feesAvailableForWithdrawErc20[_token] += _totalFees;
            } else {
                feesAvailableForWithdraw += _totalFees;
            }
        }
        if (isErc20) {
            IERC20(_token).transfer(_to, _totalTransferValue);
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
            fees,
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
        require(sig.length == 65, "invalid signature length");

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
    /// @param _token Address of the token
    function withdrawFees(
        address payable _to,
        uint256 _amount,
        address _token
    ) external onlyOwner nonReentrant {
        // This check also prevents underflow
        require(
            _amount <= feesAvailableForWithdraw,
            "Amount is higher than amount available"
        );
        if (_token != address(0)) {
            require(
                _amount <= feesAvailableForWithdrawErc20[_token],
                "Amount is higher than amount available"
            );
            feesAvailableForWithdrawErc20[_token] -= _amount;
            IERC20(_token).transfer(_to, _amount);
        } else {
            feesAvailableForWithdraw -= _amount;
            payable(_to).transfer(_amount);
        }
        emit FeeWithdrawn(_to, _amount, _token);
    }

    ///@notice Setting the accepted tokens for escrow
    ///@param _token Address of the token
    function setAcceptedTokens(address _token) external onlyOwner {
        acceptedTokens[_token] = !acceptedTokens[_token];
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
        fees = _fees; // stored in terms of basis-points
        emit FeesChanged(_fees);
    }
}
