import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ZapitSignature", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deploySigner() {
    // Contracts are deployed using the first signer/account by default
    const [deployer] = await ethers.getSigners();
    const MESSAGE = "ABCD";

    const signature = await ethers.deployContract("Signature");

    return {
      signature,
      deployer,
      MESSAGE,
    };
  }

  // fixture for using a created-escrow

  describe("Check the verification of the signature", function () {
    it("Check the signature to be correct", async function () {
      const { signature, deployer, MESSAGE } = await loadFixture(deploySigner);

      const messageHash = await signature
        .connect(deployer)
        .getMessageHash(MESSAGE);

      const sig = await deployer.signMessage(messageHash);
      const signData = await signature
        .connect(deployer)
        .getEthSignedMessageHash(messageHash);

      const validation = await signature.connect(deployer).verify(MESSAGE, sig);

      console.log({
        validation,
      });

      expect(validation).to.equal(true);
    });
  });
});
