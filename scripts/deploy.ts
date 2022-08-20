import { ethers } from "hardhat";
import { BigNumber } from "ethers";
require('dotenv').config()

async function main() {

  const LinkAddress = process.env.ETH_LINKADDRESS;

  const [deployer] = await ethers.getSigners()
  const owner = deployer.address

  // QI token deployment
  const QI = await ethers.getContractFactory("Qi")
  const Qi = await QI.deploy(owner)
  await Qi.deployed();

  // BenqiChainlinkOracle deployment
  const CHAIN = await ethers.getContractFactory("BenqiChainlinkOracle")
  const BenqiChainLinkOracle = await CHAIN.deploy()
  await BenqiChainLinkOracle.deployed();

  // Unitroller deployment
  const UNI = await ethers.getContractFactory("Unitroller")
  const Unitroller = await UNI.deploy()
  await Unitroller.deployed();

  // Comptroller deployment
  const COMP = await ethers.getContractFactory("Comptroller")
  const Comptroller = await COMP.deploy();
  await Comptroller.deployed();

  await Unitroller._setPendingImplementation(Comptroller.address)
  
  await Comptroller._become(Unitroller.address)

  await Comptroller.setQiAddress(Qi.address)

  // Delegate deployment
  const DELEGATE = await ethers.getContractFactory("QiErc20Delegate")
  const Delegate = await DELEGATE.deploy()
  await Delegate.deployed();

  // Interest Rate Model Deployment (actual implementation on BenQi is the JumpRateModel)
  const RATE = await ethers.getContractFactory("JumpRateModel")
  const JumpRateModel = await RATE.deploy(
    BigNumber.from("20000000000000000"),
    BigNumber.from("100000000000000000"),
    BigNumber.from("1090000000000000000"),
    BigNumber.from("800000000000000000")
  );
  await JumpRateModel.deployed()

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

  await deployDelegator(
    QiAvax.address,
    Comptroller.address,
    JumpRateModel.address,
    BigNumber.from("200000000000000000000000000"),
    "Benqi Link",
    "qiLink",
    8,
    owner,
    Delegate.address
  );
}

// This function will be used to deploy the QiTokens trough the Delegator contract
async function deployDelegator(
  underlying: string | undefined,
  comptroller: string,
  interestRate: string,
  mantissa: BigNumber,
  name: string,
  symbol: string,
  decimals: number,
  admin: string,
  delegate: string) {
    if (!underlying) {
      return
    }
    const DELEGATOR = await ethers.getContractFactory("QiErc20Delegator")
    const Delegator = await DELEGATOR.deploy(
      underlying,
      comptroller,
      interestRate,
      mantissa,
      name,
      symbol,
      decimals,
      admin,
      delegate,
      [],
      { gasLimit : 3e7 }
    )
    await Delegator.deployed();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
