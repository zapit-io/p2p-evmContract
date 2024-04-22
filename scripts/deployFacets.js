const { ethers } = require('hardhat')
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')

// Polygon
const P2PEscrowAddress = '0x095876F31b07C91d92E1C6414169f2e252789D0d'
const AdminFacetAddress = '0x4aDC11C8e2418aB07D7931A41d48EC102C1DBDeE'

async function main(params) {

  let diamondAddr = params.diamondAddr
  let diamondInitAddr = params.diamondInitAddr

  // deploy facets
  console.log('')
  console.log('Deploying facets')

  // ----------------
  // When new contract needs to be deployed
  // ----------------

  const FacetNames = [
    'P2PEscrow',
    'AdminFacet'
  ]

  const cut = []
  for (const FacetName of FacetNames) {
    let Facet, facet

    if (FacetName == 'P2PEscrow') {
      const Library = await ethers.getContractFactory("Signature");
      const library = await Library.deploy();
      console.log('Signature Librarary deployed: ', library.target)

      facet = await ethers.deployContract(FacetName, {
        libraries: {
          Signature: library.target,
        }
      });
      console.log('Facet: ', FacetName, 'deployed at: ', facet.target)
    } else {
      facet = await ethers.deployContract(FacetName);
      console.log('Facet: ', FacetName, 'deployed at: ', facet.target)
    }

    cut.push({
      facetAddress: facet.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // ----------------
  // When contracts are already deployed
  // ----------------
  // const cut = []

  // const FacetNamesObj = {
  //   'P2PEscrow': P2PEscrowAddress,
  //   'AdminFacet': AdminFacetAddress
  // }

  // for (const [name, address] of Object.entries(FacetNamesObj)) {
  //   const facet = await ethers.getContractAt(name, address)
  //   cut.push({
  //     facetAddress: facet.target,
  //     action: FacetCutAction.Add,
  //     functionSelectors: getSelectors(facet)
  //   })
  // }

  try {

    console.log('diamondInitAddr: ', diamondInitAddr)
    const diamondInit = await ethers.getContractAt('DiamondInit', diamondInitAddr)
    const accounts = await ethers.getSigners()
    const feeAddress = accounts[4].address

    console.log('feeAddress: ', feeAddress)
    console.log('diamondInit', diamondInit)
    console.log('diamondInit address', diamondInit.target)

    // return

    // call to init function
    let functionCall = diamondInit.interface.encodeFunctionData(
      'init',
      [feeAddress, 100]
    )

    const diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddr)

    const result = await diamondCutFacet.diamondCut(
      cut,
      diamondInit.target,
      functionCall
    )
    console.log('Upgrade transaction hash: ' + result.hash)
    return result
  } catch (e) {
    console.log("Error: ", e)
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {

  // Polygon
  const deployedAddress = '0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3' // Diamond
  const diamondInit = '0x3A8dbfa87f2940C1307C289dA836423653D67201'

  main({ diamondAddr: deployedAddress, diamondInitAddr: diamondInit })
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}


exports.deployFacets = main
// exports.deployFacets = deployFacets