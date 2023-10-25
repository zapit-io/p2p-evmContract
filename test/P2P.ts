import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ZapitP2PEscrow", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployP2PEscrow() {
    // fees in terms of basis points
    const FEES = 100; // 1%

    // Contracts are deployed using the first signer/account by default
    const [deployer, otherAccount] = await ethers.getSigners();

    const p2p = await ethers.deployContract("ZapitP2PEscrow", [FEES]);

    return { p2p, deployer, otherAccount, FEES };
  }

  describe("Deployment", function () {
    it("Should set the right initial data", async function () {
      const { p2p, deployer, FEES } = await loadFixture(deployP2PEscrow);

      const [owner, arbitrator, requestCancellationMinimumTime, fees] =
        await Promise.all([
          p2p.owner(),
          p2p.arbitrator(),
          p2p.requestCancellationMinimumTime(),
          p2p.fees(),
        ]);

      expect(owner).to.be.equal(deployer.address);
      expect(arbitrator).to.be.equal(deployer.address);
      expect(requestCancellationMinimumTime).to.be.equal(0);
      expect(fees).to.be.equal(FEES);
    });
  });
});
