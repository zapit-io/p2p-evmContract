// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (access/AccessControl.sol)

pragma solidity 0.8.24;
import { LibAccessControlCore, LibAccessControlStorage, AccessControl, AccessControlStorage } from "../shared/libraries/LibAccessControl.sol";
import { LibMeta } from "../shared/libraries/LibMeta.sol";

contract AccessControlFacet is AccessControl {
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
}
