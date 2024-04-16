
/* global describe it before ethers */

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')
const { deployDiamond } = require('../scripts/deploy.js')
const { deployFacets } = require('../scripts/deployFacets.js');
import { assert, expect } from 'chai'
import { ZeroAddress } from "ethers"
// import * as w from ethers
import { ethers } from "hardhat";
// console.log('ethers', w)


describe('Tests', async function () {
  let diamondAddress;
  let diamondCutFacet;
  let diamondLoupeFacet;
  let ownershipFacet: any;
  let contractOwnerAddress;
  let testFeeAccountAddress: any;
  let feeAccount: any;
  let feeAccountAddress: any;
  let accounts: any;
  let escrowFacet: any, adminFacet: any, signatureLib: any;
  let deployer: any, arbitrator, buyer: any, seller: any;

  const FEES = 100; // 1%
  const PAYMENT_WINDOW = 600; // 10 minutes
  const ETHERS_VALUE = 1;

  const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
  const ESCROW_TOTAL_VALUE = ethers.parseEther(
    `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`
  ); //  calculated after seller sent their 50% of the fees
  const TRADE_ID =
    "0x808c20ef09149650b29fbae1cc74c8cae292164efe69529e23749d3642bcff7a"; // replace this value the hardhat value that's returned from the contract (it'll be dynamic everytime for tests);

  const EXT_TRADE_RANDOM = ethers.encodeBytes32String("123");

  before(async function () {
    let res = await deployDiamond()
    diamondAddress = res['diamondAddr']

    await deployFacets(res)

    accounts = await ethers.getSigners()

    contractOwnerAddress = accounts[0].address
    testFeeAccountAddress = accounts[2].address
    feeAccount = accounts[3]
    feeAccountAddress = accounts[3].address

    escrowFacet = await ethers.getContractAt('P2PEscrow', diamondAddress)

    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)

    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
    adminFacet = await ethers.getContractAt('AdminFacet', diamondAddress)

    signatureLib = await ethers.deployContract('Signature')


    // Contracts are deployed using the first signer/account by default
    const [_deployer, _arbitrator, _buyer, _seller] = await ethers.getSigners();
    deployer = _deployer
    arbitrator = _arbitrator
    buyer = _buyer
    seller = _seller
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
    let res = await ownershipFacet.owner()
    assert.equal(res, accounts[0].address)
  })

  it("ADMIN: FEE ADDRESS: Should fetch the default market fee address", async () => {
    let res = await adminFacet.getFeeAddress()
    assert.equal(res, feeAccountAddress)
  })

  it("ADMIN: FEE ADDRESS: SET+GET Should set and fetch the default market fee address", async () => {
    await adminFacet.setFeeAddress(testFeeAccountAddress)
    let res = await adminFacet.getFeeAddress()
    assert.equal(res, testFeeAccountAddress)
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

  it("P2PEscrow: Create and Complete Native currency trade", async () => {
    let res = await escrowFacet.createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    })

    const response = await res.wait()
    const tradeHash = response.logs[0].args[0]
    let escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == true, "Escrow is not active")

    // // escrowFacet.
    const messageHash = await signatureLib.getMessageHash(tradeHash, buyer.address)
    const sig = await deployer.signMessage(ethers.getBytes(messageHash));
    const signedMessageHash = await signatureLib.getEthSignedMessageHash(messageHash);
    const _signatory = await signatureLib.recoverSigner(signedMessageHash, sig);

    assert(_signatory == deployer.address, "Invalid signatory")

    // Complete the trade
    res = await escrowFacet.executeOrder(tradeHash, sig)

    escrowStruct = await adminFacet.getEscrow(tradeHash);
    assert(escrowStruct[7] == false, "Escrow still active")
  })
})
