# P2P EVM Contract
Zapit's P2P EVM contracts

#### Test
To run all the tests: `npx hardhat test`

#### Contract Interactions

Deployment: `npx hardhat run scripts/deploy.js --network polygon`
Deployment of facets: `npx hardhat run scripts/deployFacets.js --network polygon`
Calling Contract methods: `npx hardhat run scripts/callMethods.ts --network polygon`

### Supported Networks

Mainnet
- Ethereum
- Avalanche
- Polygon

### Polygon
```
DiamondCutFacet deployed: 0xc2EDC3ac51D82336b39B08C7E68201be69171113
Diamond deployed: 0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3
DiamondInit deployed: 0x3A8dbfa87f2940C1307C289dA836423653D67201
P2PEscrow Contract deployed: 0x095876F31b07C91d92E1C6414169f2e252789D0d
AdminFacet Contract deplpyed: 0x4aDC11C8e2418aB07D7931A41d48EC102C1DBDeE
```

#### Deployed Addresses

- Polygon: `0x0`
- Avalanche: `0x0`
- Ethereum: `0x0`

#### Other commands

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```
