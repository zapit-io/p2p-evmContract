const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const diamond = require('./helpers');
const { ethers } = require('hardhat');

async function estimatedGas() {
  // const cf = await ethers.getContractFactory('DiamondCutFacet')
  const cf = await ethers.getContractFactory('AdminFacet')

  const gdt = await cf.getDeployTransaction()

  const deployTransaction = {
    data: gdt.data // The bytecode of the contract
  };

  const fee = await ethers.provider.estimateGas(deployTransaction)
  console.log("Estimated gas:", fee.toString());

  const gasPrice = await ethers.provider.getFeeData()
  console.log('gasPrice: ', gasPrice)
  // console.log("Current gas price:", ethers.parseUnits(gasPrice.gasPrice.toString(), "gwei"));

  // Convert gas to Ether
  // const gasCostWei = estimatedGas.mul(gasPrice);
  const gasInWei = fee * gasPrice.gasPrice

  const gasCostEther = ethers.parseEther(gasInWei.toString());

  console.log("Estimated gas cost in Ether:", gasCostEther);

}


async function main() {
  const accounts = await ethers.getSigners()
  const contractOwner = accounts[0]

  // const diamondCutFacet = await ethers.deployContract("DiamondCutFacet");
  // console.log(`const diamondCutFacet = '${diamondCutFacet.target}'`)

  const diamond = await ethers.deployContract("Diamond", [contractOwner.address]);
  console.log(`const diamond = '${diamond.target}'`)

  const diamondInit = await ethers.deployContract("DiamondInit");
  console.log(`const diamondInit = '${diamondInit.target}'`)

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
