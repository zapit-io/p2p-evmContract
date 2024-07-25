import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-gas-reporter";
import "@nomicfoundation/hardhat-verify";
import "@nomiclabs/hardhat-web3";
import dotenv from "dotenv";
dotenv.config();

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.8.24',
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
    ethereum: {
      url: `https://eth-mainnet.g.alchemy.com/v2/KjmigFHTC_UXoxQ32lfBw2oDX1RMR0AY`,
      chainId: 1,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        count: 6,
      },
    },
    polygon: {
      // url: `https://polygon-mainnet.g.alchemy.com/v2/dO9QKkdy0B2nQ4DZVVal7aERxt0kKEUW`,
      url: `https://polygon-mainnet.g.alchemy.com/v2/9OBY09nGJOsrK1JzrpfPK2JsV8oIQVup`,
      chainId: 137,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        count: 6,
      },
    },
    avalanche: {
      url: `https://api.avax.network/ext/bc/C/rpc`,
      chainId: 43114,
      accounts: {
        mnemonic: process.env.MNEMONIC,
        count: 6,
      },
      etherscan: {
        mainnet: {
          fuji: "avascan" // apiKey is not required, just set a placeholder
        },
      }
    },
  },
  etherscan: {
    apiKey: {
      avalanche: 'avascan' // Add your API key here
    }
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 1000
    }
  }
}
