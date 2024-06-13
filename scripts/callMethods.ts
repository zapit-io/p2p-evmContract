import { ethers } from "hardhat";
import { EscrowFacet, Diamond } from "../typechain-types";
import { ZeroAddress } from "ethers";


// Polygon
const diamondCutFacet = '0x26C21884F6cD77A0a129852E73C88F2944405E88'
const deployedAddress = '0x5E669953fFd4A07869a4ba954ee88c13568e0935'
const diamondInit = '0xB0F857Bdd7c72eff5B908f8B759b4d5cC720d977'

// Avalanche
// const diamondCutFacet = '0x4B2cD84D14720A6FFE23f9332B069E02860Cdc7b'
// const deployedAddress = '0xc2EDC3ac51D82336b39B08C7E68201be69171113'
// const diamondInit = '0x55729B845A77Eeba702C7d7f4A5eA5dC26BD06a3'

// Ethereum
// const diamondCutFacet = '0xF564D03eE63b79AB41653030C090582ebfFf887E'
// const deployedAddress = '0x5C3dD6b31d3a0DFAeAa0D21Dd9Ba3C9C7A1B4014'
// const diamondInit = '0x942876460D7065bD748eDeAe32604Ad02577CA75'


// ---------------------------------------------
// ---------------------------------------------

async function getOwner() {
  // const contract = await ethers.getContractAt("Diamond", deployedAddress);
  // return await contract.owner()
}

async function setArbitrator() {
  const contract = await ethers.getContractAt("AdminFacet", deployedAddress);
  return await contract.setArbitrator('0xA53E13f5724DC9b6F4a576089Fa669de68F24D1D')
}

async function setFeeAddress() {
  const contract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const res = await contract.getFeeAddress()
  console.log(res)
  // await contract.setFeeAddress('0x274b3608f837f9102cCcC89Ed2312299e3FD9fE5')
}

async function getArbitrator() {
  const contract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const arbitrator = await contract.getArbitrator()
  console.log(arbitrator)
}

async function escrowFee() {
  const contract = await ethers.getContractAt("AdminFacet", deployedAddress);
  return await contract.getFees()
}

async function getAllFunctionsInDiamond() {
  const diamondLoupe = await ethers.getContractAt('DiamondLoupeFacet', deployedAddress)
  let res = await diamondLoupe.facets()
  console.log(res)
}

async function signatureGeneration() {
  const accounts = await ethers.getSigners()
  console.log(accounts[0].address)

  const diamondLoupe = await ethers.getContractAt('DiamondLoupeFacet', deployedAddress)

  let res;
  res = await diamondLoupe.facets()
  console.log(res)

  // 0xa0daEef8BCb2aBB8Fdb010F5FC6Ef010615CAf6C

  const adminFacet = await ethers.getContractAt("AdminFacet", deployedAddress);
  const fee = await adminFacet.getFees()
  console.log(fee)

  // const signatureLibrary = await ethers.getContractAt("SignatureFacet", deployedAddress);
  // // const signatureLibrary = await ethers.getContractAt("Signature", '0xa0daEef8BCb2aBB8Fdb010F5FC6Ef010615CAf6C');

  // const tradeId = '0x8e8f9834e76773330cc3da647357246aeb62b00938647cad62f8e6b44df336d9'
  // const address = '0x743a2c5bf4ee9cc700dc9b797b128897cae7889c'
  // const _signature = await signatureLibrary.getMessageHash(tradeId, address)
  // console.log(_signature)

  return

  const signer = accounts[0]

  const MESSAGE = '65ca00dd2775f0503fc59eaf'

  // const messageHash = ethers.utils.hashMessage(message);



  // const hash = await contract.getMessageHash(tradeId, address);
  // const _signature = await signer.signMessage(MESSAGE);

  // console.log(_signature)

  // @ts-ignore
  const signature = await signer.signMessage(MESSAGE);
  // console.log(signature)

  // const messageHash = await signer.getMessageHash(MESSAGE);
  const messageHash = '0x2106e094e22b4d56b813af3a5b1301993bb5ba2156577e3553e635b785af7459'


  const sig = await signer.signMessage(ethers.getBytes(messageHash));
  console.log(sig)
  // await signature.connect(deployer).getEthSignedMessageHash(messageHash);

  // const validation = await signature
  //   .connect(deployer)
  //   .verify(deployer.address, MESSAGE, sig);

}

