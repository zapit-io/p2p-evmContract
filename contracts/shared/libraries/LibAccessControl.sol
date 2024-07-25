// SPDX-License-Identifier: None
pragma solidity 0.8.24;

import { LibMeta } from "./LibMeta.sol";

/**
 * @dev Structure to store access control data.
 * @param _roles Mapping from role identifier to the corresponding RoleData.
 * - @param hasRole Mapping to check if an address has a specific role.
 */
struct AccessControlStorage {
  mapping(bytes32 => mapping(address => bool)) _roles;
}

library LibAccessControlCore {
  /**
   * @dev The `account` is missing a role.
   */
  error AccessControlUnauthorizedAccount(address account, bytes32 neededRole);

  /**
   * @dev The caller of a function is not the expected one.
   *
   * NOTE: Don't confuse with {AccessControlUnauthorizedAccount}.
   */
  error AccessControlBadConfirmation();
  /**
   * @dev Emitted when `newAdminRole` is set as ``role``'s admin role, replacing `previousAdminRole`
   *
   * `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite
   * {RoleAdminChanged} not being emitted signaling this.
   */
  event RoleAdminChanged(
    bytes32 indexed role,
    bytes32 indexed previousAdminRole,
    bytes32 indexed newAdminRole
  );

  /**
   * @dev Emitted when `account` is granted `role`.
   *
   * `sender` is the account that originated the contract call. This account bears the admin role (for the granted role).
   * Expected in cases where the role was granted using the internal {AccessControl-_grantRole}.
   */
  event RoleGranted(
    bytes32 indexed role,
    address indexed account,
    address indexed sender
  );

  /**
   * @dev Emitted when `account` is revoked `role`.
   *
   * `sender` is the account that originated the contract call:
   *   - if using `revokeRole`, it is the admin role bearer
   *   - if using `renounceRole`, it is the role bearer (i.e. `account`)
   */
  event RoleRevoked(
    bytes32 indexed role,
    address indexed account,
    address indexed sender
  );
}

/**
 * @dev Library and storage for maintaining auctions in the protocol
 */
library LibAccessControlStorage {
  bytes32 internal constant STORAGE_SLOT =
    keccak256("zapit.contracts.storage.LibAccessControl");

  function layout() internal pure returns (AccessControlStorage storage s) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      s.slot := slot
    }
  }
}

contract AccessControl {
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  /**
   * @dev Modifier that checks that an account has a specific role. Reverts
   * with an {AccessControlUnauthorizedAccount} error including the required role.
   */
  modifier onlyRole(bytes32 role) {
    _checkRole(role);
    _;
  }

  /**
   * @dev Returns `true` if `account` has been granted `role`.
   */
  function hasRole(bytes32 role, address account) public view returns (bool) {
    return LibAccessControlStorage.layout()._roles[role][account];
  }

  /**
   * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `_msgSender()`
   * is missing `role`. Overriding this function changes the behavior of the {onlyRole} modifier.
   */
  function _checkRole(bytes32 role) internal view {
    _checkRole(role, LibMeta.msgSender());
  }

  /**
   * @dev Reverts with an {AccessControlUnauthorizedAccount} error if `account`
   * is missing `role`.
   */
  function _checkRole(bytes32 role, address account) internal view {
    if (!hasRole(role, account)) {
      revert LibAccessControlCore.AccessControlUnauthorizedAccount(
        account,
        role
      );
    }
  }
}
