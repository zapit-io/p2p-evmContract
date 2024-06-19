// SPDX-License-Identifier: None
pragma solidity 0.8.24;

import { AppStorage, Escrow, LibAppStorage, LibEvents, Modifiers } from "../shared/libraries/LibAppStorage.sol";
import { LibDiamond } from "../shared/libraries/LibDiamond.sol";
import { PausableStorage } from "../shared/libraries/LibAppStorage.sol";

/// @title Zapit P2P Admin Contract
/// @author Zapit
contract AdminFacet is Modifiers {
  /// SETTERS

  /// @notice Pause the contract
  function pause() external whenNotPaused onlyOwner {
    PausableStorage.layout()._paused = true;
    emit LibEvents.Paused(msg.sender);
  }

  /// @notice Unpause the contract
  function unpause() external whenPaused onlyOwner {
    PausableStorage.layout()._paused = false;
    emit LibEvents.Unpaused(msg.sender);
  }

  ///@notice Setting the accepted currencies for escrow
  ///@param _currency             Address of the currency
  ///@param _enable               Enable whitelisting for currency
  function setWhitelistedCurrencies(
    address _currency,
    bool _enable
  ) external onlyOwner {
    s.whitelistedCurrencies[_currency] = _enable;
  }

  /// @notice Set the arbitrator to a new address. Only the owner can call this.
  /// @param _newArbitrator Address of the replacement arbitrator
  function setArbitrator(address _newArbitrator) external onlyOwner {
    s.arbitrator = _newArbitrator;
    emit LibEvents.ArbitratorChanged(_newArbitrator);
  }

  /// @notice Setting the fees of the contract
  /// @param _fees Fees in basis-points
  function setFees(uint16 _fees) public onlyOwner {
    require(_fees <= 10000, "Fees must be less than 10000");
    s.escrowFeeBP = _fees; // stored in terms of basis-points
    emit LibEvents.FeesChanged(_fees);
  }

  /// @notice Set the fee address of the marketplace
  /// @param feeAddress The address that will get the fee charged per order
  function setFeeAddress(address feeAddress) external onlyOwner {
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
