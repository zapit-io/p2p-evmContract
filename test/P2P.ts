import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { ethers } from "hardhat";

const EXT_TRADE_RANDOM = ethers.encodeBytes32String("123");

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

    // Contracts are deployed using the first signer/account by default
    const [deployer, arbitrator, buyer, seller] = await ethers.getSigners();

    const p2p = await ethers.deployContract("P2PEscrow", [FEES]);

    // @ts-ignore
    console.log("buyer: ", buyer.publicKey)

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
      .createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
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
        p2p.escrowFeeBP(),
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
          .createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
            value: ESCROW_TOTAL_VALUE,
          })
      )
        .to.emit(p2p, "Created")
        .withArgs(
          TRADE_ID,
          seller.address,
          buyer.address,
          EXT_TRADE_RANDOM,
          ZeroAddress,
          ESCROW_VALUE,
          100
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
          .createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
            value: ESCROW_TOTAL_VALUE,
          })
      ).to.revertedWithCustomError(p2p, "TradeExists");
    });

    it("Send wrong value to create an escrow", async function () {
      const { p2p, buyer, ESCROW_VALUE, EXT_TRADE_RANDOM, seller } =
        await loadFixture(deployP2PEscrow);

      await expect(
        p2p
          .connect(seller)
          .createEscrowNative(buyer.address, ESCROW_VALUE, EXT_TRADE_RANDOM, {
            value: ESCROW_VALUE,
          })
      ).to.be.revertedWithCustomError(p2p, "IncorrectEth");
    });
  });

  describe("Cancellation of an escrow", function () {
    it("Revert if the to be request escrow-id does not exist", async function () {
      const { p2p, buyer } = await loadFixture(createP2PEscrow);

      await expect(
        p2p.connect(buyer).buyerCancel(ethers.encodeBytes32String("123"))
      ).to.be.revertedWithCustomError(p2p, "EscrowDoesNotExist");
    });
    it("Revert if not called by a buyer", async function () {
      const { p2p, seller, TRADE_ID } = await loadFixture(createP2PEscrow);

      await expect(
        p2p.connect(seller).buyerCancel(TRADE_ID)
      ).revertedWithCustomError(p2p, "NotBuyer");
    });
    it("Cancellation was successful", async function () {
      const { p2p, TRADE_ID, buyer, seller } = await loadFixture(
        createP2PEscrow
      );

      const provider = ethers.provider;

      const prevSellerBalance = parseFloat(
        ethers.formatEther(await provider.getBalance(seller.address))
      );

      const txData = await p2p.connect(buyer).buyerCancel(TRADE_ID);

      const newSellerBalance = parseFloat(
        ethers.formatEther(await provider.getBalance(seller.address))
      );

      await expect(txData).to.emit(p2p, "CancelledByBuyer").withArgs(TRADE_ID, EXT_TRADE_RANDOM);

      expect(newSellerBalance).to.be.greaterThan(prevSellerBalance);
    });
  });

  describe("Completion of an escrow", function () {
    it("Revert if the to be request escrow-id does not exist", async function () {
      const { p2p, buyer, seller, TRADE_ID } = await loadFixture(
        createP2PEscrow
      );

      const hash = await p2p.getMessageHash(TRADE_ID, buyer.address);
      const signature = await seller.signMessage(ethers.getBytes(hash));

      await expect(
        p2p
          .connect(seller)
          .executeOrder(ethers.encodeBytes32String("123"), signature)
      ).revertedWithCustomError(p2p, "EscrowDoesNotExist");
    });
    it("Revert if not called by a seller", async function () {
      const { p2p, seller, TRADE_ID, buyer } = await loadFixture(
        createP2PEscrow
      );

      const hash = await p2p.getMessageHash(TRADE_ID, buyer.address);
      const signature = await buyer.signMessage(ethers.getBytes(hash));

      await expect(
        p2p.connect(seller).executeOrder(TRADE_ID, signature)
      ).revertedWithCustomError(p2p, "InvalidSellerSignature");
    });
    it("Completion was successful", async function () {
      const { p2p, seller, buyer, TRADE_ID } = await loadFixture(
        createP2PEscrow
      );

      const prevBalance = parseFloat(
        ethers.formatEther(await ethers.provider.getBalance(buyer.address))
      );

      const hash = await p2p.getMessageHash(TRADE_ID, buyer.address);
      const signature = await seller.signMessage(ethers.getBytes(hash));

      const txData = await p2p
        .connect(seller)
        .executeOrder(TRADE_ID, signature);

      const newBalance = parseFloat(
        ethers.formatEther(await ethers.provider.getBalance(buyer.address))
      );

      await expect(txData).to.emit(p2p, "TradeCompleted").withArgs(TRADE_ID, EXT_TRADE_RANDOM);

      expect(newBalance).to.be.greaterThan(prevBalance);
    });
  });

  describe("Claiming the amounts from a disputed order", function () {
    it("Revert if the to be request escrow-id does not exist", async function () {
      const { p2p, buyer, deployer, TRADE_ID } = await loadFixture(
        createP2PEscrow
      );

      const hash = await p2p.getMessageHash(TRADE_ID, buyer.address);
      const arbitratorSignature = await deployer.signMessage(
        ethers.getBytes(hash)
      );

      await expect(
        p2p
          .connect(buyer)
          .claimDisputedOrder(
            ethers.encodeBytes32String("123"),
            arbitratorSignature
          )
      ).revertedWithCustomError(p2p, "EscrowDoesNotExist");
    });
    it("Revert if the signature was not signed by the arbitrator", async function () {
      const { p2p, buyer, TRADE_ID } = await loadFixture(createP2PEscrow);

      const hash = await p2p.getMessageHash(TRADE_ID, buyer.address);
      const arbitratorSignature = await buyer.signMessage(
        ethers.getBytes(hash)
      );

      await expect(
        p2p.connect(buyer).claimDisputedOrder(TRADE_ID, arbitratorSignature)
      ).revertedWithCustomError(p2p, "InvalidArbitratorSignature");
    });
    it("Claiming the disputed order is working", async function () {
      const { p2p, buyer, arbitrator, TRADE_ID } = await loadFixture(
        createP2PEscrow
      );

      const hash = await p2p.getMessageHash(TRADE_ID, buyer.address);
      const arbitratorSignature = await arbitrator.signMessage(
        ethers.getBytes(hash)
      );

      await expect(
        p2p.connect(buyer).claimDisputedOrder(TRADE_ID, arbitratorSignature)
      )
        .to.emit(p2p, "DisputeClaimed")
        .withArgs(TRADE_ID, buyer.address, EXT_TRADE_RANDOM);
    });
  });
});
