import { ethers } from "hardhat";
import { P2PEscrow } from "../typechain-types";

// Mumbai
const deployedAddress = '0x1a76715cFd8331331F2928551f1A511051d6bfb1'

async function getOwner(contract: P2PEscrow) {
  return await contract.owner()
}

async function getArbitrator(contract: P2PEscrow) {
  return await contract.arbitrator()
}

async function escrowFee(contract: P2PEscrow) {
  return await contract.escrowFeeBP()
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
  const EXT_TRADE_RANDOM = ethers.encodeBytes32String("123");

  const result = await contract.createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
    value: ESCROW_TOTAL_VALUE,
  })

  console.log(result)
  // const buyer = '0xfb17b8acA83b4cA67347070D54727376229ffE9D'
  // return await contract.createEscrowNative(buyer, )
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

  await createEscrow(contract)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
