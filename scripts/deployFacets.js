const { ethers } = require('hardhat')
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')

// Polygon
const EscrowFacet = '0x1b12b7235F0cc5D8892eA8c97Fefda4Ba9Bd6bDB'
const AdminFacet = '0xEabBC98c37C33Ba5D93DF44563AeC6fDBFeDFEb3'

// Avalanche

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
    // 'SignatureFacet',
    'EscrowFacet',
    'AdminFacet'
  ]

  const cut = []
  for (const FacetName of FacetNames) {
    let Facet, facet

    // if (FacetName == 'P2PEscrow') {
    //   const Library = await ethers.getContractFactory("Signature");
    //   const library = await Library.deploy();
    //   console.log('Signature Librarary deployed: ', library.target)

    //   facet = await ethers.deployContract(FacetName, {
    //     libraries: {
    //       Signature: library.target,
    //     }
    //   });
    //   console.log(`const ${FacetName} = '${facet.target}'`)
    // } else {
    facet = await ethers.deployContract(FacetName);

    console.log(`const ${FacetName} = '${facet.target}'`)
    // }

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
  //   'EscrowFacet': EscrowFacet,
  //   // 'AdminFacet': AdminFacet,
  // }

  // for (const [name, address] of Object.entries(FacetNamesObj)) {
  //   const facet = await ethers.getContractAt(name, address)
  //   cut.push({
  //     facetAddress: facet.target,
  //     action: FacetCutAction.Add,
  //     functionSelectors: getSelectors(facet)
  //   })
  // }

  // console.log(cut)

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

  // // Polygon
  const deployedAddress = '0x5E669953fFd4A07869a4ba954ee88c13568e0935' // Diamond
  const diamondInit = '0xB0F857Bdd7c72eff5B908f8B759b4d5cC720d977'

  // Avalanche
  // const deployedAddress = '0xc2EDC3ac51D82336b39B08C7E68201be69171113'
  // const diamondInit = '0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3'


  main({ diamondAddr: deployedAddress, diamondInitAddr: diamondInit })
    // main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}


exports.deployFacets = main
// exports.deployFacets = deployFacets