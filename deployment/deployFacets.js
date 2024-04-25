const { ethers } = require('hardhat')
const { getSelectors, FacetCutAction } = require('../scripts/libraries/diamond.js')

// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

// Paste here after deploying these from the testnet/deployDiamond.js using the following command
// npx hardhat run testnet/deployDiamond.js --network rinkeby

// --------------------------------------------------------------------------

// Dogechain
const diamondCutFacetAddr = '0x7Dcc38D51ed62BAB22740E50ebA121C1a16244b8'
const diamondAddr = '0xf27B9704a15fFe47818fD48660D952235e9C39aF'
const diamondInitAddr = '0xA39F586a9F4f68e43F0443A6E966eFe096eb8C88'

// --------------------------------------------------------------------------

async function main() {

  // Deploy facets
  const FacetNames = [
    // 'AdminFacet',
  ]

  const cut = []
  for (const FacetName of FacetNames) {
    console.log(FacetName)
    const Facet = await ethers.getContractFactory(FacetName)
    const facet = await Facet.deploy()
    await facet.deployed()

    console.log(`${FacetName} deployed: ${facet.address}`)
    cut.push({
      facetAddress: facet.address,
      action: FacetCutAction.Add,
      functionSelectors: getSelectors(facet)
    })
  }

  // If the above process fails then restart by replacing the addresses below with the new addresses

  // const FacetNamesObj = {
  // }
  // const cut = []
  // for (const FacetName of FacetNames) {
  //   console.log(FacetName)
  //   const facet = await ethers.getContractAt(FacetName, FacetNamesObj[FacetName])
  //   cut.push({
  //     facetAddress: FacetNamesObj[FacetName],
  //     action: FacetCutAction.Add,
  //     functionSelectors: getSelectors(facet)
  //   })
  // }

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

    console.log(cut)
    console.log(diamondInit.address)
    console.log(functionCall)

    const result = await diamondCutFacet.diamondCut(
      cut,
      diamondInitAddr,
      // diamondInit.address,
      functionCall,
      {
        gasLimit: 10000000
      }
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
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}


exports.deployFacets = main