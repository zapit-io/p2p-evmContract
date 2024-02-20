import { ethers } from "hardhat";
import { P2PEscrow } from "../typechain-types";

// Mumbai
const deployedAddress = '0x01e6fd9b1bcb3451Ce121e479CA62B1b6aE3200D'

async function getOwner(contract: P2PEscrow) {
  return await contract.owner()
}

async function getArbitrator(contract: P2PEscrow) {
  return await contract.arbitrator()
}

async function escrowFee(contract: P2PEscrow) {
  return await contract.escrowFeeBP()
}

async function signatureGeneration(contract: P2PEscrow) {
  const accounts = await ethers.getSigners()
  console.log(accounts[0].address)
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

async function claimDisputed(contract: P2PEscrow) {
  const tradeId = '0xd411c0d851a24877ba953a4b637b1728530f8057941c0f4d0a1e60d59ba9ec30'
  // const signature = '0x50bdeb79baece22352ec05a17fdd595fab76f71b84c1dd9984d8411d6ce4926638ef1200ac4f52b96a9a5e43177afdd2ee448c8bae6ca927b945864a0b17cb581b'

  const esc = await contract.escrows(tradeId)
  console.log(esc)
  console.log('tradeId: ', tradeId)

  const _arbitrator = await contract.arbitrator()
  console.log('_arbitrator: ', _arbitrator)

  const messageHash = await contract.getMessageHash(tradeId, '0x743a2c5bf4ee9cc700dc9b797b128897cae7889c')
  console.log('messageHash: ', messageHash)

  const accounts = await ethers.getSigners()
  console.log(accounts[0])
  const signer = accounts[0]

  const signature = await signer.signMessage(ethers.getBytes(messageHash));

  console.log(signature)

  const result = await contract.claimDisputedOrder(tradeId, signature)
  console.log(result)
}

async function cancelOrder(contract: P2PEscrow) {
  const tradeId = '0x3fd5957aeb0f137db7c5072e9d1a5b07ad54f937fa5df0b0c6c4d01fa2d4955e'

  const esc = await contract.escrows(tradeId)
  console.log(esc)
  console.log('tradeId: ', tradeId)

  const accounts = await ethers.getSigners()
  console.log(accounts[0])


  const result = await contract.buyerCancel(tradeId)
  console.log(result)
}

async function executeOrder(contract: P2PEscrow) {
  // This will be the mongoDB id based of present architecture of zapit
  // const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65ca00dd2775f0503fc59eaf");

  const tradeId = '0xae7bec0a1aaf6f599ddbcfcfcf8ec05f3caa89182aeb74e15f8fc2b06fccd246'

  const esc = await contract.escrows(tradeId)
  console.log(esc)
  console.log('tradeId: ', tradeId)

  const messageHash = await contract.getMessageHash(tradeId, '0x4f7b8f0ecf10407fbf318feb9e9e886d1201fd9d')
  console.log('messageHash: ', messageHash)

  const accounts = await ethers.getSigners()
  console.log(accounts[0])
  const signer = accounts[0]

  const signature = await signer.signMessage(ethers.getBytes(messageHash));

  console.log(signature)
  const result = await contract.executeOrder(tradeId, signature)
  console.log(result)

}

async function createEscrow(contract: P2PEscrow) {

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
  const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65d474b1ef41be790d9806bb");

  console.log('EXT_TRADE_RANDOM: ', EXT_TRADE_RANDOM)

  const result = await contract.createEscrowNative(buyerAddress, ESCROW_VALUE, EXT_TRADE_RANDOM, {
    value: ESCROW_TOTAL_VALUE,
  })

  console.log(result)
}

async function main() {
  const contract = await ethers.getContractAt("P2PEscrow", deployedAddress);

  // const owner = await getOwner(contract)
  // const arbitrator = await getArbitrator(contract)
  // const fee = await escrowFee(contract)
  // console.log(owner)
  // console.log(arbitrator)
  // console.log(fee)

  // const [account1, account2, account3, account4] = await ethers.getSigners();
  // console.log(account1.address, account2.address, account3.address, account4.address)

  // await signatureGeneration()


  // await createEscrow(contract)
  // await executeOrder(contract)
  // await cancelOrder(contract)
  // await claimDisputed(contract)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
