import { ethers } from "hardhat";

async function main() {

  const [deployer] = await ethers.getSigners()
	console.log("Deployer:", deployer.address);
  
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
