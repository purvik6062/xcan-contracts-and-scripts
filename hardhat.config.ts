import type { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import { configVariable } from "hardhat/config";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: [process.env.SEPOLIA_PRIVATE_KEY || ""],
    },
    arbitrumSepolia: {
      type: "http",
      chainType: "generic",
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "",
      accounts: [process.env.ARBITRUM_SEPOLIA_PRIVATE_KEY || ""],
      chainId: 421614,
    },
    arbitrumOne: {
      type: "http",
      chainType: "generic",
      url: process.env.ARBITRUM_ONE_RPC_URL || "",
      accounts: [process.env.ARBITRUM_ONE_PRIVATE_KEY || ""],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    },
  },
};

export default config;
