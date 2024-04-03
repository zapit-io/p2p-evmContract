// import { HardhatUserConfig } from "hardhat/config";
// // import "@nomicfoundation/hardhat-toolbox";
// import "@openzeppelin/hardhat-upgrades";
// import "hardhat-gas-reporter";
// import "@nomicfoundation/hardhat-verify";
// import "@nomiclabs/hardhat-web3";
// import dotenv from "dotenv";
// dotenv.config();

// const config: HardhatUserConfig = {
//   solidity: '0.8.4',
//   gasReporter: {
//     enabled: true,
//     settings: {
//       optimizer: {
//         enabled: true,
//         runs: 1000
//       }
//     }
//   },
//   gasReporter: {
//     enabled: true,
//     currency: "USD",
//     gasPrice: 21,
//   },
//   networks: {

//   },
//   // etherscan: {
//   //   apiKey: {
//   //     polygonMumbai: process.env.POLYGON_API_KEY!,
//   //   },
//   // },
// };

// export default config;


/* global ethers task */
require('@nomiclabs/hardhat-waffle')
require('solidity-coverage')
require("hardhat-gas-reporter");
require('dotenv').config()

let taskName = process.argv[2]

if (taskName == 'coverage') {
  require("./tasks/ignoreContracts.js");
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// const privateKey = '';

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.8.4',
  gasReporter: {
    enabled: true,
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000
      }
    }
  },
  networks: {
    polygon: {
      // url: `https://polygon-mainnet.g.alchemy.com/v2/dO9QKkdy0B2nQ4DZVVal7aERxt0kKEUW`,
      url: `https://polygon-mainnet.g.alchemy.com/v2/9OBY09nGJOsrK1JzrpfPK2JsV8oIQVup`,
      chainId: 137,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        count: 6,
      },
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.com/v2/ji7Gf_GEBEgvLHWomaRf-Y1UPvIj2o1i`,
      chainId: 80001,
      // url: "https://rpc-mumbai.maticvigil.com",
      accounts: {
        mnemonic: process.env.MNEMONIC,
        count: 6,
      },
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000
    }
  }
}
