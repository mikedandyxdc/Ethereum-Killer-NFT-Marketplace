require("@nomicfoundation/hardhat-toolbox");
require('hardhat-deploy');
require("dotenv").config();

const path = require("path");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        // version: "0.8.0",
        version: "0.8.4",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.0",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      // You can add more compiler versions here if needed
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      chainId: 1337,
      gasPrice: 0,  // Set gas price to 0
      initialBaseFeePerGas: 0, // For EIP-1559 features
      // allowUnlimitedContractSize: true,  // Added this line
      accounts: {
        count: 20,  // Number of accounts to generate
        accountsBalance: "1000000000000000000000000000"  // 100,000 ETH
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      // cors: "*",
    },
    xdc: {
      // url: "https://rpc.xinfin.network",
      url: "https://rpc.ankr.com/xdc",
      chainId: 50,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
  namedAccounts: {
    deployer: {
        default: 0, // deployer account (use the first account by default)
    },
  },
  // Etherscan V2 (xdcscan.com) — apiKey must be string for V2 mode
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  //   customChains: [
  //     {
  //       network: "xdc",
  //       chainId: 50,
  //       urls: {
  //         apiURL: "https://api.etherscan.io/v2/api",
  //         browserURL: "https://xdcscan.com/",
  //       },
  //     },
  //   ],
  // },
  // BlocksScan (xdcscan.io)
  etherscan: {
    apiKey: {
      xdc: "abc",
    },
    customChains: [
      {
        network: "xdc",
        chainId: 50,
        urls: {
          // apiURL: "https://bapi.blocksscan.io/api",
          // browserURL: "https://beta.blocksscan.io/",
          apiURL: "https://api.xdcscan.io/api",
          browserURL: "https://xdcscan.io/",
        },
      },
    ],
  },
  // node: {
  //   // allowUnlimitedContractSize: true,
  //   cors: true,
  //   headers: [
  //     {
  //       key: "Access-Control-Allow-Origin",
  //       value: "*"
  //     },
  //     {
  //       key: "Access-Control-Allow-Methods",
  //       value: "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  //     },
  //     {
  //       key: "Access-Control-Allow-Headers",
  //       value: "X-Requested-With, content-type, Authorization"
  //     }
  //   ]
  // },
};

// subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
//   if (args.solcVersion === "0.8.0") {
//     const compilerPath = path.join(__dirname, "solc", "soljson-v0.8.0+commit.c7dfd78e.js");
//
//     return {
//       compilerPath,
//       isSolcJs: true,
//       version: args.solcVersion,
//       longVersion: "0.8.0+commit.c7dfd78e",
//     };
//   }
//
//   return runSuper();
// });
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  return runSuper();
});