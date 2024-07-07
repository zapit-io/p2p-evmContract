const { deployDiamond } = require('../scripts/deploy.js')
const { deployFacets } = require('../scripts/deployFacets.js');
const { deployToken } = require('../scripts/deployToken.js')
import { assert, expect } from 'chai'
import { ZeroAddress } from "ethers"
import { ethers } from "hardhat";


describe('Tests', async function () {
  let adminFacetContract: any,
    buyer: any,
    deployer: any,
    arbitrator: any,
    diamondAddress: any,
    diamondInitAddr: any,
    diamondInitContract: any,
    escrowFacet: any,
    escrowFacetERC20Contract: any,
    FEES: any,
    feeAccount: any,
    ownershipFacetContract: any,
    secondaryDeployer: any,
    seller: any,
    tokenContract: any;

  const ETHERS_VALUE = 100000;
  const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)
  const adminRoleBytes32 = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));

  before(async function () {
    [deployer, arbitrator, buyer, seller, feeAccount, secondaryDeployer] = await ethers.getSigners();

    let deployedCoreContracts = await deployDiamond()
    diamondAddress = deployedCoreContracts['diamondAddr']
    diamondInitAddr = deployedCoreContracts['diamondInitAddr']

    await deployFacets({ ...deployedCoreContracts, feeAddress: feeAccount.address })

    escrowFacet = await ethers.getContractAt('EscrowFacet', diamondAddress)
    escrowFacetERC20Contract = await ethers.getContractAt('EscrowFacetERC20', diamondAddress)
    ownershipFacetContract = await ethers.getContractAt('OwnershipFacet', diamondAddress)
    adminFacetContract = await ethers.getContractAt('AdminFacet', diamondAddress)
    diamondInitContract = await ethers.getContractAt('DiamondInit', diamondInitAddr)

    // Mint some tokens to be used later on to deal with ERC20 tokens
    tokenContract = await deployToken()
    await tokenContract.mint(deployer.address, ESCROW_VALUE)
    await tokenContract.mint(buyer.address, ESCROW_VALUE)
    await tokenContract.mint(seller.address, ESCROW_VALUE)
  })

  it("ADMIN: [OWNERSHIP] Should fetch and verify the ownership of the contract", async () => {
    let res = await ownershipFacetContract.owner()
    assert.equal(res, deployer.address)
  })

  it("ADMIN: [OWNERSHIP] Should transfer ownership to account[1] i.e arbitrator", async () => {
    await ownershipFacetContract.transferOwnership(secondaryDeployer.address)
    let res = await ownershipFacetContract.owner()
    assert.equal(res, secondaryDeployer.address)
  })

  it("ADMIN: [OWNERSHIP] Should transfer ownership back to account[0] i.e deployer", async () => {
    await ownershipFacetContract.connect(secondaryDeployer).transferOwnership(deployer.address)
    let res = await adminFacetContract.getArbitrator()
    assert.equal(res, deployer.address)
  })

  it("ADMIN: [ARBITER] Should verify the arbiter", async () => {
    let res = await adminFacetContract.getArbitrator()
    assert.equal(res, deployer.address)
    await adminFacetContract.setArbitrator(arbitrator.address)
    res = await adminFacetContract.getArbitrator()
    assert.equal(res, arbitrator.address)
  })

  it("ADMIN: [FEE ADDRESS] Should fetch the default market fee address", async () => {
    let res = await adminFacetContract.getFeeAddress()
    assert.equal(res, feeAccount.address)
  })

  it("ADMIN: [FEE ADDRESS] SET+GET Should set and fetch the default market fee address", async () => {
    await adminFacetContract.setFeeAddress(feeAccount.address)
    let res = await adminFacetContract.getFeeAddress()
    assert.equal(res, feeAccount.address)
  })

  it("ADMIN: [Fees] Should fetch the market fee set", async () => {
    let res = await adminFacetContract.getFees()
    FEES = parseFloat(res)
    assert.equal(FEES, 100)
  })

  it("ADMIN: [PAUSABLE] Market should not be paused initially", async () => {
    let res = await adminFacetContract.paused()
    assert(res == false)
  })

  it("ADMIN: [ROLE] Check deployer hasRole", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, deployer.address)
    assert(hasRoleSet == true)
  })

  it("ADMIN: [ROLE] secondaryDeployer hasRole must be false", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address)
    assert(hasRoleSet == false)
  })

  it("ADMIN: [ROLE] Grant Role to secondaryDeployer", async () => {
    await adminFacetContract.grantRole(adminRoleBytes32, secondaryDeployer.address);
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address)
    assert(hasRoleSet == true)
  })

  it("ADMIN: [ROLE] secondaryDeployer hasRole must be true", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address)
    assert(hasRoleSet == true)
  })

  it("ADMIN: [ROLE] secondaryDeployer must be able to pause and unpause the market", async () => {
    await adminFacetContract.connect(secondaryDeployer).pause()
    let res = await adminFacetContract.paused()
    assert(res == true)
    await adminFacetContract.unpause()
    res = await adminFacetContract.paused()
    assert(res == false)
  })

  it("ADMIN: [ROLE] Revert Unauthorized Grant Role invocation from non admin account", async () => {
    await expect(
      adminFacetContract.connect(arbitrator).grantRole(adminRoleBytes32, deployer.address)
    ).to.be.revertedWithCustomError(
      adminFacetContract,
      "AccessControlUnauthorizedAccount"
    ).withArgs(arbitrator.address, adminRoleBytes32);
  })

  it("ADMIN: [ROLE] Revoke Role", async () => {
    await adminFacetContract.revokeRole(adminRoleBytes32, secondaryDeployer.address);
  })

  it("ADMIN: [ROLE] secondaryDeployer hasRole must be false", async () => {
    const hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address)
    assert(hasRoleSet == false)
  })

  it("ADMIN: [ROLE] Assign role to secondaryDeployer and it must renounce the Role", async () => {
    await adminFacetContract.grantRole(adminRoleBytes32, secondaryDeployer.address);
    let hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address)
    assert(hasRoleSet == true)

    await adminFacetContract.connect(secondaryDeployer).renounceRole(adminRoleBytes32, secondaryDeployer.address);
    hasRoleSet = await adminFacetContract.hasRole(adminRoleBytes32, secondaryDeployer.address)
    assert(hasRoleSet == false)
  })

  it("CORE: [DimaondInit] Should not be able to execute as it can only be called by the owner", async () => {
    await expect(
      diamondInitContract.init(feeAccount.address, FEES)
    ).to.be.revertedWith(
      `LibDiamond: Must be contract owner`
    );
  })

  it("CORE: [DimaondInit] 0th storage slot must be owner for diamind and address(0) for diamond init", async () => {
    let storageSlot = await ethers.provider.getStorage(diamondInitAddr, 0);
    console.log(storageSlot)
    storageSlot = await ethers.provider.getStorage(diamondAddress, 0);
    console.log(storageSlot)
    console.log(deployer.address)

    // const _storageSlot = ethers.keccak256(ethers.toUtf8Bytes("diamond.standard.diamond.storage"));
    // console.log(_storageSlot)
    // const storageSlotNumber = BigNumber.from(storageSlot).toString();
    // console.log(storageSlotNumber)
    // storageSlot = await ethers.provider.getStorage(diamondAddress, storageSlotNumber);
    // console.log(storageSlot)

  })

  it("ADMIN [PAUSABLE] Should pause the market", async () => {
    await adminFacetContract.pause()
    let res = await adminFacetContract.paused()
    assert(res == true)
  })

  it("PAUSABLE: Fail to create order due to paused contract", async () => {
    try {
      const EXT_TRADE_RANDOM = ethers.encodeBytes32String("x-0234");
      const ETHERS_VALUE = 10000;
      const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

      const ETHERS_VALUE_TO_APPROVE = ETHERS_VALUE * 2
      const ESCROW_VALUE_TO_APPROVE = ethers.parseUnits(ETHERS_VALUE_TO_APPROVE.toString(), 0)
      await tokenContract.connect(seller).increaseAllowance(diamondAddress, ESCROW_VALUE_TO_APPROVE)

      await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
        buyer.address,
        ESCROW_VALUE,
        EXT_TRADE_RANDOM,
        tokenContract.target
      )
    } catch (e) {
      // @ts-ignore
      assert(e?.message.includes('Pausable: paused') == true)
    }
  })

  it("PAUSABLE: Should unpause the market", async () => {
    await adminFacetContract.unpause()
    let res = await adminFacetContract.paused()
    assert(res == false)
  })

  it("WHITELIST: Fail to create order as currency is not whitelisted", async () => {
    try {
      const EXT_TRADE_RANDOM = ethers.encodeBytes32String("x-0234");
      const ETHERS_VALUE = 10000;
      const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

      const ETHERS_VALUE_TO_APPROVE = ETHERS_VALUE * 2
      const ESCROW_VALUE_TO_APPROVE = ethers.parseUnits(ETHERS_VALUE_TO_APPROVE.toString(), 0)
      await tokenContract.connect(seller).increaseAllowance(diamondAddress, ESCROW_VALUE_TO_APPROVE)

      await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
        buyer.address,
        ESCROW_VALUE,
        EXT_TRADE_RANDOM,
        tokenContract.target
      )
    } catch (e) {
      // @ts-ignore
      assert(e?.message.includes('CurrencyNotWhitelisted') == true)
    }
  })

  it("WHITELIST: Whitelist base currency", async () => {
    await adminFacetContract.setWhitelistedCurrencies(ZeroAddress, true)
    await adminFacetContract.setWhitelistedCurrencies(tokenContract.target, true)

    let res = await adminFacetContract.getWhitelistedCurrencies(ZeroAddress)
    assert(res == true)
    res = await adminFacetContract.getWhitelistedCurrencies(tokenContract.target)
    assert(res == true)
  })

  it("EscrowFacet: Create and Complete Native currency trade", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("123");
    const ETHERS_VALUE = 1000;

    const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
    const ESCROW_TOTAL_VALUE = ethers.parseEther(
      `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`)


    // Check funds of buyer, seller and fee address
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceBefore,
    //   buyerBalanceBefore,
    //   feeAccountBalanceBefore
    // })

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(seller).executeOrder(tradeHash, sig)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")


    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceAfter,
    //   buyerBalanceAfter,
    //   feeAccountBalanceAfter
    // })
  })

  it("EscrowFacet: Create and Cancel order", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("234");
    const ETHERS_VALUE = 1;

    const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
    const ESCROW_TOTAL_VALUE = ethers.parseEther(
      `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`)

    // Check funds of buyer, seller and fee address
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceBefore,
    //   buyerBalanceBefore,
    //   feeAccountBalanceBefore
    // })

    let res = await escrowFacet.createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // Complete the trade
    res = await escrowFacet.connect(buyer).buyerCancel(tradeHash)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceAfter,
    //   buyerBalanceAfter,
    //   feeAccountBalanceAfter
    // })
  })

  it("EscrowFacet: Create and Claim dispute (Buyer)", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("345");
    const ETHERS_VALUE = 1;

    const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
    const ESCROW_TOTAL_VALUE = ethers.parseEther(
      `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`)

    // Check funds of buyer, seller and fee address
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceBefore,
    //   buyerBalanceBefore,
    //   feeAccountBalanceBefore
    // })

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")


    // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(buyer).claimDisputedOrder(tradeHash, sig)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceAfter,
    //   buyerBalanceAfter,
    //   feeAccountBalanceAfter
    // })
  })

  it("EscrowFacet: Create and Claim dispute (Seller)", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("456");
    const ETHERS_VALUE = 1;

    const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
    const ESCROW_TOTAL_VALUE = ethers.parseEther(
      `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`)


    // Check funds of buyer, seller and fee address
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address)
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceBefore = await ethers.provider.getBalance(feeAccount.address)

    // console.log({
    //   sellerBalanceBefore,
    //   buyerBalanceBefore,
    //   feeAccountBalanceBefore
    // })

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // escrowFacet.
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

    // console.log({
    //   sellerBalanceAfter,
    //   buyerBalanceAfter,
    //   feeAccountBalanceAfter
    // })
  })

  it("EscrowFacetERC20Contract: Create and Complete Native currency trade", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("0123");
    const ETHERS_VALUE = 10000;
    const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

    const feePerParty = BigInt(ETHERS_VALUE * 0.005)

    const ETHERS_VALUE_TO_APPROVE = ETHERS_VALUE * 2
    const ESCROW_VALUE_TO_APPROVE = ethers.parseUnits(ETHERS_VALUE_TO_APPROVE.toString(), 0)

    const balanceOfSeller = await tokenContract.balanceOf(seller)
    const balanceOfBuyer = await tokenContract.balanceOf(buyer)
    const balanceOfContract = await tokenContract.balanceOf(diamondAddress)
    const balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    await tokenContract.connect(seller).increaseAllowance(diamondAddress, ESCROW_VALUE_TO_APPROVE)

    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      ESCROW_VALUE,
      EXT_TRADE_RANDOM,
      tokenContract.target
    )

    const response = await res.wait()

    const tradeHash = response.logs[2].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacetERC20Contract.connect(seller).executeOrderERC20(tradeHash, sig)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")


    const newBalanceOfSeller = await tokenContract.balanceOf(seller)
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer)
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress)
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    assert(balanceOfSeller - (ESCROW_VALUE + feePerParty) == newBalanceOfSeller, "Fee calculations are incorrect")
    assert(balanceOfBuyer + (ESCROW_VALUE - feePerParty) == newBalanceOfBuyer, "Fee calculations are incorrect")
    assert(newBalanceOfContract == balanceOfContract, "Fee calculations are incorrect")
    assert(balanceOfFeeAddress + (feePerParty + feePerParty) == newBalanceOfFeeAddress, "Fee calculations are incorrect")
  })

  it("EscrowFacet: Create and Cancel order", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("0234");
    const ETHERS_VALUE = 10000;
    const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

    const feePerParty = BigInt(ETHERS_VALUE * 0.005)

    const ETHERS_VALUE_TO_APPROVE = ETHERS_VALUE * 2
    const ESCROW_VALUE_TO_APPROVE = ethers.parseUnits(ETHERS_VALUE_TO_APPROVE.toString(), 0)
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, ESCROW_VALUE_TO_APPROVE)

    let balanceOfSeller = await tokenContract.balanceOf(seller)
    let balanceOfBuyer = await tokenContract.balanceOf(buyer)
    let balanceOfContract = await tokenContract.balanceOf(diamondAddress)
    let balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      ESCROW_VALUE,
      EXT_TRADE_RANDOM,
      tokenContract.target
    )

    const response = await res.wait()

    const tradeHash = response.logs[2].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // Buyer cancels the trade
    res = await escrowFacetERC20Contract.connect(buyer).buyerCancelERC20(tradeHash)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    const newBalanceOfSeller = await tokenContract.balanceOf(seller)
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer)
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress)
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    assert(balanceOfSeller == newBalanceOfSeller, "Fee calculations are incorrect")
    assert(balanceOfBuyer == newBalanceOfBuyer, "Fee calculations are incorrect")
    assert(balanceOfContract == newBalanceOfContract, "Fee calculations are incorrect")
    assert(balanceOfFeeAddress == newBalanceOfFeeAddress, "Fee calculations are incorrect")
  })

  it("EscrowFacet: Create and Claim dispute (Seller)", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("0456");
    const ETHERS_VALUE = 10000;
    const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

    const feePerParty = BigInt(ETHERS_VALUE * 0.005)

    const ETHERS_VALUE_TO_APPROVE = ETHERS_VALUE * 2
    const ESCROW_VALUE_TO_APPROVE = ethers.parseUnits(ETHERS_VALUE_TO_APPROVE.toString(), 0)

    let balanceOfSeller = await tokenContract.balanceOf(seller)
    let balanceOfBuyer = await tokenContract.balanceOf(buyer)
    let balanceOfContract = await tokenContract.balanceOf(diamondAddress)
    let balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, ESCROW_VALUE_TO_APPROVE)

    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      ESCROW_VALUE,
      EXT_TRADE_RANDOM,
      tokenContract.target
    )
    const response = await res.wait()

    const tradeHash = response.logs[2].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, seller.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacetERC20Contract.connect(seller).claimDisputedOrderERC20(tradeHash, sig)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    const newBalanceOfSeller = await tokenContract.balanceOf(seller)
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer)
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress)
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    assert(balanceOfSeller == newBalanceOfSeller, "Fee calculations are incorrect")
    assert(balanceOfBuyer == newBalanceOfBuyer, "Fee calculations are incorrect")
    assert(balanceOfContract == newBalanceOfContract, "Fee calculations are incorrect")
    assert(balanceOfFeeAddress == newBalanceOfFeeAddress, "Fee calculations are incorrect")

  })

  it("EscrowFacet: Create and Claim dispute (Buyer)", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("0567");
    const ETHERS_VALUE = 10000;
    const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

    const feePerParty = BigInt(ETHERS_VALUE * 0.005)

    const ETHERS_VALUE_TO_APPROVE = ETHERS_VALUE * 2
    const ESCROW_VALUE_TO_APPROVE = ethers.parseUnits(ETHERS_VALUE_TO_APPROVE.toString(), 0)

    let balanceOfSeller = await tokenContract.balanceOf(seller)
    let balanceOfBuyer = await tokenContract.balanceOf(buyer)
    let balanceOfContract = await tokenContract.balanceOf(diamondAddress)
    let balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)
    await tokenContract.connect(seller).increaseAllowance(diamondAddress, ESCROW_VALUE_TO_APPROVE)

    let res = await escrowFacetERC20Contract.connect(seller).createEscrowERC20(
      buyer.address,
      ESCROW_VALUE,
      EXT_TRADE_RANDOM,
      tokenContract.target
    )
    const response = await res.wait()

    const tradeHash = response.logs[2].args[0]
    let escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacetERC20Contract.connect(buyer).claimDisputedOrderERC20(tradeHash, sig)

    escrowStruct = await adminFacetContract.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    const newBalanceOfSeller = await tokenContract.balanceOf(seller)
    const newBalanceOfBuyer = await tokenContract.balanceOf(buyer)
    const newBalanceOfContract = await tokenContract.balanceOf(diamondAddress)
    const newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    assert(balanceOfSeller - (ESCROW_VALUE + feePerParty) == newBalanceOfSeller, "Fee calculations are incorrect")
    assert(balanceOfBuyer + (ESCROW_VALUE - feePerParty) == newBalanceOfBuyer, "Fee calculations are incorrect")
    assert(newBalanceOfContract == balanceOfContract, "Fee calculations are incorrect")
    assert(balanceOfFeeAddress + (feePerParty + feePerParty) == newBalanceOfFeeAddress, "Fee calculations are incorrect")

  })

})
