require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    mantleSepolia: {
      url: process.env.MANTLE_RPC || "https://rpc.sepolia.mantle.xyz",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 5003,
      gasPrice: "auto",
    },
    mantle: {
      url: process.env.MANTLE_RPC || "https://rpc.mantle.xyz",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 5000,
      gasPrice: "auto",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
