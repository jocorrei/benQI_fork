# Benqi's Protocol deployment script

This script deploys Benqi's Lending and Staking Protocols on a local network.

To run the script clone the repo and run:

Install dependencies:

```shell
npm install
```
Create an .env file with Avalanche Mainnet RPC:

```shell
echo "AVAX_MAINNET=https://api.avax.network/ext/bc/C/rpc" >> .env
```

The script is set to fork Avalanche Mainnet. Run it locally:

```shell
npx hardhat node
```

On another terminal run the script:

```shell
npx hardhat run scripts/deployProtocol.ts --network localhost
```
