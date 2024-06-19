/* global ethers */
/* eslint prefer-const: "off" */

const { ethers } = require("hardhat")

async function main() {
  const token = await ethers.deployContract("Token",
    ["TestToken",
      "TT",
      0
    ]);
  console.log('Token deployed:', token.target)
  return token
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

exports.deployToken = main
