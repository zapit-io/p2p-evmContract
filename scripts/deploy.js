const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const diamond = require('./helpers');


async function main() {
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]

  const diamondCutFacet = await ethers.deployContract("DiamondCutFacet");
  console.log('DiamondCutFacet deployed:', diamondCutFacet.target)

  const diamond = await ethers.deployContract("Diamond", [contractOwner.address]);
  console.log('Diamond deployed:', diamond.target)

  const diamondInit = await ethers.deployContract("DiamondInit");
  console.log('DiamondInit deployed:', diamondInit.target)


  // deploy Diamond
  // const Diamond = await ethers.getContractFactory('Diamond')
  // // const diamond = await Diamond.deploy(contractOwner.address, diamondCutFacet.address)
  // const diamond = await Diamond.deploy(await contractOwner.address)
  // // await diamond.deployed()
  // console.log('Diamond deployed:', await diamond.address)

  // deploy DiamondInit
  // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
  // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
  // const DiamondInit = await ethers.getContractFactory('DiamondInit')
  // const diamondInit = await DiamondInit.deploy()
  // await diamondInit.deployed()
  // console.log('DiamondInit deployed:', await diamondInit.target)

  return {
    'diamondAddr': await diamond.target,
    'diamondInitAddr': await diamondInit.target
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

exports.deployDiamond = main
