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
