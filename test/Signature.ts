// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { expect } from "chai";
// import { ethers } from "hardhat";

// describe("Signature", function () {
//   async function deploySigner() {
//     const [deployer, random] = await ethers.getSigners();
//     console.log(deployer.address)
//     console.log(random.address)

//     const MESSAGE = "ABCD";

//     const signature = await ethers.deployContract("Signature");

//     return {
//       signature,
//       deployer,
//       random,
//       MESSAGE,
//     };
//   }

//   // fixture for using a created-escrow

//   describe("Check the verification of the signature", function () {
//     it("Check the signature to be correct", async function () {
//       const { signature, deployer, MESSAGE } = await loadFixture(deploySigner);

//       const messageHash = await signature.getMessageHash(MESSAGE);

//       const sig = await deployer.signMessage(ethers.getBytes(messageHash));
//       await signature.connect(deployer).getEthSignedMessageHash(messageHash);

//       const validation = await signature
//         .connect(deployer)
//         .verify(deployer.address, MESSAGE, sig);

//       expect(validation).to.equal(true);
//     });
//     it("Check the signature to be in-correct", async function () {
//       const { signature, deployer, random, MESSAGE } = await loadFixture(
//         deploySigner
//       );

//       const messageHash = await signature
//         .connect(deployer)
//         .getMessageHash(MESSAGE);

//       const sig = await deployer.signMessage(messageHash);
//       await signature.connect(deployer).getEthSignedMessageHash(messageHash);

//       const validation = await signature
//         .connect(deployer)
//         .verify(random.address, MESSAGE, sig);

//       expect(validation).to.equal(false);
//     });
//   });

//   describe("Check the verification of the signature", function () {
//     it("Check the signature to be correct", async function () {
//       const { signature, deployer, MESSAGE } = await loadFixture(deploySigner);

//       // console.log(deployer)

//       // const MESSAGE = '65ca00dd2775f0503fc59eaf'
//       // const signature = '0x7ceb0e8cccb9bba25c514a4cc0bd943002c475daa6a51a3e1d134d824b01f241455bfb49b36447bc82d8de7afec55c7e990ace66b8aa963fe9bd4a588aa6d42b1b'
//       // const signature = '0xac4a2e57b68060c26c1fae858cda131dc9ea8ccc2e62490e91b23ed409e3d50313bdd4ebbdc93f16ca4bced244602ec99d24bf5e6b1efdc56b9bdfc3e63c9b0c1c'    

//       const messageHash = await signature.getMessageHash('65ca00dd2775f0503fc59eaf');

//       console.log('messageHash:', messageHash)

//       const sig = await deployer.signMessage(ethers.getBytes(messageHash));
//       await signature.connect(deployer).getEthSignedMessageHash(messageHash);

//       const validation = await signature
//         .connect(deployer)
//         .verify(deployer.address, MESSAGE, sig);

//       expect(validation).to.equal(true);
//     });
//   });

// });
