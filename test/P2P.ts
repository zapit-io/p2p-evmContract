import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployP2PEscrow() {
    const FEES = 0.01;

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const p2pContract = await ethers.getContractFactory("ZapitP2PEscrow");
    const p2p = await p2pContract.deploy(FEES);

    return p2p;
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const p2p = await loadFixture(deployP2PEscrow);
    });
  });
});
