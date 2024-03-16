import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-solhint";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {

  networks: {
    bsc: {
      url: process.env.BSC_MAINNET_PROVIDER || "",
      accounts: process.env.MAINNET_DEPLOYER !== undefined ? [process.env.MAINNET_DEPLOYER] : [],
      timeout: 900000,
      chainId: 56,
    },
    opBNB: {
      url: process.env.OPBNB_MAINNET_PROVIDER || "",
      accounts: process.env.MAINNET_DEPLOYER !== undefined ? [process.env.MAINNET_DEPLOYER] : [],
      timeout: 900000,
      chainId: 204,
    },
    bttc: {
      url: process.env.BTTC_MAINNET_PROVIDER || "",
      accounts: process.env.MAINNET_DEPLOYER !== undefined ? [process.env.MAINNET_DEPLOYER] : [],
      gasPrice: 300000000000000,      // 300,000 GWei
      timeout: 1200000,       //   20 mins
      chainId: 199
    },
    aurora: {
      url: process.env.AURORA_MAINNET_PROVIDER || "",
      accounts: process.env.MAINNET_DEPLOYER !== undefined ? [process.env.MAINNET_DEPLOYER] : [],
      timeout: 1200000,       //   20 mins
      chainId: 1313161554
    },
    matic: {
      url: process.env.POLYGON_PROVIDER || "",
      accounts: process.env.MAINNET_DEPLOYER !== undefined ? [process.env.MAINNET_DEPLOYER] : [],
      timeout: 1200000,       //   20 mins
      chainId: 137
    },
    bsc_test: {
      url: process.env.BSC_TESTNET_PROVIDER || "",
      accounts: process.env.TESTNET_DEPLOYER !== undefined ? [process.env.TESTNET_DEPLOYER] : [],
      timeout: 20000,
      chainId: 97
    },
    opBNB_test: {
      url: process.env.OPBNB_TESTNET_PROVIDER || "",
      accounts: process.env.TESTNET_DEPLOYER !== undefined ? [process.env.TESTNET_DEPLOYER] : [],
      timeout: 20000,
      chainId: 5611
    },
    bttc_test: {
      url: process.env.BTTC_TESTNET_PROVIDER || "",
      accounts: process.env.TESTNET_DEPLOYER !== undefined ? [process.env.TESTNET_DEPLOYER] : [],
      timeout: 20000,
      chainId: 1029
    },
    aurora_test: {
      url: process.env.AURORA_TESTNET_PROVIDER || "",
      accounts: process.env.TESTNET_DEPLOYER !== undefined ? [process.env.TESTNET_DEPLOYER] : [],
      timeout: 20000,
      chainId: 1313161555
    },
    mumbai: {
      url: process.env.MUMBAI_PROVIDER || "",
      accounts: process.env.MAINNET_DEPLOYER !== undefined ? [process.env.MAINNET_DEPLOYER] : [],
      timeout: 1200000,       //   20 mins
      chainId: 80001
    },
    neo_evm: {
      url: process.env.NEOEVM_PROVIDER || "",
      accounts: process.env.TESTNET_DEPLOYER !== undefined ? [process.env.TESTNET_DEPLOYER] : [],
      timeout: 20000,
      chainId: 2970385
    },
    base_test: {
      url: process.env.BASE_TESTNET_PROVIDER || "",
      accounts: process.env.TESTNET_DEPLOYER !== undefined ? [process.env.TESTNET_DEPLOYER] : [],
      timeout: 20000,
      chainId: 84531
    },
  },

  solidity: {
    compilers: [
      {
          version: "0.8.17"
      }
    ]
  },

  gasReporter: {
    enabled: true
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./build/cache",
    artifacts: "./build/artifacts"
  },

  etherscan: {
    apiKey: process.env.BSC_API_KEY,
    // apiKey: process.env.BTTC_API_KEY,
    // apiKey: process.env.POLYGON_API_KEY,
    // apiKey: process.env.BSC_API_KEY,
    // apiKey: process.env.BTTC_API_KEY,
    // apiKey: process.env.AURORA_API_KEY,
    customChains: [
      {
        network: "BitTorrent Chain Testnet",
        chainId: 1029,
        urls: {
            apiURL: "https://api-testnet.bttcscan.com/api/",
            browserURL: "https://testnet.bttcscan.com/"
        }
      },
      {
        network: "BitTorrent Chain Mainnet",
        chainId: 199,
        urls: {
            apiURL: "https://api.bttcscan.com/api/",
            browserURL: "https://bttcscan.com/"
        }
      },
      {
        network: "Aurora Testnet",
        chainId: 1313161555,
        urls: {
            apiURL: "https://api-testnet.aurorascan.dev/api/",
            browserURL: "https://testnet.aurorascan.dev"
        }
      },
      {
        network: "Aurora Mainnet",
        chainId: 1313161554,
        urls: {
            apiURL: "https://api.aurorascan.dev/api",
            browserURL: "https://aurorascan.dev"
        }
      }
    ]
  }
};

export default config;
