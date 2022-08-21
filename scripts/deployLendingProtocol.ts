import { ethers } from "hardhat";
import { BigNumber } from "ethers";

require('dotenv').config()

async function main() {
  const LinkAddress = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const LINK_ETH_FEED = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";

  const [deployer] = await ethers.getSigners()
  const owner = deployer.address

  // QI token deployment (This is the governance Token)
  const QI = await ethers.getContractFactory("Qi")
  const Qi = await QI.deploy(owner)
  await Qi.deployed();
  console.log("Qi Token deployed at: ", Qi.address);

  // BenqiChainlinkOracle deployment
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
  

  await Unitroller._setPendingImplementation(Comptroller.address)
  
  await Comptroller._become(Unitroller.address)

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

  const MAXI = await ethers.getContractFactory("Maximillion")
  const Maximillion = await MAXI.deploy(QiAvax.address)
  await Maximillion.deployed();
  console.log("Maximillion deployed at: ", Maximillion.address);

  await QiAvax._setProtocolSeizeShare(BigNumber.from("30000000000000000"))
  await QiAvax._setReserveFactor(BigNumber.from("200000000000000000"))
  
  await QiLink._setProtocolSeizeShare(BigNumber.from("30000000000000000"))
  await QiLink._setReserveFactor(BigNumber.from("200000000000000000"))
  
  await BenqiChainLinkOracle.setFeed("LINK", LINK_ETH_FEED)
  await BenqiChainLinkOracle.setFeed("qiAVAX", LINK_ETH_FEED)
  await Comptroller._setPriceOracle(BenqiChainLinkOracle.address)
  
  await Comptroller._supportMarket(QiLink.address)
  await Comptroller._supportMarket(QiAvax.address)
  
  
  await Comptroller._setCollateralFactor(QiAvax.address, BigNumber.from("400000000000000000"), {gasLimit: 3e7})
  await Comptroller._setCollateralFactor(QiLink.address, BigNumber.from("500000000000000000"), {gasLimit: 3e7})
  
  await Comptroller._setCloseFactor(BigNumber.from("500000000000000000"))
  await Comptroller._setLiquidationIncentive(BigNumber.from("1100000000000000000"))
  
  // await Comptroller.enterMarkets([QiAvax.address, QiLink.address])
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
