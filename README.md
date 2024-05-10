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

diamondCutFacet =  0x26C21884F6cD77A0a129852E73C88F2944405E88
diamond =  0x5E669953fFd4A07869a4ba954ee88c13568e0935
diamondInit =  0xB0F857Bdd7c72eff5B908f8B759b4d5cC720d977
P2PEscrow Contract deployed: 0x095876F31b07C91d92E1C6414169f2e252789D0d
AdminFacet Contract deplpyed: 0x4aDC11C8e2418aB07D7931A41d48EC102C1DBDeE
```

### Avalanche
```
DiamondCutFacet deployed: 0x4B2cD84D14720A6FFE23f9332B069E02860Cdc7b
Diamond deployed: 0xc2EDC3ac51D82336b39B08C7E68201be69171113
DiamondInit deployed: 0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3
SignatureFacet Contract deployed: '0x3A8dbfa87f2940C1307C289dA836423653D67201'
P2PEscrow Contract deployed: '0x47d8eB2497Fed7f6a28a6000dac18415112F9A94'
AdminFacet Contract deplpyed: '0x095876F31b07C91d92E1C6414169f2e252789D0d'
```

### Ethereum
```
DiamondCutFacet deployed: 0xF564D03eE63b79AB41653030C090582ebfFf887E
Diamond deployed: 0x5C3dD6b31d3a0DFAeAa0D21Dd9Ba3C9C7A1B4014
DiamondInit deployed: 0x942876460D7065bD748eDeAe32604Ad02577CA75
SignatureFacet Contract deployed: '0x4B2cD84D14720A6FFE23f9332B069E02860Cdc7b'
P2PEscrow Contract deployed: '0xc2EDC3ac51D82336b39B08C7E68201be69171113'
AdminFacet Contract deplpyed: '0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3'
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
