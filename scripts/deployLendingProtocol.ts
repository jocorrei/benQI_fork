import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import hre = require("hardhat")

import {
  balance,
  parseToken,
  days,
  address,
  years,
  timeTravel,
  formatToken,
  assetBalance,
} from "./utils";

/*
*   This deploy script is set to deploy BenQI's lending protocal on the Avalanche network.
*   It should work for every EVM compatible network after some changes on the contracts deployment parameters and the contracts itself.
*   Considerations: For every QiToken the deployer will need to input the underlying address
*   and the ChainLink oracle smart contract for the desired pair. This script is only deploying the
*   QiToken (Governance Token from BenqiFinace), QiLink Token and QiAvax. These tokens can be deployed 
*   in any EVM just changing the parameters and deploying the Delegator Contract.
*/

async function main() {

  // This is the LINK token on Avalanche Mainnet
  const LinkAddress = "0x5947BB275c521040051D82396192181b413227A3";

  // This is the Chainlink Oracle smart contract Avalanche Mainnet LINK/USD
  const LINK_FEED = "0x49ccd9ca821efeab2b98c60dc60f518e765ede9a";

  // Get address to be the deployer
  const [deployer] = await ethers.getSigners()
  const owner = deployer.address

  // QI token deployment (This is the governance Token)
  const QI = await ethers.getContractFactory("Qi")
  const Qi = await QI.deploy(owner)
  await Qi.deployed();
  console.log("Qi Token deployed at: ", Qi.address);

  /* 
  * BenqiChainlinkOracle deployment 
  * (this is deployed once. It's a proxy smart contract that fetch information from the Chainlink Oracle Smart Contracts)
  */

  const CHAIN = await ethers.getContractFactory("BenqiChainlinkOracle")
  const BenqiChainLinkOracle = await CHAIN.deploy()
  await BenqiChainLinkOracle.deployed();
  console.log("BenqiChainLinkOracle at: ", BenqiChainLinkOracle.address);

  // Unitroller deployment
  const UNI = await ethers.getContractFactory("Unitroller")
  const Unitroller = await UNI.deploy()
  await Unitroller.deployed();
  console.log("Unitroller deployed at: ", Unitroller.address);

  // Comptroller deployment
  const COMP = await ethers.getContractFactory("Comptroller")
  const Comptroller = await COMP.deploy();
  await Comptroller.deployed();
  console.log("Comptroller deployed at: ", Comptroller.address);

  // Notify Unitroller of new pending implementation
  await Unitroller._setPendingImplementation(Comptroller.address)
  
  // Comptroller accept's to be Unitroller implementation
  await Comptroller._become(Unitroller.address)

  // Set the Qi token for the new Comptroller
  await Comptroller.setQiAddress(Qi.address)

  // Delegate deployment
  const DELEGATE = await ethers.getContractFactory("QiErc20Delegate")
  const Delegate = await DELEGATE.deploy()
  await Delegate.deployed();
  console.log("Delegate deployed at: ", Delegate.address);

  // Interest Rate Model Deployement (actual implementation on BenQi is the JumpRateModel)
  const RATE = await ethers.getContractFactory("JumpRateModel")
  const JumpRateModel = await RATE.deploy(
    BigNumber.from("20000000000000000"),
    BigNumber.from("100000000000000000"),
    BigNumber.from("1090000000000000000"),
    BigNumber.from("800000000000000000")
  );
  await JumpRateModel.deployed()
  console.log("JumpRateModel deployed at: ", JumpRateModel.address);

  // Deployment of the QiAvax token
  const QIAVAX = await ethers.getContractFactory("QiAvax")
  const QiAvax = await QIAVAX.deploy(
    Comptroller.address,
    JumpRateModel.address,
    BigNumber.from("200000000000000000000000000"),
    "Benqi Avax",
    "qiAVAX",
    8,
    owner
  );
  await QiAvax.deployed()
  console.log("QiAvax deployed at: ", QiAvax.address);

  // The Delegator is the contract that creates new QI tokens.
  // On this script we are only creating one Qi (QiLink) besides the QiAvax
  const DELEGATOR = await ethers.getContractFactory("QiErc20Delegator")
  const QiLink = await DELEGATOR.deploy(
    LinkAddress,
    Comptroller.address,
    JumpRateModel.address,
    BigNumber.from("200000000000000000000000000"),
    "Benqi Link",
    "qiLINK",
    8,
    owner,
    Delegate.address,
    [],
    { gasLimit : 3e7 }
  )
  await QiLink.deployed();
  console.log("QiLink deployed at: ", QiLink.address);

  // Maximillion is used to repay an an account's borrow in the qiAvax market
  const MAXI = await ethers.getContractFactory("Maximillion")
  const Maximillion = await MAXI.deploy(QiAvax.address)
  await Maximillion.deployed();
  console.log("Maximillion deployed at: ", Maximillion.address);

  /* 
  *  These transactions are setting the protocol up. Since in this sript we are only 
  *  deploying two Qi Tokens (QiAvax and QiLink), this script only have 2 of theses transactions for
  *  each token.
  */
  
  await QiAvax._setProtocolSeizeShare(BigNumber.from("30000000000000000"))
  await QiAvax._setReserveFactor(BigNumber.from("200000000000000000"))
  
  await QiLink._setProtocolSeizeShare(BigNumber.from("30000000000000000"))
  await QiLink._setReserveFactor(BigNumber.from("200000000000000000"))
  
  await BenqiChainLinkOracle.setFeed("LINK.e", LINK_FEED)
  await BenqiChainLinkOracle.setFeed("qiAVAX", LINK_FEED)
  await Comptroller._setPriceOracle(BenqiChainLinkOracle.address)
  
  await Comptroller._supportMarket(QiLink.address)
  await Comptroller._supportMarket(QiAvax.address)
  
  await Comptroller._setCollateralFactor(QiAvax.address, BigNumber.from("400000000000000000"), {gasLimit: 3e7})
  await Comptroller._setCollateralFactor(QiLink.address, BigNumber.from("500000000000000000"), {gasLimit: 3e7})

  await Comptroller._setRewardSpeed(1, QiAvax.address, BigNumber.from("1821840277777780"), BigNumber.from("1821840277777780"), {gasLimit: 3e7})
  await Comptroller._setRewardSpeed(1, QiLink.address, BigNumber.from("1821840277777780"), BigNumber.from("1821840277777780"), {gasLimit: 3e7})
  
  // Set Comptroller settings
  await Comptroller._setCloseFactor(BigNumber.from("500000000000000000"))
  await Comptroller._setLiquidationIncentive(BigNumber.from("1100000000000000000"))

  /* Here the Lending protocol is deployed. The next transactions are on the user prespective */
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
