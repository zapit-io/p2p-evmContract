const { deployDiamond } = require('../scripts/deploy.js')
const { deployFacets } = require('../scripts/deployFacets.js');
const { deployToken } = require('../scripts/deployToken.js')
import { assert, expect } from 'chai'
import { ZeroAddress } from "ethers"
import { ethers } from "hardhat";


describe('Tests', async function () {
  let diamondAddress: any;
  let ownershipFacet: any;
  let accounts: any;
  let escrowFacet: any, escrowFacetERC20: any, adminFacet: any, tokenContract: any;
  let deployer: any, arbitrator: any, buyer: any, seller: any, feeAccount: any;
  let FEES: any;

  before(async function () {
    let res = await deployDiamond()
    diamondAddress = res['diamondAddr']

    console.log(res)

    await deployFacets(res)
    accounts = await ethers.getSigners()

    escrowFacet = await ethers.getContractAt('EscrowFacet', diamondAddress)

    // console.log('escrowFacet: ', escrowFacet)

    escrowFacetERC20 = await ethers.getContractAt('EscrowFacetERC20', diamondAddress)

    // console.log('escrowFacetERC20: ', escrowFacetERC20)

    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
    adminFacet = await ethers.getContractAt('AdminFacet', diamondAddress)
    // escrowFacet = await ethers.getContractAt('escrowFacet', diamondAddress)


    // Contracts are deployed using the first signer/account by default
    const [_deployer, _arbitrator, _buyer, _seller, _feeAccount] = await ethers.getSigners();
    deployer = _deployer
    arbitrator = _arbitrator
    buyer = _buyer
    seller = _seller
    feeAccount = _feeAccount

    const ETHERS_VALUE = 100000;
    const ESCROW_VALUE = ethers.parseUnits(ETHERS_VALUE.toString(), 0)

    tokenContract = await deployToken()

    await tokenContract.mint(deployer.address, ESCROW_VALUE)
    await tokenContract.mint(buyer.address, ESCROW_VALUE)
    await tokenContract.mint(seller.address, ESCROW_VALUE)

    // await tokenContract.connect(account1).transfer(account2.address, 1)
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
    await adminFacet.setWhitelistedCurrencies(tokenContract.target, true)

    let res = await adminFacet.getWhitelistedCurrencies(ZeroAddress)
    assert(res == true)
    res = await adminFacet.getWhitelistedCurrencies(tokenContract.target)
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
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(seller).executeOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
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
    console.log(response.logs[0].args)

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
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")


    // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(buyer).claimDisputedOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
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
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, seller.address)
    const sig = await arbitrator.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == arbitrator.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.connect(seller).claimDisputedOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
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

  it("EscrowFacetERC20: Create and Complete Native currency trade", async () => {
    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("0123");
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

    let res = await escrowFacetERC20.connect(seller).createEscrowERC20(
      buyer.address,
      ESCROW_VALUE,
      EXT_TRADE_RANDOM,
      tokenContract.target
    )

    const response = await res.wait()

    const tradeHash = response.logs[2].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // // escrowFacet.
    const messageHash = await escrowFacet.getMessageHash(tradeHash, buyer.address)
    const sig = await seller.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await escrowFacet.getEthSignedMessageHash(messageHash);
    const _signatory = await escrowFacet.recoverSigner(signedMessageHash, sig);

    assert(_signatory == seller.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacetERC20.connect(seller).executeOrderERC20(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")


    let newBalanceOfSeller = await tokenContract.balanceOf(seller)
    let newBalanceOfBuyer = await tokenContract.balanceOf(buyer)
    let newBalanceOfContract = await tokenContract.balanceOf(diamondAddress)
    let newBalanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

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

    let balanceOfSeller = await tokenContract.balanceOf(seller)
    let balanceOfBuyer = await tokenContract.balanceOf(buyer)
    let balanceOfContract = await tokenContract.balanceOf(diamondAddress)
    let balanceOfFeeAddress = await tokenContract.balanceOf(feeAccount)

    let res = await escrowFacetERC20.connect(seller).createEscrowERC20(
      buyer.address,
      ESCROW_VALUE,
      EXT_TRADE_RANDOM,
      tokenContract.target
    )

    const response = await res.wait()

    const tradeHash = response.logs[2].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // Complete the trade
    res = await escrowFacet.connect(buyer).buyerCancel(tradeHash)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")

  })

})
