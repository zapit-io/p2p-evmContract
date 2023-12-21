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
      "0x808c20ef09149650b29fbae1cc74c8cae292164efe69529e23749d3642bcff7a"; // replace this value the hardhat value that's returned from the contract (it'll be dynamic everytime for tests);

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
      const {
        p2p,
        buyer,
        ESCROW_VALUE,
        ESCROW_TOTAL_VALUE,
        EXT_TRADE_RANDOM,
        seller,
        TRADE_ID,
      } = await loadFixture(deployP2PEscrow);

      await expect(
        p2p
          .connect(seller)
          .createEscrow(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
            value: ESCROW_TOTAL_VALUE,
          })
      )
        .to.emit(p2p, "Created")
        .withArgs(
          TRADE_ID,
          100,
          seller.address,
          buyer.address,
          ESCROW_VALUE,
          EXT_TRADE_RANDOM
        );
    });
    it("Creating an already existing escrow in the contract", async function () {
      const {
        p2p,
        buyer,
        ESCROW_VALUE,
        ESCROW_TOTAL_VALUE,
        EXT_TRADE_RANDOM,
        seller,
      } = await loadFixture(createP2PEscrow);

      await expect(
        p2p
          .connect(seller)
          .createEscrow(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
            value: ESCROW_TOTAL_VALUE,
          })
      ).to.revertedWithCustomError(p2p, "TradeExists");
    });
  });
});
