import { ethers } from "hardhat";
import { P2PEscrow } from "../typechain-types";

// Mumbai
const deployedAddress = '0xe51f9762578DBD17f09D251Be50797CAF6F622d2'

async function getOwner(contract: P2PEscrow) {
  return await contract.owner()
}

async function getArbitrator(contract: P2PEscrow) {
  return await contract.arbitrator()
}

async function escrowFee(contract: P2PEscrow) {
  return await contract.escrowFeeBP()
}

async function signatureGeneration() {
  const accounts = await ethers.getSigners()
  console.log(accounts[0])
  const signer = accounts[0]

  const MESSAGE = '65ca00dd2775f0503fc59eaf'

  // const messageHash = ethers.utils.hashMessage(message);

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

async function executeOrder(contract: P2PEscrow) {
  // This will be the mongoDB id based of present architecture of zapit
  // const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65ca00dd2775f0503fc59eaf");

  const EXT_TRADE_RANDOM = '0x86568de327e7056c68811a4617440b6f150bac1b6499e8d32ab402ee007e574c'

  const esc = await contract.escrows(EXT_TRADE_RANDOM)
  console.log(esc)

  console.log('EXT_TRADE_RANDOM: ', EXT_TRADE_RANDOM)

  const tradeId = '0x86568de327e7056c68811a4617440b6f150bac1b6499e8d32ab402ee007e574c'

  const messageHash = await contract.getMessageHash(tradeId, '0x4f7b8f0ecf10407fbf318feb9e9e886d1201fd9d')
  console.log('messageHash: ', messageHash)

  const accounts = await ethers.getSigners()
  console.log(accounts[0])
  const signer = accounts[0]

  const signature = await signer.signMessage(ethers.getBytes(messageHash));

  console.log(signature)
  // const result = await contract.executeOrder(EXT_TRADE_RANDOM, signature)
  // console.log(result)

}

async function createEscrow(contract: P2PEscrow) {

  const [buyer] = await ethers.getSigners();

  const FEES = 100; // 1%
  const ETHERS_VALUE = 0.0001;
  const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
  const ESCROW_TOTAL_VALUE = ethers.parseEther(
    `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`
  ); //  calculated after seller sent their 50% of the fees

  // This will be the mongoDB id based of present architecture of zapit
  const EXT_TRADE_RANDOM = ethers.encodeBytes32String("65ca00dd2775f0503fc59eaf");

  console.log('EXT_TRADE_RANDOM: ', EXT_TRADE_RANDOM)

  const result = await contract.createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
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
  await executeOrder(contract)
  // await createEscrow(contract)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
