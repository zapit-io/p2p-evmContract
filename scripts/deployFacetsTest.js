const { ethers } = require('hardhat')
const { getSelectors, FacetCutAction } = require('./libraries/diamond.js')
const { ContractFactory } = require('ethers')

// Polygon
// const SignatureFacet = '0x74Bb5c1c3797aa5a2Cf9db386E662D733e23d11b'
// const EscrowFacet = '0x1b12b7235F0cc5D8892eA8c97Fefda4Ba9Bd6bDB'
// const AdminFacet = '0xEabBC98c37C33Ba5D93DF44563AeC6fDBFeDFEb3'
// const EscrowFacetERC20 = '0x2Da7073dcE1D18CD37694fBf3088e516A2082692'

// Avalanche
// const SignatureFacet = '0x3A8dbfa87f2940C1307C289dA836423653D67201'
// const EscrowFacet = '0x47d8eB2497Fed7f6a28a6000dac18415112F9A94'
// const AdminFacet = '0x095876F31b07C91d92E1C6414169f2e252789D0d'
// const EscrowFacetERC20 = '0xC7d8fe2AA68CF42204bAbD005655F4b461a549c5'

// Ethereum
// const SignatureFacet = '0x765ece317F3cf8CEd10f588226e3fd715932e0d2'
// const EscrowFacet = '0xc2EDC3ac51D82336b39B08C7E68201be69171113'
// const AdminFacet = '0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3'
// const EscrowFacetERC20 = '0x4aDC11C8e2418aB07D7931A41d48EC102C1DBDeE'

// Deploying facets
// const EscrowFacet = '0xC7d8fe2AA68CF42204bAbD005655F4b461a549c5'

async function main(params) {

  let diamondAddr = params.diamondAddr
  let diamondInitAddr = params.diamondInitAddr
  let feeAddress = params.feeAddress
  let facetNames = params.facetNames

  // deploy facets
  console.log('')
  console.log('Deploying facets')

  // ----------------
  // When new contract needs to be deployed
  // ----------------

  if (!facetNames) {
    facetNames = [
      'SignatureFacet',
      'AdminFacet',
      'EscrowFacetERC20',
      'EscrowFacet',
      'AccessControlFacet'
    ]
  }

  const selectorsToIgnore = []

  // // To be used when adding a new contract that uses signature facet's methods
  // const signatureFacet = await ethers.getContractAt('SignatureFacet', '0x74Bb5c1c3797aa5a2Cf9db386E662D733e23d11b')
  // const signatureFacetSelectors = getSelectors(signatureFacet, [])
  // for (const functions of signatureFacetSelectors) {
  //   selectorsToIgnore.push(functions)
  // }

  // const signatureFacetSelectors = getSelectors(signatureFacet, [])

  const cut = []

  // for (const FacetName of facetNames) {
  //   const facet = await ethers.deployContract(FacetName);

  //   console.log(`const ${FacetName} = '${facet.target}'`)
  //   const signatureFacetSelectors = getSelectors(facet, [])

  //   cut.push({
  //     facetAddress: facet.target,
  //     action: FacetCutAction.Add,
  //     functionSelectors: getSelectors(facet, selectorsToIgnore)
  //   })

  //   if (FacetName == 'SignatureFacet') {
  //     for (const functions of signatureFacetSelectors) {
  //       selectorsToIgnore.push(functions)
  //     }
  //   }

  // }

  // ----------------
  // When contracts are already deployed
  // ----------------

  const facetNamesObj = {
    // 'SignatureFacet': '0x765ece317F3cf8CEd10f588226e3fd715932e0d2',
    'EscrowFacet': '0xC7d8fe2AA68CF42204bAbD005655F4b461a549c5',
    // 'AdminFacet': AdminFacet,
    // 'EscrowFacetERC20': '0x4aDC11C8e2418aB07D7931A41d48EC102C1DBDeE'
  }

  for (const [name, address] of Object.entries(facetNamesObj)) {
    const facet = await ethers.getContractAt(name, address)
    const signatureFacetSelectors = getSelectors(facet, selectorsToIgnore)

    if (name == 'SignatureFacet') {
      for (const functions of signatureFacetSelectors) {
        selectorsToIgnore.push(functions)
      }
    } else {
      cut.push({
        facetAddress: facet.target,
        action: FacetCutAction.Add,
        functionSelectors: signatureFacetSelectors
      })
    }
  }

  console.log(cut, feeAddress)
  // return

  try {

    console.log('diamondInitAddr: ', diamondInitAddr)
    const diamondInit = await ethers.getContractAt('DiamondInit', diamondInitAddr)
    if (!feeAddress) {
      const accounts = await ethers.getSigners()
      feeAddress = accounts[4].address
    }

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
  const feeAddress = '0x274b3608f837f9102cCcC89Ed2312299e3FD9fE5'
  const facetNames = [
    // 'SignatureFacet',
    // 'AdminFacet',
    // 'EscrowFacetERC20',
    // 'EscrowFacet'
  ]

  // // Polygon
  // const deployedAddress = '0x5E669953fFd4A07869a4ba954ee88c13568e0935'
  // const diamondInit = '0xB0F857Bdd7c72eff5B908f8B759b4d5cC720d977'

  // // Avalanche
  // const deployedAddress = '0xc2EDC3ac51D82336b39B08C7E68201be69171113'
  // const diamondInit = '0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3'

  // Ethereum
  const deployedAddress = '0x5C3dD6b31d3a0DFAeAa0D21Dd9Ba3C9C7A1B4014'
  const diamondInit = '0x942876460D7065bD748eDeAe32604Ad02577CA75'


  main({ diamondAddr: deployedAddress, diamondInitAddr: diamondInit, feeAddress, facetNames })
    // main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}


exports.deployFacets = main
// exports.deployFacets = deployFacets

