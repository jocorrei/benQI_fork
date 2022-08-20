import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

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
      chainId: 1337,
      allowUnlimitedContractSize: true
    }
   }
};

export default config;