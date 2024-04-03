/* global describe it before ethers */

const {
  getSelectors,
  FacetCutAction,
  removeSelectors,
  findAddressPositionInFacets
} = require('../scripts/libraries/diamond.js')

const { deployDiamond } = require('../scripts/deploy.js')
const { deployFacets } = require('../scripts/deployFacets.js');

const { assert } = require('chai')
const { ethers } = require('hardhat')


describe('Tests', async function () {
  let diamondAddress
  let diamondCutFacet
  let diamondLoupeFacet
  let ownershipFacet
  let accounts
  let deployer, arbitrator, buyer, seller

  const FEES = 100; // 1%
  const PAYMENT_WINDOW = 600; // 10 minutes
  const ETHERS_VALUE = 1;
  const ESCROW_VALUE = ethers.utils.parseEther(ETHERS_VALUE.toString());
  const ESCROW_TOTAL_VALUE = ethers.utils.parseEther(
    `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`
  ); //  calculated after seller sent their 50% of the fees
  const TRADE_ID =
    "0x808c20ef09149650b29fbae1cc74c8cae292164efe69529e23749d3642bcff7a"; // replace this value the hardhat value that's returned from the contract (it'll be dynamic everytime for tests);

  const EXT_TRADE_RANDOM = ethers.utils.formatBytes32String("123");

  // parseBytes32String

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

  it("P2PEscrow: Create Native contract", async () => {
    const res = await escrowFacet.createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
      value: ESCROW_TOTAL_VALUE,
    });
    console.log(res)
  })


})
