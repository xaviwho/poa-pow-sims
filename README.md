# K-ETS Gas Analysis Project

This project analyzes gas usage in Korean Emissions Trading Scheme (K-ETS) blockchain implementations, comparing Proof of Authority (PoA) and Proof of Work (PoW) consensus mechanisms.

## Project Overview

The K-ETS Blockchain provides a decentralized platform for carbon credit trading with features including:
- Industry registration and verification
- GHG emissions tracking
- Free allocation of carbon credits
- Auction-based credit distribution
- Peer-to-peer credit trading

This repository contains tools to analyze gas consumption across different consensus mechanisms to determine the most cost-effective approach for carbon credit trading.

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/xaviwho/poa-pow-sims.git
   cd kets-gas-analysis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install required global packages:
   ```bash
   npm install -g ganache
   ```

## Running Tests

### Proof of Authority (PoA) Testing

1. Start the local PoA network:
   ```bash
   npx hardhat node --port 8545
   ```

2. Deploy the contract:
   ```bash
   npx hardhat run scripts/deploy.js --network localPoA
   ```

3. Run gas analysis:
   ```bash
   npx hardhat run scripts/simulateTransactions.js --network localPoA
   ```

### Proof of Work (PoW) Testing

1. Start a local Ganache instance with PoW settings:
   ```bash
   npx ganache --port 8546 --chain.chainId 1338 --deterministic
   ```

2. Deploy the contract:
   ```bash
   npx hardhat run scripts/deploy.js --network ganachePoW
   ```

3. Run gas analysis:
   ```bash
   npx hardhat run scripts/simulateTransactions-pow-simulation.js --network ganachePoW
   ```

### PoW Simulation (Alternative)

If you can't run a separate Ganache instance, you can use the PoW simulation:

```bash
npx hardhat run scripts/simulateTransactions-pow-simulation.js --network localPoA
```

This simulates PoW characteristics (higher gas prices, mining delays) while using your PoA network.

## Configuration

### Network Configuration

The project is configured to work with:

1. **localPoA**: Standard Hardhat network with PoA characteristics
2. **ganachePoW**: Ganache instance configured for PoW

You can modify these in `hardhat.config.js`.

### Contract Configuration

The K-ETS contract is deployed with the following parameters:
- Auction price: 29 ETH
- Credit price: 0.0027 ETH

## Generated Reports

Running the tests generates the following reports:

- **gas-report.json**: Gas usage for PoA transactions
- **gas-report-pow.json**: Gas usage for PoW transactions
- **consensus-comparison-report.json**: Detailed comparison between PoA and PoW

## Key Scripts

- **deploy.js**: Deploys the KETSBlockchain contract
- **simulateTransactions.js**: Measures gas usage for operations on PoA
- **simulateTransactions-pow-simulation.js**: Simulates PoW characteristics
- **check-accounts.js**: Verifies network connection and account balances

## Contract Overview

The `KETSBlockchain.sol` contract includes:

- **Regulator controls**: Authority to verify projects and issue credits
- **Industry registration**: Companies can register with EITE (Energy-Intensive Trade-Exposed) status
- **GHG tracking**: Records CO2, CH4, N2O, HFCs, PFCs, and SF6 emissions
- **Credit allocation**: Free allocation and auction mechanisms
- **Trading system**: Peer-to-peer credit transfers and borrowing

## Gas Optimization Recommendations

Based on analysis, the following optimizations are recommended:

1. **Storage restructuring**: Use ID-based lookups instead of nested arrays
2. **GHG data separation**: Store emissions data in a separate mapping
3. **Auction mechanism optimization**: Split ETH transfers from core logic
4. **Boolean field packing**: Pack boolean values in structs

## License

This project is licensed under the MIT License - see the LICENSE file for details.
