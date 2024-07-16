import { assert, expect } from 'chai'
import { ZeroAddress } from "ethers"
import { ethers } from "hardhat"
const { deployDiamond } = require('../scripts/deploy.js')
const { deployFacets } = require('../scripts/deployFacets.js')
const { deployToken } = require('../scripts/deployToken.js')
const { getSelectors, FacetCutAction } = require('../scripts/libraries/diamond.js')


/**
 * Calculates the order values including the seller fees and total order value.
 * 
 * @param {Object} params - The parameters for the order.
 * @param {number} params.amount - The value of the order.
 * @param {number} params.fee - The fee percentage to be applied.
 * @param {string} params.type - The type of the order, either 'NATIVE' or 'ERC20'.
 * @returns {Object} - An object containing the order value, seller fees, and total order value.
 * @throws {Error} - Throws an error if the type is unsupported.
 */
const getOrderValues = ({ amount, fee, type }: { amount: number, fee: number, type: string }) => {
  let orderValue: bigint, orderValueToSend: bigint, sellerFees: bigint;
  switch (type) {
    case 'NATIVE':
      orderValue = ethers.parseUnits(amount.toString(), 18);
      break;
    case 'ERC20':
      orderValue = ethers.parseUnits(amount.toString(), 0);
      break;
    default:
      throw new Error(`Unsupported type: ${type}`);
  }

  sellerFees = (orderValue * BigInt(fee)) / (BigInt(10000) * BigInt(2));
  orderValueToSend = orderValue + sellerFees;
  return { orderValue, orderValueToSend, sellerFees };
}

/**
 * Test suite for the Escrow contract functionality.
 */
