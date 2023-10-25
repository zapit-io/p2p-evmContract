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
    const TRADE_ID = ethers.encodeBytes32String("507f1f77bcf86cd799439011");
    const PAYMENT_WINDOW = 600; // 10 minutes
    const ESCROW_VALUE = ethers.parseEther("1");

    // Contracts are deployed using the first signer/account by default
    const [deployer, arbitrator, buyer, seller] = await ethers.getSigners();

    const p2p = await ethers.deployContract("ZapitP2PEscrow", [FEES]);

    return {
      p2p,
      deployer,
      arbitrator,
      buyer,
      seller,
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      TRADE_ID,
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
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      TRADE_ID,
      FEES,
    } = await loadFixture(deployP2PEscrow);

    await p2p.createEscrow(
      TRADE_ID,
      seller.address,
      buyer.address,
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      {
        value: ESCROW_VALUE,
      }
    );

    return {
      p2p,
      deployer,
      arbitrator,
      buyer,
      seller,
      ESCROW_VALUE,
      PAYMENT_WINDOW,
      TRADE_ID,
      FEES,
    };
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

  describe("Test for creation of escrow", function () {
    it("Creates an escrow", async function () {
      const { p2p, TRADE_ID, buyer, ESCROW_VALUE, seller, PAYMENT_WINDOW } =
        await loadFixture(createP2PEscrow);
      await time.increase(1000);
      const currentBlockTimestamp = await time.latest();

      const escrow = await p2p.escrows(TRADE_ID);
      expect(escrow._seller).to.be.equal(seller.address);
      expect(escrow._buyer).to.be.equal(buyer.address);
      expect(escrow._value).to.be.equal(ESCROW_VALUE.toString());
      expect(escrow.sellerCanCancelAfter).to.be.lessThan(
        currentBlockTimestamp + PAYMENT_WINDOW
      );
    });
    it("Emits and event when an escrow is created", async function () {
      const { p2p, TRADE_ID, buyer, ESCROW_VALUE, seller, PAYMENT_WINDOW } =
        await loadFixture(deployP2PEscrow);

      await expect(
        p2p.createEscrow(
          TRADE_ID,
          seller.address,
          buyer.address,
          ESCROW_VALUE,
          PAYMENT_WINDOW,
          {
            value: ESCROW_VALUE,
          }
        )
      )
        .to.emit(p2p, "Created")
        .withArgs(TRADE_ID);
    });
    it("Send wrong value to create an escrow", async function () {
      const { p2p, TRADE_ID, buyer, ESCROW_VALUE, seller, PAYMENT_WINDOW } =
        await loadFixture(deployP2PEscrow);

      await expect(
        p2p.createEscrow(
          TRADE_ID,
          seller.address,
          buyer.address,
          ESCROW_VALUE,
          PAYMENT_WINDOW,
          {
            value: ethers.parseEther("0.01"),
          }
        )
      ).to.be.revertedWith("Incorrect ETH sent");
    });
    it("Try to create an already existing escrow", async function () {
      const { p2p, TRADE_ID, buyer, ESCROW_VALUE, seller, PAYMENT_WINDOW } =
        await loadFixture(createP2PEscrow);

      await expect(
        p2p.createEscrow(
          TRADE_ID,
          seller.address,
          buyer.address,
          ESCROW_VALUE,
          PAYMENT_WINDOW,
          {
            value: ESCROW_VALUE,
          }
        )
      ).to.be.revertedWith("Trade already exists");
    });
  });

  describe("Testing the cancelling trade of escrow", function () {
    it("Set the seller cannot cancel after payment has been done", async function () {
      const { p2p, TRADE_ID, buyer } = await loadFixture(createP2PEscrow);

      await p2p.connect(buyer).sellerCannotCancel(TRADE_ID, 0x01);

      const escrow = await p2p.escrows(TRADE_ID);
      expect(escrow.sellerCanCancelAfter).to.be.equal(0);
    });

    it("Test reverts if the seller cancel has been disabled", async function () {
      const { p2p, TRADE_ID, seller, buyer } = await loadFixture(
        createP2PEscrow
      );

      await p2p.connect(buyer).sellerCannotCancel(TRADE_ID, 0x01);

      expect(
        await p2p.connect(seller).sellerCancelation(TRADE_ID, 0x03)
      ).to.not.emit(p2p, "CancelledBySeller");
    });

    it("Test to check the event when the seller is able to cancel escrow", async function () {
      const { p2p, TRADE_ID, seller } = await loadFixture(createP2PEscrow);

      expect(
        await p2p.connect(seller).sellerCancelation(TRADE_ID, 0x03)
      ).to.not.emit(p2p, "CancelledBySeller");
    });

    it("Test to check the event when the buyer is able to cancel escrow", async function () {
      const { p2p, TRADE_ID, buyer } = await loadFixture(createP2PEscrow);

      expect(await p2p.connect(buyer).buyerCancel(TRADE_ID, 0x02)).to.emit(
        p2p,
        "CancelledByBuyer"
      );
    });
    it("Test to check the seller received the balance from the escrow", async function () {
      const { p2p, TRADE_ID, seller, ESCROW_VALUE, buyer } = await loadFixture(
        createP2PEscrow
      );

      let prevSellerBalance: number | string = (
        await ethers.provider.getBalance(seller.address)
      ).toString();

      prevSellerBalance = parseFloat(ethers.formatEther(prevSellerBalance));

      await p2p.connect(buyer).buyerCancel(TRADE_ID, 0x02);

      let sellerBalance: number | string = (
        await ethers.provider.getBalance(seller.address)
      ).toString();

      sellerBalance = parseFloat(ethers.formatEther(sellerBalance));

      console.log({
        prevSellerBalance,
        sellerBalance,
      });

      expect(sellerBalance).to.be.equal(
        prevSellerBalance + parseFloat(ethers.formatEther(ESCROW_VALUE))
      );
    });
  });
});
