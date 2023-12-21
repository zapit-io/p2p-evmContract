import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ZapitP2PEscrow", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployP2PEscrow() {
    // fees in terms of basis points
    const FEES = 100; // 1%
    const PAYMENT_WINDOW = 600; // 10 minutes
    const ETHERS_VALUE = 1;
    const ESCROW_VALUE = ethers.parseEther(ETHERS_VALUE.toString());
    const ESCROW_TOTAL_VALUE = ethers.parseEther(
      `${ETHERS_VALUE + (ETHERS_VALUE * FEES) / (10000 * 2)}`
    ); //  calculated after seller sent their 50% of the fees
    const TRADE_ID =
      "0x8920755501b54087d26177c51b1956d5ba880200a420193f6854d7d0f97c38f6";

    const EXT_TRADE_RANDOM = ethers.encodeBytes32String("123");

    // Contracts are deployed using the first signer/account by default
    const [deployer, arbitrator, buyer, seller] = await ethers.getSigners();

    const p2p = await ethers.deployContract("P2PEscrow", [FEES]);

    return {
      p2p,
      deployer,
      arbitrator,
      buyer,
      seller,
      TRADE_ID,
      EXT_TRADE_RANDOM,
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      ESCROW_TOTAL_VALUE,
      FEES,
    };
  }

  // fixture for using a created-escrow
  async function createP2PEscrow() {
    const {
      p2p,
      deployer,
      arbitrator,
      buyer,
      seller,
      TRADE_ID,
      EXT_TRADE_RANDOM,
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      ESCROW_TOTAL_VALUE,
      FEES,
    } = await loadFixture(deployP2PEscrow);
    const MESSAGE_DISPUTE = "ABCD";

    const tx = await p2p
      .connect(seller)
      .createEscrow(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
        value: ESCROW_TOTAL_VALUE,
      });

    await tx.wait();

    await p2p.connect(deployer).setArbitrator(arbitrator.address);

    return {
      p2p,
      deployer,
      arbitrator,
      buyer,
      seller,
      TRADE_ID,
      EXT_TRADE_RANDOM,
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      ESCROW_TOTAL_VALUE,
      MESSAGE_DISPUTE,
      FEES,
    };
  }

  describe("Deployment", function () {
    it("Should set the right initial data", async function () {
      const { p2p, deployer, FEES } = await loadFixture(deployP2PEscrow);

      const [owner, arbitrator, fees] = await Promise.all([
        p2p.owner(),
        p2p.arbitrator(),
        p2p.fees(),
      ]);

      expect(owner).to.be.equal(deployer.address);
      expect(arbitrator).to.be.equal(deployer.address);
      expect(fees).to.be.equal(FEES);
    });
  });

  describe("Creation of escrow", function () {
    it("Creating a new escrow and emits and event", async function () {
      const { p2p, deployer, FEES } = await loadFixture(deployP2PEscrow);

      const [owner, arbitrator, fees] = await Promise.all([
        p2p.owner(),
        p2p.arbitrator(),
        p2p.fees(),
      ]);

      expect(owner).to.be.equal(deployer.address);
      expect(arbitrator).to.be.equal(deployer.address);
      expect(fees).to.be.equal(FEES);
    });
  });
});