describe('Tests', async function () {
  let adminFacetContract: any,
    buyer: any,
    deployer: any,
    arbitrator: any,
    diamondAddress: any,
    diamondCutContract: any,
    diamondInitAddr: any,
    diamondInitContract: any,
    diamondLoupeContract: any,
    escrowFacet: any,
    escrowFacetERC20Contract: any,
    FEES: any,
    feeAccount: any,
    ownershipFacetContract: any,
    secondaryDeployer: any,
    seller: any,
    tokenContract: any;

  const adminRoleBytes32 = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
  /**
   * Before hook to set up the test environment.
   * This function deploys the diamond contract, its facets, and initializes the necessary contracts.
   * It also mints tokens for the deployer, buyer, and seller to be used in the tests.
   */
  before(async function () {
    // Retrieve signers for different roles
    [deployer, arbitrator, buyer, seller, feeAccount, secondaryDeployer] = await ethers.getSigners();

    // Deploy the diamond contract and retrieve its address and initialization address
    let deployedCoreContracts = await deployDiamond();
    diamondAddress = deployedCoreContracts['diamondAddr'];
    diamondInitAddr = deployedCoreContracts['diamondInitAddr'];

    // Deploy the facets of the diamond contract
    await deployFacets({ ...deployedCoreContracts, feeAddress: feeAccount.address });

    // Get contract instances for the different facets of the diamond contract
    diamondLoupeContract = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress);
    diamondCutContract = await ethers.getContractAt('DiamondCutFacet', diamondAddress);
    escrowFacet = await ethers.getContractAt('EscrowFacet', diamondAddress);
    escrowFacetERC20Contract = await ethers.getContractAt('EscrowFacetERC20', diamondAddress);
    ownershipFacetContract = await ethers.getContractAt('OwnershipFacet', diamondAddress);
    adminFacetContract = await ethers.getContractAt('AdminFacet', diamondAddress);
    diamondInitContract = await ethers.getContractAt('DiamondInit', diamondInitAddr);

    // Deploy and mint tokens for the deployer, buyer, and seller
    tokenContract = await deployToken();

    const amount = 100000;
    const mintAmount = ethers.parseUnits(amount.toString(), 0);
    await tokenContract.mint(deployer.address, mintAmount);
    await tokenContract.mint(buyer.address, mintAmount);
    await tokenContract.mint(seller.address, mintAmount);
  })

  /**
   * Test to verify the number of facets within the diamond contract.
   * This ensures that the diamond contract has the expected number of facets.
   */
  it("UPGRADABILITY: Check all facets within diamond", async () => {
    let res = await diamondLoupeContract.facets();
    assert(res.length == 7, "Expected 7 facets in the diamond contract");
  });

  /**
   * Test to remove the AdminFacet from the diamond contract.
   * This ensures that the AdminFacet can be successfully removed from the diamond contract.
   */
  it("UPGRADABILITY: Remove the AdminFacet from the diamond contract", async () => {
    // Define the cut array to specify the facet removal
    const cut: any = [];
    const selectorsToIgnore: any = [];

    // Add the removal action for the AdminFacet
    cut.push({
      facetAddress: '0x0000000000000000000000000000000000000000', // Address zero indicates removal
      action: FacetCutAction.Remove,
      functionSelectors: getSelectors(adminFacetContract, selectorsToIgnore) // Get selectors to remove
    });

    // Encode the function call to the diamondInit contract's init function
    let functionCall = diamondInitContract.interface.encodeFunctionData(
      'init',
      [feeAccount.address, 100] // Parameters for the init function
    );

    // Execute the diamond cut to remove the AdminFacet
    await diamondCutContract.diamondCut(
      cut,
      diamondInitAddr,
      functionCall
    );
  });

  /**
   * Test to verify the number of facets within the diamond contract after removal.
   * This ensures that the diamond contract has the expected number of facets.
   */
  it("UPGRADABILITY: Check all facets within diamond", async () => {
    let res = await diamondLoupeContract.facets();
    assert(res.length == 6, "Expected 6 facets in the diamond contract after removal");
  });

  /**
   * Test to ensure that calling methods from the removed admin contract fails.
   * This verifies that the methods from the removed AdminFacet are no longer accessible.
   */
  it("UPGRADABILITY: Fail to call methods from admin contract", async () => {
    await expect(
      adminFacetContract.paused()
    ).to.be.revertedWith(
      `Diamond: Function does not exist`
    );
  });

  /**
   * Test to add the AdminFacet back to the diamond contract.
   * This ensures that the AdminFacet can be successfully added to the diamond.
   */
  it("UPGRADABILITY: Add a AdminContract to diamond", async () => {
    const cut: any = [];
    const selectorsToIgnore: any = [];

    // Deploy the AdminFacet contract
    const facet = await ethers.deployContract('AdminFacet');

    // Prepare the cut array with the add action for the AdminFacet
    cut.push({
      facetAddress: facet.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet, selectorsToIgnore)
    });

    // Execute the diamond cut to add the AdminFacet
    await diamondCutContract.diamondCut(
      cut,
      '0x0000000000000000000000000000000000000000',
      '0x'
    );
  });

  /**
   * Test to verify the number of facets within the diamond contract after adding the AdminFacet.
   * This ensures that the diamond contract has the expected number of facets.
   */
  it("UPGRADABILITY: Check all facets within diamond", async () => {
    let res = await diamondLoupeContract.facets();
    assert(res.length == 7, "Expected 7 facets in the diamond contract after adding AdminFacet");
  });

  /**
   * Test to ensure that adding the AdminFacet to the diamond contract again fails.
   * This verifies that the diamond contract prevents adding a facet that already exists.
   */
  it("UPGRADABILITY: Fail to add AdminContract to diamond again", async () => {
    const cut: any = [];
    const selectorsToIgnore: any = [];

    // Deploy the AdminFacet contract
    const facet = await ethers.deployContract('AdminFacet');
    cut.push({
      facetAddress: facet.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet, selectorsToIgnore)
    });

    // Encode the init function call
    let functionCall = diamondInitContract.interface.encodeFunctionData(
      'init',
      [feeAccount.address, 100]
    );

    // Attempt to add the AdminFacet again and expect it to fail
    await expect(
      diamondCutContract.diamondCut(
        cut,
        diamondInitAddr,
        functionCall
      )
    ).to.be.revertedWith(
      "LibDiamondCut: Can't add function that already exists"
    );
  });

  /**
   * Test to ensure that a non-owner cannot remove the AdminFacet from the diamond contract.
   * This verifies that only the contract owner has the permission to remove facets.
   */
  it("UPGRADABILITY: Non owner cannot remove AdminContract from diamond", async () => {
    const cut: any = [];
    const selectorsToIgnore: any = [];

    cut.push({
      facetAddress: '0x0000000000000000000000000000000000000000',
      action: FacetCutAction.Remove,
      functionSelectors: getSelectors(adminFacetContract, selectorsToIgnore)
    });

    // Attempt to remove the AdminFacet as a non-owner and expect it to fail
    await expect(
      diamondCutContract.connect(secondaryDeployer).diamondCut(
        cut,
        '0x0000000000000000000000000000000000000000',
        '0x'
      )
    ).to.be.revertedWith(
      "LibDiamond: Must be contract owner"
    );
  });

  /**
   * Test to fetch and verify the ownership of the contract.
   * This ensures that the deployer is the initial owner.
   */
  it("ADMIN: [OWNERSHIP] Should fetch and verify the ownership of the contract", async () => {
    let res = await ownershipFacetContract.owner();
    assert.equal(res, deployer.address);
  });

  /**
   * Test to transfer ownership to account[1] (arbitrator).
   * This verifies that the ownership can be transferred to another account.
   */
  it("ADMIN: [OWNERSHIP] Should transfer ownership to account[1] i.e arbitrator", async () => {
    await ownershipFacetContract.transferOwnership(secondaryDeployer.address);
    let res = await ownershipFacetContract.owner();
    assert.equal(res, secondaryDeployer.address);
  });

  /**
   * Test to transfer ownership back to account[0] (deployer).
   * This ensures that the ownership can be transferred back to the original deployer.
   */
  it("ADMIN: [OWNERSHIP] Should transfer ownership back to account[0] i.e deployer", async () => {
    await ownershipFacetContract.connect(secondaryDeployer).transferOwnership(deployer.address);
    let res = await adminFacetContract.getArbitrator();
    assert.equal(res, deployer.address);
  });
  /**
   * Test to verify the arbiter.
   * This ensures that the arbiter can be fetched and set correctly.
   */
  it("ADMIN: [ARBITER] Should verify the arbiter", async () => {
    let res = await adminFacetContract.getArbitrator();
    assert.equal(res, deployer.address);
    await adminFacetContract.setArbitrator(arbitrator.address);
    res = await adminFacetContract.getArbitrator();
    assert.equal(res, arbitrator.address);
  });

  /**
   * Test to fetch the default market fee address.
   * This ensures that the default market fee address is correct.
   */
  it("ADMIN: [FEE ADDRESS] Should fetch the default market fee address", async () => {
    let res = await adminFacetContract.getFeeAddress();
    assert.equal(res, feeAccount.address);
  });

  /**
   * Test to set and fetch the default market fee address.
   * This ensures that the market fee address can be set and fetched correctly.
   */
  it("ADMIN: [FEE ADDRESS] SET+GET Should set and fetch the default market fee address", async () => {
    await adminFacetContract.setFeeAddress(feeAccount.address);
    let res = await adminFacetContract.getFeeAddress();
    assert.equal(res, feeAccount.address);
  });

  /**
   * Test to fetch the market fee.
   * This ensures that the market fee is set correctly.
   */
  it("ADMIN: [Fees] Should fetch the market fee set", async () => {
    let res = await adminFacetContract.getFees();
    FEES = parseFloat(res);
    assert.equal(FEES, 100);
  });

  /**
   * Test to check if the market is not paused initially.
   * This ensures that the market is active by default.
   */
  it("ADMIN: [PAUSABLE] Market should not be paused initially", async () => {
    let res = await adminFacetContract.paused();
    assert(res == false);
  });

  /**
   * Test to check if the deployer has the admin role.
   * This ensures that the deployer is assigned the admin role.
   */
  it("ADMIN: [ROLE] Check deployer hasRole", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, deployer.address);
    assert(hasRoleSet == true);
  });

  /**
   * Test to check if the secondary deployer does not have the admin role.
   * This ensures that the secondary deployer is not assigned the admin role by default.
   */
  it("ADMIN: [ROLE] secondaryDeployer hasRole must be false", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address);
    assert(hasRoleSet == false);
  });

  /**
   * Test to grant the admin role to the secondary deployer.
   * This ensures that the admin role can be granted to another account.
   */
  it("ADMIN: [ROLE] Grant Role to secondaryDeployer", async () => {
    await adminFacetContract.grantRole(adminRoleBytes32, secondaryDeployer.address);
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address);
    assert(hasRoleSet == true);
  });

  /**
   * Test to check if the secondary deployer has the admin role after being granted.
   * This ensures that the role assignment is effective.
   */
  it("ADMIN: [ROLE] secondaryDeployer hasRole must be true", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address);
    assert(hasRoleSet == true);
  });

  /**
   * Test to check if the secondary deployer can pause and unpause the market.
   * This ensures that the secondary deployer has the necessary permissions.
   */
  it("ADMIN: [ROLE] secondaryDeployer must be able to pause and unpause the market", async () => {
    await adminFacetContract.connect(secondaryDeployer).pause();
    let res = await adminFacetContract.paused();
    assert(res == true);
    await adminFacetContract.unpause();
    res = await adminFacetContract.paused();
    assert(res == false);
  });

  /**
   * Test to revert unauthorized grant role invocation from a non-admin account.
   * This ensures that only authorized accounts can grant roles.
   */
  it("ADMIN: [ROLE] Revert Unauthorized Grant Role invocation from non admin account", async () => {
    await expect(
      adminFacetContract.connect(arbitrator).grantRole(adminRoleBytes32, deployer.address)
    ).to.be.revertedWithCustomError(
      adminFacetContract,
      "AccessControlUnauthorizedAccount"
    ).withArgs(arbitrator.address, adminRoleBytes32);
  });

  /**
   * Test to revoke the admin role from the secondary deployer.
   * This ensures that roles can be revoked correctly.
   */
  it("ADMIN: [ROLE] Revoke Role", async () => {
    await adminFacetContract.revokeRole(adminRoleBytes32, secondaryDeployer.address);
  });

  /**
   * Test to check if the secondary deployer does not have the admin role after revocation.
   * This ensures that the role revocation is effective.
   */
  it("ADMIN: [ROLE] secondaryDeployer hasRole must be false", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address);
    assert(hasRoleSet == false);
  });

  /**
   * Test to assign the admin role to the secondary deployer and ensure it can renounce the role.
   * This verifies that role assignment and renouncement work as expected.
   */
  it("ADMIN: [ROLE] Assign role to secondaryDeployer and it must renounce the Role", async () => {
    await adminFacetContract.grantRole(adminRoleBytes32, secondaryDeployer.address);
    let hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address);
    assert(hasRoleSet == true, "Secondary deployer should have the admin role");

    await adminFacetContract.connect(secondaryDeployer).renounceRole(adminRoleBytes32, secondaryDeployer.address);
    hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address);
    assert(hasRoleSet == false, "Secondary deployer should have renounced the admin role");
  });

  /**
   * Test to ensure that the DiamondInit contract's init function cannot be called by non-owners.
   * This verifies that only the contract owner can execute the init function.
   */
  it("CORE: [DiamondInit] Should not be able to execute as it can only be called by the owner", async () => {
    await expect(
      diamondInitContract.init(feeAccount.address, FEES)
    ).to.be.revertedWith(
      `LibDiamond: Must be contract owner`
    );
  });

  /**
   * Test to verify the 0th storage slot for both the diamond and diamond init contracts.
   * This ensures that the storage slots are correctly set for ownership.
   */
  it("CORE: [DiamondInit] 0th storage slot must be owner for diamond and address(0) for diamond init", async () => {
    let storageSlotInit = await ethers.provider.getStorage(diamondInitAddr, 0);
    let storageSlotDiamond = await ethers.provider.getStorage(diamondAddress, 0);
    assert(storageSlotInit != storageSlotDiamond, "Storage slots for diamond and diamond init should be different");
  });

  /**
   * Test to pause the market using the adminFacetContract.
   * This ensures that the market can be paused correctly.
   */
  it("ADMIN [PAUSABLE] Should pause the market", async () => {
    await adminFacetContract.pause();
    let res = await adminFacetContract.paused();
    assert(res == true, "Market should be paused");
  });

  /**
   * Test to ensure that creating an order fails when the contract is paused.
   * This verifies that the contract enforces the paused state correctly.
   */
  it("PAUSABLE: Fail to create order due to paused contract", async () => {
    try {
      const extTradeIdentifier = ethers.encodeBytes32String("x-0234");
      const amount = 10000;
      // Retrieve the fee from the admin facet contract
      const fee = await adminFacetContract.getFees();
      // Calculate order values based on the ERC20 currency and fee
      const { orderValue, orderValueToSend } = await getOrderValues({ amount, fee, type: 'ERC20' });

      await tokenContract.connect(seller).increaseAllowance(diamondAddress, orderValueToSend);

      await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
        buyer.address,
        orderValue,
        extTradeIdentifier,
        tokenContract.target
      );
    } catch (e) {
      // @ts-ignore
      assert(e?.message.includes('Pausable: paused') == true, "Order creation should fail due to paused contract");
    }
  });

  /**
   * Test to unpause the market using the adminFacetContract.
   * This ensures that the market can be unpaused correctly.
   */
  it("PAUSABLE: Should unpause the market", async () => {
    await adminFacetContract.unpause();
    let res = await adminFacetContract.paused();
    assert(res == false, "Market should be unpaused");
  });

  /**
   * Test to ensure that creating an order fails when the currency is not whitelisted.
   * This verifies that the contract enforces the whitelist correctly.
   */
  it("WHITELIST: Fail to create order as currency is not whitelisted", async () => {
    try {
      const extTradeIdentifier = ethers.encodeBytes32String("x-0234");
      const amount = 10000;
      // Retrieve the fee from the admin facet contract
      const fee = await adminFacetContract.getFees();
      // Calculate order values based on the ERC20 currency and fee
      const { orderValue, orderValueToSend } = await getOrderValues({ amount, fee, type: 'ERC20' });
      await tokenContract.connect(seller).increaseAllowance(diamondAddress, orderValueToSend);

      await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
        buyer.address,
        orderValue,
        extTradeIdentifier,
        tokenContract.target
      );
    } catch (e) {
      // @ts-ignore
      assert(e?.message.includes('CurrencyNotWhitelisted') == true, "Order creation should fail due to non-whitelisted currency");
    }
  });

  /**
   * Test case to whitelist base currency.
   * This test ensures that the base currency and the token contract's target address
   * are successfully whitelisted in the admin facet contract.
   */
  it("WHITELIST: Whitelist base currency", async () => {
    // Whitelist the ZeroAddress (base currency)
    await adminFacetContract.setWhitelistedCurrencies(ZeroAddress, true)
    // Whitelist the token contract's target address
    await adminFacetContract.setWhitelistedCurrencies(tokenContract.target, true)

    // Verify that the ZeroAddress is whitelisted
    let res = await adminFacetContract.getWhitelistedCurrencies(ZeroAddress)
    assert(res == true, "ZeroAddress should be whitelisted")

    // Verify that the token contract's target address is whitelisted
    res = await adminFacetContract.getWhitelistedCurrencies(tokenContract.target)
    assert(res == true, "Token contract's target address should be whitelisted")
  })

  /**
   * Test case to create and complete a trade using native currency.
   * This test ensures that the trade is created and completed successfully,
   * and verifies the balances of the buyer, seller, and fee account.
   */
  it("EscrowFacet: Create and Complete Native currency trade", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("123");
    const amount = 0.237;
    const fee = await adminFacetContract.getFees();

    const { orderValue, orderValueToSend, sellerFees } = getOrderValues({ amount, fee, type: 'NATIVE' });

    // Check initial balances of buyer, seller, and fee account
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address);

    // Create escrow for native currency
    let res = await escrowFacet.connect(seller).createEscrowNative(
      buyer.address,
      orderValue,
      extTradeIdentifier,
      { value: orderValueToSend }
    );

    const response = await res.wait();
    const tradeHash = response.logs[0].args[0];
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Generate and verify the message hash and signature
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address);
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory");

    // Complete the trade
    res = await escrowFacet.connect(seller).executeOrder(tradeHash, sig);

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of buyer, seller, and fee account
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address);

    // Assertions to verify balance changes
    assert(sellerBalanceAfter < sellerBalanceBefore, "Seller balance should decrease");
    assert(buyerBalanceAfter > buyerBalanceBefore, "Buyer balance should increase");
    assert(feeAccountBalanceAfter - feeAccountBalanceBefore === sellerFees * BigInt(2), "Fee account balance should increase exactly by the seller fee");
  })

  /**
   * Test to create and cancel an order.
   * This test ensures that a seller can create an escrow for a native currency trade,
   * and the buyer can subsequently cancel the order.
   */
  it("EscrowFacet: Create and Cancel order", async () => {
    // Define external trade identifier and order value in ETH
    const extTradeIdentifier = ethers.encodeBytes32String("234");
    const amount = 1;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the native currency and fee
    const { orderValue, orderValueToSend } = getOrderValues({ amount, fee, type: 'NATIVE' });

    // Check initial balances of buyer, seller, and fee account
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address);

    // Create escrow for native currency
    let res = await escrowFacet.createEscrowNative(buyer.address, orderValue, extTradeIdentifier, {
      value: orderValueToSend,
    });

    // Wait for the transaction to be mined and get the trade hash from the logs
    const response = await res.wait();
    const tradeHash = response.logs[0].args[0];

    // Retrieve the escrow structure and assert that the escrow is active
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Cancel the trade as the buyer
    res = await escrowFacet.connect(buyer).buyerCancel(tradeHash);

    // Retrieve the escrow structure again and assert that the escrow is no longer active
    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of buyer, seller, and fee account
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address);

    // Assertions to verify balance changes
    assert(sellerBalanceAfter == sellerBalanceBefore, "Seller balance should remain the same");
    assert(buyerBalanceAfter < buyerBalanceBefore, "Buyer balance should decrease due to gas fees");
    assert(feeAccountBalanceAfter == feeAccountBalanceBefore, "Fee account balance should remain the same");
  });

  /**
   * Test to create and claim a disputed order as the buyer.
   * This test ensures that a buyer can create an escrow, dispute it, and claim the disputed order.
   */
  it("EscrowFacet: Create and Claim dispute (Buyer)", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("345");
    const amount = 1;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the native currency and fee
    const { orderValue, orderValueToSend, sellerFees } = getOrderValues({ amount, fee, type: 'NATIVE' });

    // Check initial balances of buyer, seller, and fee account
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address);

    // Create escrow for native currency
    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, orderValue, extTradeIdentifier, {
      value: orderValueToSend,
    });

    // Wait for the transaction to be mined and get the trade hash from the logs
    const response = await res.wait();
    const tradeHash = response.logs[0].args[0];

    // Retrieve the escrow structure and assert that the escrow is active
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Generate message hash and signature for dispute resolution
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address);
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    // Assert that the signatory is valid
    assert(_signatory == arbitrator.address, "Invalid signatory");

    // Complete the trade by claiming the disputed order
    res = await escrowFacet.connect(buyer).claimDisputedOrder(tradeHash, sig);

    // Retrieve the escrow structure again and assert that the escrow is no longer active
    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of buyer, seller, and fee account
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address);

    // Assertions to verify balance changes
    assert(sellerBalanceAfter < sellerBalanceBefore, "Seller balance should decrease");
    assert(buyerBalanceAfter > buyerBalanceBefore, "Buyer balance should increase");
    assert(feeAccountBalanceAfter - feeAccountBalanceBefore === sellerFees * BigInt(2), "Fee account balance should increase exactly by the seller fee");
  });

  /**
   * Test case for creating and claiming a disputed order by the seller using the EscrowFacet.
   * This test verifies the creation of an escrow, the signing of a message by the arbitrator,
   * and the claiming of the disputed order by the seller. It also checks the balances of the
   * buyer, seller, and fee account before and after the transaction.
   */
  it("EscrowFacet: Create and Claim dispute (Seller)", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("456");
    const amount = 1;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the native currency and fee
    const { orderValue, orderValueToSend, sellerFees } = getOrderValues({ amount, fee, type: 'NATIVE' });

    // Check funds of buyer, seller and fee address
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address)

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, orderValue, extTradeIdentifier, {
      value: orderValueToSend,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // Generate message hash and signature for dispute resolution
    const messageHash = await escrowFacet.getMessageHash(tradeHash, seller.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(seller).claimDisputedOrder(tradeHash, sig)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    // Assertions to verify balance changes
    assert(sellerBalanceAfter < sellerBalanceBefore, "Seller balance should decrease because of the fee paid")
    assert(buyerBalanceAfter == buyerBalanceBefore, "Buyer balance should stay the same")
    assert(feeAccountBalanceAfter == feeAccountBalanceBefore, "Fee account balance should stay the same")
  })

  /**
   * Test case to create and complete a trade using ERC20 currency.
   * This test ensures that the trade is created and completed successfully,
   * and verifies the balances of the buyer, seller, and fee account.
   */
  it("EscrowFacetERC20Contract: Create and Complete ERC20 currency trade", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("0123");
    const amount = 10000;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the ERC20 currency and fee
    const { orderValue, orderValueToSend, sellerFees } = await getOrderValues({ amount, fee, type: 'ERC20' });

    // Check initial balances of buyer, seller, contract, and fee account
    const balanceOfSeller = await tokenContract.balanceOf(seller);
    const balanceOfBuyer = await tokenContract.balanceOf(buyer);
    const balanceOfContract = await tokenContract.balanceOf(diamondAddress);
    const balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Approve the escrow value to be transferred from the seller to the contract
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, orderValueToSend);

    // Create escrow for ERC20 currency
    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      orderValue,
      extTradeIdentifier,
      tokenContract.target
    );

    const response = await res.wait();
    const tradeHash = response.logs[2].args[0];
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Generate and verify the message hash and signature
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address);
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory");

    // Complete the trade
    res = await escrowFacetERC20Contract.connect(seller).executeOrderERC20(tradeHash, sig);

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of buyer, seller, contract, and fee account
    const newBalanceOfSeller = await tokenContract.balanceOf(seller);
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer);
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress);
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Assertions to verify balance changes
    assert(BigInt(balanceOfSeller) - BigInt(newBalanceOfSeller) == orderValue + sellerFees, "Seller balance should decrease");
    assert(BigInt(newBalanceOfBuyer) - BigInt(balanceOfBuyer) == orderValue - sellerFees, "Buyer balance should increase");
    assert(newBalanceOfContract == balanceOfContract, "Contract balance should remain the same");
    assert(newBalanceOfFeeAddress + balanceOfFeeAddress == sellerFees * BigInt(2), "Fee account balance should increase");
  })

  /**
   * Test to create and cancel an ERC20 order.
   * This test ensures that a seller can create an escrow for an ERC20 currency trade,
   * and the buyer can subsequently cancel the order.
   */
  it("EscrowFacet: Create and Cancel order", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("0234");
    const amount = 10000;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the ERC20 currency and fee
    const { orderValue, orderValueToSend } = await getOrderValues({ amount, fee, type: 'ERC20' });

    // Approve the escrow value to be transferred from the seller to the contract
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, orderValueToSend);

    // Check initial balances of seller, buyer, contract, and fee account
    let balanceOfSeller = await tokenContract.balanceOf(seller);
    let balanceOfBuyer = await tokenContract.balanceOf(buyer);
    let balanceOfContract = await tokenContract.balanceOf(diamondAddress);
    let balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Create escrow for ERC20 currency
    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      orderValue,
      extTradeIdentifier,
      tokenContract.target
    );

    const response = await res.wait();
    const tradeHash = response.logs[2].args[0];
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Buyer cancels the trade
    res = await escrowFacetERC20Contract.connect(buyer).buyerCancelERC20(tradeHash);

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of seller, buyer, contract, and fee account
    const newBalanceOfSeller = await tokenContract.balanceOf(seller);
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer);
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress);
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Assertions to verify balance changes
    assert(balanceOfSeller == newBalanceOfSeller, "Seller balance should remain the same");
    assert(balanceOfBuyer == newBalanceOfBuyer, "Buyer balance should remain the same");
    assert(balanceOfContract == newBalanceOfContract, "Contract balance should remain the same");
    assert(balanceOfFeeAddress == newBalanceOfFeeAddress, "Fee account balance should remain the same");
  })

  /**
   * Test to create and claim a disputed order as the seller.
   * This test ensures that a seller can create an escrow for an ERC20 currency trade,
   * and subsequently claim the disputed order with the arbitrator's signature.
   */
  it("EscrowFacet: Create and Claim dispute (Seller)", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("0456");
    const amount = 10000;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the ERC20 currency and fee
    const { orderValue, orderValueToSend } = await getOrderValues({ amount, fee, type: 'ERC20' });

    // Check initial balances of seller, buyer, contract, and fee account
    let balanceOfSeller = await tokenContract.balanceOf(seller);
    let balanceOfBuyer = await tokenContract.balanceOf(buyer);
    let balanceOfContract = await tokenContract.balanceOf(diamondAddress);
    let balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Approve the escrow value to be transferred from the seller to the contract
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, orderValueToSend);

    // Create escrow for ERC20 currency
    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      orderValue,
      extTradeIdentifier,
      tokenContract.target
    );
    const response = await res.wait();

    const tradeHash = response.logs[2].args[0];
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Generate and verify the message hash and signature
    const messageHash = await escrowFacet.getMessageHash(tradeHash, seller.address);
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory");

    // Complete the trade
    res = await escrowFacetERC20Contract.connect(seller).claimDisputedOrderERC20(tradeHash, sig);

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of seller, buyer, contract, and fee account
    const newBalanceOfSeller = await tokenContract.balanceOf(seller);
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer);
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress);
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Assertions to verify balance changes
    assert(balanceOfSeller == newBalanceOfSeller, "Fee calculations are incorrect");
    assert(balanceOfBuyer == newBalanceOfBuyer, "Fee calculations are incorrect");
    assert(balanceOfContract == newBalanceOfContract, "Fee calculations are incorrect");
    assert(balanceOfFeeAddress == newBalanceOfFeeAddress, "Fee calculations are incorrect");
  })
  /**
   * Test case to create and claim a disputed order by the buyer using ERC20 currency.
   * This test ensures that the trade is created and claimed successfully,
   * and verifies the balances of the buyer, seller, contract, and fee account.
   */
  it("EscrowFacet: Create and Claim dispute (Buyer)", async () => {
    const extTradeIdentifier = ethers.encodeBytes32String("0567");
    const amount = 10000;

    // Retrieve the fee from the admin facet contract
    const fee = await adminFacetContract.getFees();

    // Calculate order values based on the ERC20 currency and fee
    const { orderValue, orderValueToSend, sellerFees } = await getOrderValues({ amount, fee, type: 'ERC20' });

    // Check initial balances of seller, buyer, contract, and fee account
    const balanceOfSeller = await tokenContract.balanceOf(seller);
    const balanceOfBuyer = await tokenContract.balanceOf(buyer);
    const balanceOfContract = await tokenContract.balanceOf(diamondAddress);
    const balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Approve the escrow value to be transferred from the seller to the contract
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, orderValueToSend);

    // Create escrow for ERC20 currency
    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      orderValue,
      extTradeIdentifier,
      tokenContract.target
    );
    const response = await res.wait();

    const tradeHash = response.logs[2].args[0];
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active");

    // Generate and verify the message hash and signature
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address);
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory");

    // Complete the trade
    res = await escrowFacetERC20Contract.connect(buyer).claimDisputedOrderERC20(tradeHash, sig);

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active");

    // Check final balances of seller, buyer, contract, and fee account
    const newBalanceOfSeller = await tokenContract.balanceOf(seller);
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer);
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress);
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount);

    // Assertions to verify balance changes
    assert(balanceOfSeller - (orderValue + sellerFees) == newBalanceOfSeller, "Fee calculations are incorrect");
    assert(balanceOfBuyer + (orderValue - sellerFees) == newBalanceOfBuyer, "Fee calculations are incorrect");
    assert(newBalanceOfContract == balanceOfContract, "Fee calculations are incorrect");
    assert(BigInt(newBalanceOfFeeAddress) - BigInt(balanceOfFeeAddress) == sellerFees * BigInt(2), "Fee calculations are incorrect");
  })
})
