// SPDX-License-Identifier: None
pragma solidity 0.8.24;

import { AccessControl, LibAccessControlStorage, LibAccessControlStorage, AccessControlStorage } from "./libraries/LibAccessControl.sol";
import { FeesOutOfRange, AppStorage } from "./libraries/LibAppStorage.sol";
import { IDiamondCut } from "./interfaces/IDiamondCut.sol";
import { IDiamondLoupe } from "./interfaces/IDiamondLoupe.sol";
import { IERC165 } from "./interfaces/IERC165.sol";
import { IERC173 } from "./interfaces/IERC173.sol";
import { LibDiamond } from "./libraries/LibDiamond.sol";

contract DiamondInit {
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  AppStorage internal s;

  function init(address feeAddress, uint16 escrowFeeBP) external {
    LibDiamond.enforceIsContractOwner();
    LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

    ds.supportedInterfaces[type(IERC165).interfaceId] = true;
    ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
    ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
    ds.supportedInterfaces[type(IERC173).interfaceId] = true;

    s.feeAddress = feeAddress;
    s.arbitrator = msg.sender;

    if (escrowFeeBP > 10000) {
      revert FeesOutOfRange();
    }

    s.escrowFeeBP = escrowFeeBP;

    LibAccessControlStorage.layout()._roles[ADMIN_ROLE][msg.sender] = true;
  }
}
