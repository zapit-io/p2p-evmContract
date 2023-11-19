import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Signature", function () {
  async function deploySigner() {
    const [deployer, random] = await ethers.getSigners();
    const MESSAGE = "ABCD";

    const signature = await ethers.deployContract("Signature");

    return {
      signature,
      deployer,
      random,
      MESSAGE,
    };
  }

  // fixture for using a created-escrow

  describe("Check the verification of the signature", function () {
    it("Check the signature to be correct", async function () {
      const { signature, deployer, random, MESSAGE } = await loadFixture(
        deploySigner
      );

      const messageHash = await signature
        .connect(deployer)
        .getMessageHash(MESSAGE);

      const sig = await deployer.signMessage(messageHash);
      const signData = await signature
        .connect(deployer)
        .getEthSignedMessageHash(messageHash);

      const correctSignature = await signature
        .connect(deployer)
        .verify(deployer.address, MESSAGE, sig);

      const inCorrectSignature = await signature
        .connect(deployer)
        .verify(random.address, MESSAGE, sig);

      expect(correctSignature).to.equal(true);
      expect(inCorrectSignature).to.equal(false);
    });
  });
});
