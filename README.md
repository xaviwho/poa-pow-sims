Blockchain Consensus Algorithms Simulation Framework for K-ETS Blockchain

This repository presents a simulation framework designed to evaluate and compare various blockchain consensus mechanisms—specifically **PoA**, **PoW**, **DPoS**, **PBFT**, and **PoA Square**—in the context of the **Korean Emissions Trading Scheme (K-ETS)**. The simulations focus on key performance metrics such as gas usage, block time, throughput, finality, and validator reliability.

---

## Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Consensus Mechanisms Evaluated](#-consensus-mechanisms-evaluated)
- [Simulation Scenarios](#-simulation-scenarios)
- [Results Summary](#-results-summary)
- [Technical Architecture](#-technical-architecture)
- [Installation](#-installation)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## Overview

The goal of this project is to provide a robust simulation environment to assess the performance and suitability of different blockchain consensus algorithms for applications within the K-ETS. By analyzing metrics such as gas consumption, transaction throughput, and validator reliability, stakeholders can make informed decisions on the optimal consensus mechanism for carbon credit trading platforms.

---

## Features

- Simulation of five consensus mechanisms: **PoA**, **PoW**, **DPoS**, **PBFT**, and **PoA Square**.
- Evaluation of performance metrics including:
  - Gas usage
  - Block time
  - Finality
  - Throughput
  - Validator reliability
- Validator scaling tests with configurations of 3, 5, and 7 validators.
- Transaction stress tests with varying transaction rates (1, 2, 5, 10, 20, 50 tx/sec).
- Automated generation of comprehensive performance reports in JSON format.
- Visualization tools for analyzing simulation results.

---

## Consensus Mechanisms Evaluated

- **Proof of Work (PoW):** Traditional consensus mechanism relying on computational effort.
- **Proof of Authority (PoA):** Consensus based on a set of trusted validators.
- **Delegated Proof of Stake (DPoS):** Stakeholder-elected validators participate in consensus.
- **Practical Byzantine Fault Tolerance (PBFT):** Consensus achieved through a multi-phase voting process.
- **PoA Square (PoA²):** Enhanced PoA with validator reliability scoring and replacement mechanisms.

---

## Simulation Scenarios

### Validator Scaling Test

Assesses how each consensus mechanism performs with varying numbers of validators (3, 5, and 7). Metrics evaluated include:

- Gas usage
- Block time
- Transaction throughput

### Transaction Stress Test

Evaluates performance under increasing transaction loads (1, 2, 5, 10, 20, 50 tx/sec) while maintaining a constant number of validators. Metrics evaluated include:

- Success rate
- Latency
- Maximum throughput

---

## Results Summary

| Consensus | Avg. Block Time | Finality       | Throughput (tx/s) | Reliability Score |
|-----------|------------------|----------------|--------------------|-------------------|
| PoW       | 15,000 ms        | ~90,000 ms     | 0.07               | N/A               |
| PoA       | 15,000 ms        | ~15,000 ms     | 0.07               | N/A               |
| DPoS      | 2,918 ms         | ~6,020 ms      | 0.34               | N/A               |
| PBFT      | 876 ms           | 865 ms         | 0.80               | N/A               |
| PoA²      | 8,194 ms         | ~8,194 ms      | 0.65               | 1.0               |

> *Note: PoA² uniquely incorporates a validator reliability scoring system, enhancing network trustworthiness.*

---

## Technical Architecture

- **Local Blockchain Environment:** Simulations run on a local Hardhat node with customized network parameters.
- **Smart Contract Deployment:** A `KETSBlockchain` contract simulates carbon credit operations.
- **Account Simulation:** Programmatic creation of regulator, validator, and industry accounts.
- **Transaction Sequence Generation:** Automated transaction submissions with controlled timing.
- **Metrics Collection:** Precise measurement of gas usage, latency, throughput, and success rates.

---

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/xaviwho/poa-pow-sims.git
   cd poa-pow-sims
## Install dependencies:

  ```bash
  npm install
   ```

## Compile smart contracts:
  ```bash
  npx hardhat compile
  ```


## Usage
Running Validator Scaling Test

  ```bash
  npx hardhat run scripts/validator-scaling-test.js
  ```

## Running Transaction Stress Test
  ```bash
  npx hardhat run scripts/transaction-stress-test.js
  ```

## Viewing Results
Simulation results are stored in the results/ directory in JSON format.

## Project Structure
  ```bash
poa-pow-sims/
├── contracts/                # Smart contracts
├── scripts/                  # Simulation scripts
├── results/                  # Simulation results
├── test/                     # Test cases
├── hardhat.config.js         # Hardhat configuration
├── package.json              # Project metadata and dependencies
└── README.md                 # Project documentation
  ```
## Contributing
Contributions are welcome! Please follow these steps:

Fork the repository

Create a new branch:
  ```bash
git checkout -b feature/YourFeature
  ```
Commit your changes:
  ```bash
  git commit -m "Add your feature"
  ```
Push to the branch:
  ```bash
  git push origin feature/YourFeature
  ```
Open a pull request

📄 License
This project is licensed under the MIT License.

🙏 Acknowledgments
Inspired by the need for efficient and reliable blockchain solutions in environmental markets.

Thanks to the open-source community for tools and frameworks that made this project possible.


