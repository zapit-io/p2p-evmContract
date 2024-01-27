# P2P EVM Contract
Zapit's P2P EVM contracts

#### Test
To run all the tests: `npx hardhat test`

#### Contract Interactions

Deployment: `npx hardhat run scripts/deploy.ts --network mumbai`
Calling Contract methods: `npx hardhat run scripts/callMethods.ts --network mumbai`

### Supported Networks

Mainnet
- Ethereum
- Polygon

Testnet
- Mumbai

#### Deployed Addresses

- Mumbai: `0x1658dd2E903acc32400A88a40e7e5FB7267C36a9`
- Polygon: `0x0`
- Ethereum: `0x0`

#### Other commands

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
