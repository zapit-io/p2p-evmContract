// SPDX-License-Identifier: None
pragma solidity 0.8.24;

import { AccessControl } from "../shared/libraries/LibAccessControl.sol";
import { LibAccessControlCore, LibAccessControlStorage, AccessControl, AccessControlStorage } from "../shared/libraries/LibAccessControl.sol";
import { AppStorage, Escrow, LibAppStorage, LibEvents, Modifiers } from "../shared/libraries/LibAppStorage.sol";
import { LibDiamond } from "../shared/libraries/LibDiamond.sol";
import { LibMeta } from "../shared/libraries/LibMeta.sol";
import { PausableStorage } from "../shared/libraries/LibAppStorage.sol";

/// @title Zapit P2P Admin Contract
/// @author Zapit
contract AdminFacet is Modifiers, AccessControl {
  /// SETTERS

  /**
   * @dev Grants `role` to `account`.
   *
   * If `account` had not been already granted `role`, emits a {RoleGranted}
   * event.
   *
   * Requirements:
   *
   * - the caller must have ``role``'s admin role.
   *
   * May emit a {RoleGranted} event.
   */
  function grantRole(
    bytes32 role,
    address account
  ) public virtual onlyRole(ADMIN_ROLE) {
    _grantRole(role, account);
  }

  /**
   * @dev Revokes `role` from `account`.
   *
   * If `account` had been granted `role`, emits a {RoleRevoked} event.
   *
   * Requirements:
   *
   * - the caller must have ``role``'s admin role.
   *
   * May emit a {RoleRevoked} event.
   */
  function revokeRole(
    bytes32 role,
    address account
  ) public virtual onlyRole(ADMIN_ROLE) {
    _revokeRole(role, account);
  }

  /**
   * @dev Revokes `role` from the calling account.
   *
   * Roles are often managed via {grantRole} and {revokeRole}: this function's
   * purpose is to provide a mechanism for accounts to lose their privileges
   * if they are compromised (such as when a trusted device is misplaced).
   *
   * If the calling account had been revoked `role`, emits a {RoleRevoked}
   * event.
   *
   * Requirements:
   *
   * - the caller must be `callerConfirmation`.
   *
   * May emit a {RoleRevoked} event.
   */
  function renounceRole(
    bytes32 role,
    address callerConfirmation
  ) public virtual {
    if (callerConfirmation != LibMeta.msgSender()) {
      revert LibAccessControlCore.AccessControlBadConfirmation();
    }

    _revokeRole(role, callerConfirmation);
  }

  /**
   * @dev Attempts to grant `role` to `account` and returns a boolean indicating if `role` was granted.
   *
   * Internal function without access restriction.
   *
   * May emit a {RoleGranted} event.
   */
  function _grantRole(
    bytes32 role,
    address account
  ) internal virtual returns (bool) {
    if (!hasRole(role, account)) {
      LibAccessControlStorage.layout()._roles[role][account] = true;
      emit LibAccessControlCore.RoleGranted(role, account, LibMeta.msgSender());
      return true;
    } else {
      return false;
    }
  }

  /**
   * @dev Attempts to revoke `role` to `account` and returns a boolean indicating if `role` was revoked.
   *
   * Internal function without access restriction.
   *
   * May emit a {RoleRevoked} event.
   */
  function _revokeRole(
    bytes32 role,
    address account
  ) internal virtual returns (bool) {
    if (hasRole(role, account)) {
      LibAccessControlStorage.layout()._roles[role][account] = false;
      emit LibAccessControlCore.RoleRevoked(role, account, LibMeta.msgSender());
      return true;
    } else {
      return false;
    }
  }

  /// @notice Pause the contract
  function pause() external whenNotPaused onlyRole(ADMIN_ROLE) {
    PausableStorage.layout()._paused = true;
    emit LibEvents.Paused(msg.sender);
  }

  /// @notice Unpause the contract
  function unpause() external whenPaused onlyRole(ADMIN_ROLE) {
    PausableStorage.layout()._paused = false;
    emit LibEvents.Unpaused(msg.sender);
  }

  ///@notice Setting the accepted currencies for escrow
  ///@param _currency             Address of the currency
  ///@param _enable               Enable whitelisting for currency
  function setWhitelistedCurrencies(
    address _currency,
    bool _enable
  ) external onlyRole(ADMIN_ROLE) {
    s.whitelistedCurrencies[_currency] = _enable;
  }

  /// @notice Set the arbitrator to a new address. Only the owner can call this.
  /// @param _newArbitrator Address of the replacement arbitrator
  function setArbitrator(address _newArbitrator) external onlyRole(ADMIN_ROLE) {
    s.arbitrator = _newArbitrator;
    emit LibEvents.ArbitratorChanged(_newArbitrator);
  }

  /// @notice Setting the fees of the contract
  /// @param _fees Fees in basis-points
  function setFees(uint16 _fees) public onlyRole(ADMIN_ROLE) {
    require(_fees <= 10000, "Fees must be less than 10000");
    s.escrowFeeBP = _fees; // stored in terms of basis-points
    emit LibEvents.FeesChanged(_fees);
  }

  /// @notice Set the fee address of the marketplace
  /// @param feeAddress The address that will get the fee charged per order
  function setFeeAddress(address feeAddress) external onlyRole(ADMIN_ROLE) {
    s.feeAddress = feeAddress;
    emit LibEvents.FeeAddressChanged(feeAddress);
  }

  /// GETTERS

  /// @notice Returns if pause state of the contract
  function paused() external view returns (bool) {
    return PausableStorage.layout()._paused;
  }

  ///@notice Getting the accepted currencies for escrow, true if accepted
  ///@param _currency Address of the currency
  function getWhitelistedCurrencies(
    address _currency
  ) external view returns (bool) {
    return s.whitelistedCurrencies[_currency];
  }

  /// @notice Get the arbitrator of the contract
  function getArbitrator() external view returns (address) {
    return s.arbitrator;
  }

  /// @notice Get the curreny market fee
  function getFees() external view returns (uint16) {
    return s.escrowFeeBP;
  }

  ///@notice Get the fee address of the marketplace
  function getFeeAddress() external view returns (address) {
    return s.feeAddress;
  }

  ///@notice Get the fee address of the marketplace
  function getEscrow(
    bytes32 tradeID
  ) external view returns (Escrow memory escrow) {
    AppStorage storage ds = LibAppStorage.diamondStorage();
    return ds.escrows[tradeID];
  }
}
