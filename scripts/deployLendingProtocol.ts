import { BigNumber } from "ethers";
import hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

import {
  days,
  timeTravel,
} from "./utils";

const testAccount = "0xbb546a2Da90bc049C5752E420836ACE1D087A470"

/*
*   This deployment script is set to deploy BenQI's lending and staking protocols on the Avalanche network.
*   It should work for every EVM compatible network after some small changes on the contracts deployment parameters and the contracts itself.
*   Considerations: This script is only deploying the QiToken (Governance Token from BenqiFinace), QiLink Token and QiAvax.
*   These and other tokens can be deployed in any EVM compatible network after some changes on tehe parameters when being deployed with the Delegator.
*/

async function main() {

  // This is the LINK token address on the Avalanche Mainnet
  const LinkAddress = "0x5947BB275c521040051D82396192181b413227A3";

  // Chainlink Oracle smart contract Avalanche Mainnet LINK/USD
  const LINK_FEED = "0x49ccd9ca821efeab2b98c60dc60f518e765ede9a";
  // Chainlink Oracle smart contract Avalanche Mainnet AVAX/USD
  const AVAX_FEED = "0x0a77230d17318075983913bc2145db16c7366156"

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
  * (this is deployed once. It's a proxy smart contract that fetch information from the Chainlink Oracle smart contracts)
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

  // Interest Rate Model Deployment (actual implementation on BenQi is the JumpRateModel)
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

  // The Delegator is the contract that creates new QI tokens and its markets.
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

  // Maximillion is used to repay an account's borrow in the qiAvax market
  const MAXI = await ethers.getContractFactory("Maximillion")
  const Maximillion = await MAXI.deploy(QiAvax.address)
  await Maximillion.deployed();
  console.log("Maximillion deployed at: ", Maximillion.address);

  /* 
  *  These transactions are setting up the protocol. Since in this script we are only 
  *  deploying two Qi Tokens (QiAvax and QiLink), this script only have 2 of theses transactions for
  *  each token.
  */
  
  await QiAvax._setProtocolSeizeShare(BigNumber.from("30000000000000000"))
  await QiAvax._setReserveFactor(BigNumber.from("200000000000000000"))
  
  await QiLink._setProtocolSeizeShare(BigNumber.from("30000000000000000"))
  await QiLink._setReserveFactor(BigNumber.from("200000000000000000"))
  
  // Set which chainLink feed Benqi's oracle should look for each token. args: (underlying token symbol, chainlink feed address)
  await BenqiChainLinkOracle.setFeed("LINK.e", LINK_FEED)

  /* 
  * Since AVAX is the native token of Avalance Mainnet, the symbol argument is qiAvax.
  * This parameter is hardcoded in the BenqiChainLinkOracle.sol contract. To be used in another 
  * EVM compatible network, the code on line 25 of the contract should be update. (ex: qiAvax -> qiETH)
  */
  await BenqiChainLinkOracle.setFeed("qiAVAX", AVAX_FEED)
  
  await Comptroller._setPriceOracle(BenqiChainLinkOracle.address)
  
  await Comptroller._supportMarket(QiLink.address)
  await Comptroller._supportMarket(QiAvax.address)
  
  await Comptroller._setCollateralFactor(QiAvax.address, BigNumber.from("400000000000000000"), {gasLimit: 3e7})
  await Comptroller._setCollateralFactor(QiLink.address, BigNumber.from("500000000000000000"), {gasLimit: 3e7})

  await Comptroller._setRewardSpeed(1, QiAvax.address, BigNumber.from("1821840277777780"), BigNumber.from("1821840277777780"), {gasLimit: 3e7})
  await Comptroller._setRewardSpeed(1, QiLink.address, BigNumber.from("1821840277777780"), BigNumber.from("1821840277777780"), {gasLimit: 3e7})

  // Fund Comptroller with Qi for Rewards
  await Qi.transfer(Comptroller.address, BigNumber.from("1000000000000000000000000000"))
  
  // Set Comptroller settings
  await Comptroller._setCloseFactor(BigNumber.from("500000000000000000"))
  await Comptroller._setLiquidationIncentive(BigNumber.from("1100000000000000000"))

  /*   STAKING PROTOCOL DEPLOYED */

  /*   DEPLOYING STAKING PROTOCOL */

  const STAKEDAVAX = await ethers.getContractFactory("StakedAvax")
  const sAvax = await upgrades.deployProxy(STAKEDAVAX, [BigNumber.from("3000000000"), BigNumber.from("5000000000")])
  await sAvax.deployed()
  console.log("sAvax Token deployed at: ", sAvax.address)

  /* STAKING PROTOCOL DEPLOYED */

  /* USING THE PROTOCOL */
  
  // Impersonate Treasury
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [testAccount],  
  }); 

  // Grant more gas to account 
  await hre.network.provider.send("hardhat_setBalance", [
    testAccount,
      "0xfffffffffffffffffffffffffffffffffffffffffffff"
  ]);

  // Get an account with Avax and Link balance
  const joe = await ethers.getSigner(testAccount);
  // Get Link.e contract Abi
  const LinkToken = await ethers.getContractAt("BridgeToken", LinkAddress)
  // Aprove Link.e spending
  await LinkToken.connect(joe).approve(QiLink.address, ethers.constants.MaxUint256)

  // Joe Supplying Link.e for qiLink
  await QiLink.connect(joe).mint(BigNumber.from("12732148482588855069877"))
  let qiLinkBalance = await QiLink.balanceOf(joe.address)
  console.log("Joe's qiLink balance: ", qiLinkBalance);

  // Joe Supplying Avax for qiAvax
  await QiAvax.connect(joe).mint({ value: 2000000000 })
  const qiAvaxBalance = await QiAvax.balanceOf(joe.address)
  console.log("Joe's qiAvaxBalance: ", qiAvaxBalance)

  // Joe set his suplyed tokens to be used as colateral
  await Comptroller.connect(joe).enterMarkets([QiLink.address, QiAvax.address])

  // Joe uses Qilink to borrow Link.e
  await QiLink.connect(joe).borrow(BigNumber.from("67763341177112665"))
  let LinkBalance = await LinkToken.balanceOf(joe.address)
  console.log("Joe's Link balance after borrow: ", LinkBalance);

  await timeTravel(days(3000))

  // Joe Repay Borrow
  await QiLink.connect(joe).repayBorrow(BigNumber.from("67763341177112665"))
  LinkBalance = await LinkToken.balanceOf(joe.address)
  console.log("Joe's Link balance after repay borrow: ", LinkBalance);

  // Joe Redeem underlying
  await QiLink.connect(joe).redeemUnderlying(BigNumber.from("12732148482588855069877"))
  qiLinkBalance = await QiLink.balanceOf(joe.address)
  console.log("Joe's qiLink balance after withdraw: ", qiLinkBalance);

  // Joe Claim rewards form using Benqi Protocol
  await Comptroller["claimReward(uint8,address,address[])"](0, joe.address, [QiLink.address, QiAvax.address])
  const QiRewards = await Qi.balanceOf(joe.address)
  console.log("Qi earned as rewards", QiRewards)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
