// SPDX-License-Identifier: None
pragma solidity ^0.8.4;

error InvalidSignatureLength();

/**
 * @dev Library for common functions for fixed auction
 */
library Signature {

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
}