async function claimDisputed() {
  const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const p2pContract = await ethers.getContractAt("EscrowFacet", deployedAddress);
  const signatureLibrary = await ethers.getContractAt("Signature", deployedAddress);

  const tradeId = '0xd411c0d851a24877ba953a4b637b1728530f8057941c0f4d0a1e60d59ba9ec30'
  // const signature = '0x50bdeb79baece22352ec05a17fdd595fab76f71b84c1dd9984d8411d6ce4926638ef1200ac4f52b96a9a5e43177afdd2ee448c8bae6ca927b945864a0b17cb581b'

  const esc = await adminContract.getEscrow(tradeId)
  console.log(esc)
  console.log('tradeId: ', tradeId)

  const messageHash = await signatureLibrary.getMessageHash(tradeId, '0x743a2c5bf4ee9cc700dc9b797b128897cae7889c')
  console.log('messageHash: ', messageHash)

  const accounts = await ethers.getSigners()
  console.log(accounts[0])
  const signer = accounts[0]

  const signature = await signer.signMessage(ethers.getBytes(messageHash));

  console.log(signature)

  const result = await p2pContract.claimDisputedOrder(tradeId, signature)
  console.log(result)
}

async function cancelOrder() {
  const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const p2pContract = await ethers.getContractAt("EscrowFacet", deployedAddress);
  const signatureLibrary = await ethers.getContractAt("Signature", deployedAddress);

  const tradeId = '0x3fd5957aeb0f137db7c5072e9d1a5b07ad54f937fa5df0b0c6c4d01fa2d4955e'

  const esc = await adminContract.getEscrow(tradeId)
  console.log(esc)
  console.log('tradeId: ', tradeId)

  const accounts = await ethers.getSigners()
  console.log(accounts[0])


  const result = await p2pContract.buyerCancel(tradeId)
  console.log(result)
}

async function getEscrow() {
  const tradeId = '0xd3839ba717555d983cd8eb1452cdd0a3888d8679da3040d437b730774546ce9a'
  const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const esc = await adminContract.getEscrow(tradeId)
  console.log(esc)
}

async function executeOrder() {
  const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const p2pContract = await ethers.getContractAt("EscrowFacet", deployedAddress);
  const signatureLibrary = await ethers.getContractAt("SignatureFacet", deployedAddress);

  // This will be the mongoDB id based of present architecture of zapit
  // const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65ca00dd2775f0503fc59eaf");

  const tradeId = '0x04faeff11fe93c390df89fc32cf9ac05b35a9e46a247b71ca0e2810c7f62cba9'

  const esc = await adminContract.getEscrow(tradeId)
  console.log(esc)
  console.log('tradeId: ', tradeId)

  // const messageHash = await signatureLibrary.getMessageHash(tradeId, '0x4f7b8f0ecf10407fbf318feb9e9e886d1201fd9d')
  // console.log('messageHash: ', messageHash)

  // const accounts = await ethers.getSigners()
  // console.log(accounts[0])
  // const signer = accounts[0]

  // const signature = await signer.signMessage(ethers.getBytes(messageHash));

  // console.log(signature)
  // const result = await p2pContract.executeOrder(tradeId, signature)
  // console.log(result)

}


// async function createEscrowToken() {
//   const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);
//   const p2pContract = await ethers.getContractAt("EscrowFacet", deployedAddress);
//   const signatureLibrary = await ethers.getContractAt("Signature", deployedAddress);

