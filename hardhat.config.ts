import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

dotenv.config();

const config: HardhatUserConfig = {
   solidity: {
    compilers: [
      { version: "0.5.17" },
      {version: "0.6.12" } 
    ]
   },
   networks: {
    hardhat: {
      gasPrice: 875000000, 
      gas: 100000000000,
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.ETH_MAINFORK || "",
        blockNumber: 12136584,
      }
    }
   }
};

export default config;