const { ethers } = require('hardhat')
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')

async function deployFacets(params) {

  let diamondAddr = params.diamondAddr
  let diamondInitAddr = params.diamondInitAddr

  // deploy facets
  console.log('')
  console.log('Deploying facets')
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
      // await library.deployed();

      facet = await ethers.deployContract(FacetName, {
        libraries: {
          Signature: library.target,
        }
      });

      // // console.log(FacetName)
      // Facet = await ethers.getContractFactory(FacetName, {
      //   libraries: {
      //     Signature: library.target,
      //   }
      // })
      // facet = await Facet.deploy()
      // await facet.deployed()


    } else {
      // console.log(FacetName)
      facet = await ethers.deployContract(FacetName);

      // Facet = await ethers.getContractFactory(FacetName)
      // facet = await Facet.deploy()
      // await facet.deployed()
    }

    // console.log(`${FacetName} deployed: ${facet.address}`)
    cut.push({
      facetAddress: facet.target,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  try {
    const diamondInit = await ethers.getContractAt('DiamondInit', diamondInitAddr)
    const accounts = await ethers.getSigners()
    const feeAddress = accounts[3].address

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

exports.deployFacets = deployFacets