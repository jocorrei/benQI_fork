import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');

dotenv.config();

const config: HardhatUserConfig = {
  
   solidity: {
    compilers: [
      { version: "0.5.17" },
      { version: "0.6.12" } 
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      },
      outputSelection: {
        "*": {
          "*": [
            "evm.bytecode",
            "evm.deployedBytecode",
            "devdoc",
            "userdoc",
            "metadata",
            "abi"
          ]
        }
      },
      libraries: {}
    }
   },
   networks: {
    hardhat: {
      gasPrice: 875000000, 
      gas: 100000000000,
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.AVAX_MAINNET || "",
      }
    },
    fuji: {
      allowUnlimitedContractSize: true,
      url: process.env.AVAX_FUJI || "",
      accounts: [`0x${process.env.FUJI_PRIVATE_KEY}`],
    },
   }
};

export default config;