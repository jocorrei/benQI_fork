import { ethers } from "hardhat";
import { BigNumber } from "ethers";

require('dotenv').config()

async function main() {
  const [deployer] = await ethers.getSigners()
  const owner = deployer.address
  
  // 
  const STAKEDAVAX = await ethers.getContractFactory("StakedAvax")
  const sAvax = await STAKEDAVAX.deploy(owner)
  await sAvax.deployed()
  console.log("sAvax Token deployed at: ", sAvax.address)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
