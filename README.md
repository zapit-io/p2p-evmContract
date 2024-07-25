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
Diamond deployed: 0x5E669953fFd4A07869a4ba954ee88c13568e0935
```

### Avalanche
```
Diamond deployed: 0xc2EDC3ac51D82336b39B08C7E68201be69171113
```

### Ethereum
```
Diamond deployed: 0x5C3dD6b31d3a0DFAeAa0D21Dd9Ba3C9C7A1B4014
```

#### Other commands

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat run scripts/deploy.ts
```

#### Inspect diamond

https://louper.dev


#### Verify contracts

### Avalance
`npx hardhat verify --network avalanche 0xc2EDC3ac51D82336b39B08C7E68201be69171113 0xA53E13f5724DC9b6F4a576089Fa669de68F24D1D`

### Polygon

`npx hardhat verify --network polygon 0x5E669953fFd4A07869a4ba954ee88c13568e0935 0xA53E13f5724DC9b6F4a576089Fa669de68F24D1D`

### Ethereum

`npx hardhat verify --network ethereum 0x5C3dD6b31d3a0DFAeAa0D21Dd9Ba3C9C7A1B4014 0xA53E13f5724DC9b6F4a576089Fa669de68F24D1D`