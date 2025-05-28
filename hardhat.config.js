// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
// For gas reporting
require("hardhat-gas-reporter");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.10", // Match your contract's Solidity version

  networks: {
    hardhat: {
      accounts: {
        count: 30 // Provides 30 accounts, enough for 21 delegates, 1 regulator, and 3 industries (25 total needed)
      }
      // Optionally, to simulate DPoS block timing more closely in the Hardhat Network:
      // mining: {
      //   auto: true, // Ensures blocks are mined
      //   interval: 3000 // Corresponds to BLOCK_TIME in dpos-runner.js (3 seconds)
      // }
    },
    
    // PureChain network (PoA Square implementation)
    purechain: {
      url: "http://43.200.53.250:8548",
      chainId: 900520900520,
      accounts: [
        "a471850a08d06bcc47850274208275f1971c9f5888bd0a08fbc680ed9701cfda", 
        "c8ed8a251f3d04f9efa44ed5bc769f0bd2d619987da02a16b8f04bc88778e8a0",
        "4e664eca744fc00c934509e6eac361fc66bfca3cdd8091ad38b1e79c8ca280e0",
        "2cb315e8fe4411b8ed5ca851765a276305fc1c2a3778a99c9ab37c851124780a",
        "9c46e4135835663bbb3f83ad5eee0172298ac9f9992ed030c0f66719289698c2"
      ],
      timeout: 120000, // Higher timeout for external network
      gas: "auto",
      gasPrice: "auto",
      tags: ["poasquare"],
      notes: "External PureChain network running PoA Square consensus"
    },
    // Local PoA network configuration
    localPoA: {
      url: "http://127.0.0.1:8545", // Default local node URL
      chainId: 31337, // Common local chain ID, adjust if yours is different
      accounts: {
        // You can use a mnemonic or private keys
        mnemonic: "test test test test test test test test test test test junk", // DO NOT USE IN PRODUCTION
        // Or specify private keys directly:
        privateKeys: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", 
          "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"],
        path: "m/44'/60'/0'/0", // Derivation path
        count: 10, // Number of accounts to derive
      },
      timeout: 60000, // Increased timeout for PoA networks
      gas: "auto", // Let Hardhat estimate gas
      gasPrice: "auto", // Let Hardhat estimate gas price
      // If you need a specific gas price, uncomment and set:
      // gasPrice: 1000000007, // 1 gwei (from your logs)
    },

    // You can also define a high gas price network for testing
    // New PoW configuration
    ganachePoW: {
      url: "http://127.0.0.1:8546", // Use a different port
      chainId: 1338, // Different chain ID
      accounts: ["0xe9f9d749695409cbbdb8d8286704e77b5d1f57a709fbf5aea52d6bc3177d780b", 
          "0x710536bcf153719ec5e2b45859f1673857e986f6b406016f2ba6daf5c458f630",
        "0x7b19827986ee39e0db0e8db527d0e2530afdb99ead48a857e35c0678025c3c63"],
        count: 10,
      mining: {
        auto: true,
        interval: 0, // Mine as fast as possible
        mempool: {
          order: "fifo" // First in, first out
        }
      },
    },
    
    // Local DPoS implementation for academic research
    localDPoS: {
      url: "http://127.0.0.1:8547", // Different port from other networks
      chainId: 1339,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk", // DO NOT USE IN PRODUCTION
        path: "m/44'/60'/0'/0",
        count: 21, // 21 validators (standard for DPoS systems)
      },
      blockTime: 3, // 3 seconds, typical for DPoS
      mining: {
        auto: true,
        interval: 3000, // 3 seconds block time
        mempool: {
          order: "price" // Sort by gas price (realistic)
        }
      },
      timeout: 60000,
      gas: "auto",
      gasPrice: "auto",
      tags: ["dpos"],
      notes: "Academically accurate local DPoS implementation"
    }
  },

  // Gas reporter configuration for detailed gas reporting
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 1, // Set to match your local PoA gasPrice
    coinmarketcap: process.env.COINMARKETCAP_API_KEY, // Optional for USD conversion
    token: 'ETH',
    gasPriceApi: '', // Leave empty for local network
    showTimeSpent: true,
    showMethodSig: true, // Show function signatures
    maxMethodDiff: 10, // Only show methods with gas usage diff >= 10%
    noColors: false, // Enable colors for better readability
    excludeContracts: [],
    src: "./contracts",
  },

  // Path configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  // Mocha configuration for testing
  mocha: {
    timeout: 40000, // Increased timeout for PoA
  },
};