//   // const [buyer] = await ethers.getSigners();
//   // const buyerAddress = buyer.address
//   const buyerAddress = '0x4f7b8f0ecf10407fbf318feb9e9e886d1201fd9d'

//   const FEES = 100; // 1%
//   const ETHERS_VALUE = 0.0001;
//   const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
//   const ESCROW_TOTAL_VALUE = ethers.parseEther(
//     `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`
//   ); //  calculated after seller sent their 50% of the fees

//   // This will be the mongoDB id based of present architecture of zapit
//   const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65e1943c7d200aff96ae5348");

//   console.log('EXT_TRADE_RANDOM: ', EXT_TRADE_RANDOM)

//   const result = await contract.createEscrowERC20(
//     buyerAddress,
//     ESCROW_VALUE,
//     '0x0F73cc99dE9bF6657C46B55fD666b82FcB9dbD2C',
//     EXT_TRADE_RANDOM
//   )

//   console.log(result)
// }

async function createEscrow() {

  const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);
  const p2pContract = await ethers.getContractAt("EscrowFacet", deployedAddress);
  const signatureLibrary = await ethers.getContractAt("SignatureFacet", deployedAddress);

  // const [buyer] = await ethers.getSigners();
  // const buyerAddress = buyer.address
  const buyerAddress = '0x4f7b8f0ecf10407fbf318feb9e9e886d1201fd9d'

  const FEES = 100; // 1%
  const ETHERS_VALUE = 0.0001;
  const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
  const ESCROW_TOTAL_VALUE = ethers.parseEther(
    `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`
  ); //  calculated after seller sent their 50% of the fees

  // This will be the mongoDB id based of present architecture of zapit
  const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65e0d3cb0b1f3229153b9f9c");

  console.log('EXT_TRADE_RANDOM: ', EXT_TRADE_RANDOM)

  // console.log()

  // const result = await p2pContract.createEscrowNative(buyerAddress, ESCROW_VALUE, EXT_TRADE_RANDOM, {
  //   value: ESCROW_TOTAL_VALUE,
  // })

  // console.log(result)
}

async function whitelistCurrency() {
  const adminContract = await ethers.getContractAt("AdminFacet", deployedAddress);

  const token = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' // MAINET
  // const token = '0x0F73cc99dE9bF6657C46B55fD666b82FcB9dbD2C' // TESTNET

  const res = await adminContract.getWhitelistedCurrencies(token)
  console.log(res)

  // const iswhitelisted = await adminContract.setWhitelistedCurrencies(token, true)
  // console.log(iswhitelisted)
  // await adminContract.setWhitelistedCurrencies(token, true)
}

async function readStorage() {
  // const address = diamondInit
  const address = deployedAddress

  for (let i = 0; i < 10; i++) {
    let storageSlot = await ethers.provider.getStorage(address, i);
    console.log(`Storage at slot ${i}:`, storageSlot);
  }

  const mappingSlot = 4;

  const key = ZeroAddress;
  const abiCoder = new ethers.AbiCoder()

  const slotHash = ethers.keccak256(abiCoder.encode(["address", "uint256"], [key, mappingSlot]));
  // const slotHash = ethers.keccak256(abiCoder.encode(["bytes32", "bytes32"], [key, mappingSlot]));

  // Read the storage at the computed slot
  const _storage = await ethers.provider.getStorage(address, slotHash);
  console.log(_storage)
}

async function main() {
  const [account1, account2, account3, account4, account5] = await ethers.getSigners();
  console.log(account1.address, account2.address, account3.address, account4.address, account5.address)

  // await getAllFunctionsInDiamond()

  await readStorage()

  // await setFeeAddress()

  // await getArbitrator()

  // await getEscrow()

  // await whitelistCurrency()

  // console.log(await escrowFee())

  // await getArbitrator(contract)
  // await setArbitrator(contract)
  // await signatureGeneration()

  // await createEscrow()

  // await executeOrder()
  // await cancelOrder(contract)
  // await claimDisputed(contract)

  // await createEscrowToken(contract)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
