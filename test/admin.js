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

describe('ADMIN Test', async function () {
  let diamondAddress
  let diamondCutFacet
  let diamondLoupeFacet
  let ownershipFacet
  let accounts

  before(async function () {
    let res = await deployDiamond()
    diamondAddress = res['diamondAddr']
    await deployFacets(res)

    accounts = await ethers.getSigners()

    contractOwnerAddress = accounts[0].address
    testFeeAccountAddress = accounts[2].address
    feeAccount = accounts[3]
    feeAccountAddress = accounts[3].address

    diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)

    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamondAddress)
    adminFacet = await ethers.getContractAt('AdminFacet', diamondAddress)
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
    let res = await marketFacet.getFeeAddress()
    assert.equal(res, feeAccountAddress)
  })

  it("ADMIN: FEE ADDRESS: SET+GET Should set and fetch the default market fee address", async () => {
    await adminFacet.setFeeAddress(testFeeAccountAddress)
    let res = await marketFacet.getFeeAddress()
    assert.equal(res, testFeeAccountAddress)
  })

  it("ADMIN: PAUSABLE: Market should not be paused initially", async () => {
    let res = await marketFacet.paused()
    assert(res == false)
  })

  it("ADMIN: PAUSABLE: Should pause the market", async () => {
    await adminFacet.pause()
    let res = await marketFacet.paused()
    assert(res == true)
  })

})
