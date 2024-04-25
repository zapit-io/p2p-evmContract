const { deployDiamond } = require('../scripts/deploy.js')
const { deployFacets } = require('../scripts/deployFacets.js');
import { assert, expect } from 'chai'
import { ZeroAddress } from "ethers"
import { ethers } from "hardhat";


describe('Tests', async function () {
  let diamondAddress: any;
  let ownershipFacet: any;
  let accounts: any;
  let escrowFacet: any, adminFacet: any, signatureFacet: any;
  let deployer: any, arbitrator: any, buyer: any, seller: any, feeAccount: any;
  let FEES: any;

  before(async function () {
    let res = await deployDiamond()
    diamondAddress = res['diamondAddr']

    await deployFacets(res)
    accounts = await ethers.getSigners()

    escrowFacet = await ethers.getContractAt('EscrowFacet', diamondAddress)
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
    adminFacet = await ethers.getContractAt('AdminFacet', diamondAddress)
    signatureFacet = await ethers.getContractAt('SignatureFacet', diamondAddress)

    // Contracts are deployed using the first signer/account by default
    const [_deployer, _arbitrator, _buyer, _seller, _feeAccount] = await ethers.getSigners();
    deployer = _deployer
    arbitrator = _arbitrator
    buyer = _buyer
    seller = _seller
    feeAccount = _feeAccount
  })

  it("ADMIN: OWNERSHIP: Should fetch the ownership of the contract", async () => {
    let res = await ownershipFacet.owner()
    assert.equal(res, accounts[0].address)
  })

  it("ADMIN: OWNERSHIP: Should transfer ownership to account[1]", async () => {
    await ownershipFacet.transferOwnership(accounts[1].address)
    let res = await ownershipFacet.owner()
    assert.equal(res, accounts[1].address)
  })

  it("ADMIN: OWNERSHIP: Should transfer ownership back to account[0]", async () => {
    await ownershipFacet.connect(accounts[1]).transferOwnership(accounts[0].address)
    let res = await adminFacet.getArbitrator()
    assert.equal(res, accounts[0].address)
  })

  it("ADMIN: ARBITER: Should verify the arbiter", async () => {
    let res = await adminFacet.getArbitrator()
    assert.equal(res, accounts[0].address)
    await adminFacet.setArbitrator(arbitrator.address)
    res = await adminFacet.getArbitrator()
    assert.equal(res, accounts[1].address)
  })

  it("ADMIN: FEE ADDRESS: Should fetch the default market fee address", async () => {
    let res = await adminFacet.getFeeAddress()
    assert.equal(res, feeAccount.address)
  })

  it("ADMIN: FEE ADDRESS: Should fetch the default market fee address", async () => {
    let res = await adminFacet.getFeeAddress()
    assert.equal(res, feeAccount.address)
  })

  it("ADMIN: FEE ADDRESS: SET+GET Should set and fetch the default market fee address", async () => {
    await adminFacet.setFeeAddress(feeAccount.address)
    let res = await adminFacet.getFeeAddress()
    assert.equal(res, feeAccount.address)
  })

  it("ADMIN: Fees: Should fetch the market fee set", async () => {
    let res = await adminFacet.getFees()
    FEES = parseFloat(res)
    assert.equal(FEES, 100)
  })

  it("ADMIN: PAUSABLE: Market should not be paused initially", async () => {
    let res = await adminFacet.paused()
    assert(res == false)
  })

  it("ADMIN: PAUSABLE: Should pause the market", async () => {
    await adminFacet.pause()
    let res = await adminFacet.paused()
    assert(res == true)
  })

  it("ADMIN: Whitelist base currency", async () => {
    await adminFacet.setWhitelistedCurrencies(ZeroAddress, true)
    let res = await adminFacet.getWhitelistedCurrencies(ZeroAddress)
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

    console.log({
      sellerBalanceBefore,
      buyerBalanceBefore,
      feeAccountBalanceBefore
    })

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // // escrowFacet.
    const messageHash = await signatureFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await signatureFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await signatureFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(seller).executeOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")


    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    console.log({
      sellerBalanceAfter,
      buyerBalanceAfter,
      feeAccountBalanceAfter
    })
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

    console.log({
      sellerBalanceBefore,
      buyerBalanceBefore,
      feeAccountBalanceBefore
    })

    let res = await escrowFacet.createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // Complete the trade
    res = await escrowFacet.connect(buyer).buyerCancel(tradeHash)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    console.log({
      sellerBalanceAfter,
      buyerBalanceAfter,
      feeAccountBalanceAfter
    })
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

    console.log({
      sellerBalanceBefore,
      buyerBalanceBefore,
      feeAccountBalanceBefore
    })

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")


    // escrowFacet.
    const messageHash = await signatureFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await signatureFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await signatureFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(buyer).claimDisputedOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    console.log({
      sellerBalanceAfter,
      buyerBalanceAfter,
      feeAccountBalanceAfter
    })
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

    console.log({
      sellerBalanceBefore,
      buyerBalanceBefore,
      feeAccountBalanceBefore
    })

    let res = await escrowFacet.connect(seller).createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // escrowFacet.
    const messageHash = await signatureFacet.getMessageHash(tradeHash, seller.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await signatureFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await signatureFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(seller).claimDisputedOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

    // Check funds of buyer, seller and fee address
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address)
    const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address)
    const feeAccountBalanceAfter = await ethers.provider.getBalance(feeAccount.address)

    console.log({
      sellerBalanceAfter,
      buyerBalanceAfter,
      feeAccountBalanceAfter
    })
  })

})
