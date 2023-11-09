import { ethers } from "hardhat";

async function main() {
  const p2pEscrow = await ethers.deployContract("ZapitP2PEscrow", [100]);
  await p2pEscrow.waitForDeployment();

  // verify contract on polygonscan on mumbai

  console.log(`ZapitP2PEscrow deployed to ${p2pEscrow.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
