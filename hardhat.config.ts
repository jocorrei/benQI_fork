import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
   solidity: {
    compilers: [
      { version: "0.5.17" },
      {version: "0.6.12" } 
    ]
   },
};

export default config;