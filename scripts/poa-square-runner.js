/**
 * PoA Square Consensus Runner
 * Implementation of PoA Square (Quorum) consensus for the K-ETS blockchain simulation
 * Connects to the external PureChain network (PoA Square implementation)
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");
const { parseEther } = ethers;
const fs = require("fs");
const path = require("path");

// Constants for simulation
const NUM_VALIDATORS_LOCAL = 4; // Active validators in local environment
const NUM_STANDBY_VALIDATORS_LOCAL = 2; // Standby validators for local environment

// PureChain network has limited accounts, so we adjust when running there
const NUM_VALIDATORS_PURECHAIN = 1; // Just a single validator for PureChain
const NUM_STANDBY_VALIDATORS_PURECHAIN = 0; // No standby validators for PureChain

// These will be set dynamically based on the network
let NUM_VALIDATORS;
let NUM_STANDBY_VALIDATORS;
const BLOCK_TIME = 4000; // 4 seconds
const REQUIRED_CONFIRMATIONS = 1; // PoA Square has immediate finality
const NUM_TRANSACTIONS = 10; // Number of transactions to simulate
const SQUARE_VOTING_ROUNDS = 2; // Number of voting rounds in the square protocol

// PoA Square specific constants
const RELIABILITY_THRESHOLD = 0.75; // 75% minimum reliability score
const FAILURE_PROBABILITY = 0.1; // 10% chance of validator failure
const RELIABILITY_DECAY = 0.05; // 5% reliability decay per failure

// Log file setup
const LOG_FILE = path.join(__dirname, "../logs/poa-square-measurements.json");
const LOG_DIR = path.dirname(LOG_FILE);

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Measurement data structure
const measurements = {
  consensusMechanism: "PoA-Square",
  transactions: [],
  blocks: [],
  finalityTimes: [],
  gasUsage: [],
  resourceUsage: [],
  networkMessages: [],
  validators: [],
  validatorReplacements: [],
  reliabilityScores: [],
  startTime: null,
  endTime: null
};

// Validator state tracking
class ValidatorState {
  /**
   * Validator state tracking
   */
  constructor(address, index, activeValidatorCount) {
    this.address = address;
    this.index = index;
    this.isActive = index < activeValidatorCount; // First N validators are active
    this.isStandby = !this.isActive;
    this.reliability = 1.0; // Start with perfect reliability
    this.blocksProposed = 0;
    this.blocksValidated = 0;
    this.failures = 0;
    this.replacementCount = 0;
  }
  
  // Calculate if validator fails during a round
  simulateFailure() {
    // More likely to fail if reliability is already low
    const failureProbability = FAILURE_PROBABILITY * (2 - this.reliability);
    const fails = Math.random() < failureProbability;
    
    if (fails) {
      this.failures++;
      this.reliability = Math.max(0, this.reliability - RELIABILITY_DECAY);
      return true;
    }
    return false;
  }
  
  // Record successful block validation
  recordSuccess() {
    this.blocksValidated++;
    // Small reliability recovery for successful participation
    this.reliability = Math.min(1.0, this.reliability + (RELIABILITY_DECAY / 2));
  }
  
  // Record successful block proposal
  recordProposal() {
    this.blocksProposed++;
    // Greater reliability improvement for successful proposal
    this.reliability = Math.min(1.0, this.reliability + RELIABILITY_DECAY);
  }
  
  // Check if validator needs replacement
  needsReplacement() {
    return this.isActive && this.reliability < RELIABILITY_THRESHOLD;
  }
};

// Validator management for PoA Square
class ValidatorManager {
  /**
   * Validator management for PoA Square
   */
  constructor(validatorAccounts) {
    this.validators = validatorAccounts.map((account, index) => {
      return new ValidatorState(account.address, index, NUM_VALIDATORS);
    });
    
    this.activeValidators = this.validators.filter(v => v.isActive);
    this.standbyValidators = this.validators.filter(v => v.isStandby);
    
    // Record initial validator state
    this.recordValidatorState();
  }
  
  // Get current active validators
  getActiveValidators() {
    return this.validators.filter(v => v.isActive);
  }
  
  // Get current standby validators
  getStandbyValidators() {
    return this.validators.filter(v => v.isStandby);
  }
  
  // Select primary validator for a block
  selectPrimary(blockNumber) {
    const activeValidators = this.getActiveValidators();
    const primaryIndex = blockNumber % activeValidators.length;
    return activeValidators[primaryIndex];
  }
  
  // Process validator failures and replacements
  processValidatorStatus() {
    const replacements = [];
    
    // Check for validators that need replacement
    for (const validator of this.getActiveValidators()) {
      if (validator.needsReplacement()) {
        // Find best standby validator to replace it
        const standbyValidators = this.getStandbyValidators();
        if (standbyValidators.length > 0) {
          // Sort by reliability (highest first)
          standbyValidators.sort((a, b) => b.reliability - a.reliability);
          const replacement = standbyValidators[0];
          
          // Record replacement
          const replacementEvent = {
            timestamp: Date.now(),
            replaced: validator.address,
            replacedReliability: validator.reliability,
            replacement: replacement.address,
            replacementReliability: replacement.reliability
          };
          replacements.push(replacementEvent);
          
          // Update state
          validator.isActive = false;
          validator.isStandby = true;
          replacement.isActive = true;
          replacement.isStandby = false;
          replacement.replacementCount++;
          
          console.log(`Validator replacement: ${validator.address.substring(0, 10)}... (reliability: ${validator.reliability.toFixed(2)}) replaced by ${replacement.address.substring(0, 10)}... (reliability: ${replacement.reliability.toFixed(2)})`);
        } else {
          console.log(`Warning: Validator ${validator.address.substring(0, 10)}... needs replacement but no standby validators available`);
        }
      }
    }
    
    // Record replacements
    if (replacements.length > 0) {
      measurements.validatorReplacements.push(...replacements);
    }
    
    // Record new validator state
    this.recordValidatorState();
    
    return replacements.length > 0;
  }
  
  // Record current validator states for measurement
  recordValidatorState() {
    const validatorState = {
      timestamp: Date.now(),
      activeValidators: this.getActiveValidators().map(v => ({
        address: v.address,
        reliability: v.reliability,
        blocksProposed: v.blocksProposed,
        blocksValidated: v.blocksValidated,
        failures: v.failures
      })),
      standbyValidators: this.getStandbyValidators().map(v => ({
        address: v.address,
        reliability: v.reliability,
        blocksProposed: v.blocksProposed,
        blocksValidated: v.blocksValidated,
        failures: v.failures
      }))
    };
    
    measurements.reliabilityScores.push(validatorState);
  }
}

/**
 * Simulates the PoA Square consensus mechanism
 * PoA Square uses reliability-based validator selection and dynamic validator replacement
 */
async function runPoASquareConsensus() {
  console.log("Starting PoA Square consensus simulation with reliability-based validation...");
  measurements.startTime = Date.now();

  // Detect which network we're running on
  const networkName = hre.network.name;
  console.log(`Running on network: ${networkName}`);
  
  // Set validator counts based on network
  if (networkName === 'purechain') {
    NUM_VALIDATORS = NUM_VALIDATORS_PURECHAIN;
    NUM_STANDBY_VALIDATORS = NUM_STANDBY_VALIDATORS_PURECHAIN;
    console.log("Using PureChain configuration with reduced validator count");
  } else {
    NUM_VALIDATORS = NUM_VALIDATORS_LOCAL;
    NUM_STANDBY_VALIDATORS = NUM_STANDBY_VALIDATORS_LOCAL;
    console.log("Using local configuration with full validator set");
  }
  
  console.log(`Active validators: ${NUM_VALIDATORS}, Standby validators: ${NUM_STANDBY_VALIDATORS}`);

  // We'll simulate locally for academic measurement purposes
  console.log("Initializing PoA Square consensus with reliability tracking...");
  
  // Deploy the contract
  const KETSFactory = await ethers.getContractFactory("KETSBlockchain");
  const deployTx = await KETSFactory.deploy();
  const ketsContract = await deployTx.waitForDeployment();
  const contractAddress = await ketsContract.getAddress();
  console.log(`Contract deployed at: ${contractAddress}`);
  
  // Record the deployment information
  measurements.contractAddress = contractAddress;
  
  // Get accounts
  const allAccounts = await ethers.getSigners();
  console.log(`Available accounts: ${allAccounts.length}`);
  
  // Handle account allocation based on network
  let regulator;
  let validatorAccounts = [];
  
  if (networkName === 'purechain') {
    // For PureChain, utilize all available accounts efficiently
    console.log("PureChain mode: Using multiple accounts for validators");
    regulator = allAccounts[0];
    
    // Use accounts 1-4 as validators (if available)
    const availableForValidators = allAccounts.slice(1);
    console.log(`Available accounts for validators: ${availableForValidators.length}`);
    
    // Determine how many validators we can have
    if (availableForValidators.length >= 4) {
      // Ideal scenario: 4 active validators
      NUM_VALIDATORS = 4;
      NUM_STANDBY_VALIDATORS = 0;
      validatorAccounts = availableForValidators.slice(0, 4);
    } else if (availableForValidators.length >= 2) {
      // Good scenario: At least 2 validators (minimum for meaningful voting)
      NUM_VALIDATORS = availableForValidators.length;
      NUM_STANDBY_VALIDATORS = 0;
      validatorAccounts = [...availableForValidators];
    } else if (availableForValidators.length === 1) {
      // Minimal scenario: 1 validator from accounts + regulator as validator
      console.log("Limited accounts available, adding regulator as validator");
      NUM_VALIDATORS = 2;
      NUM_STANDBY_VALIDATORS = 0;
      validatorAccounts = [regulator, ...availableForValidators];
    } else {
      // Fallback: Just use regulator as validator
      console.log("No additional accounts, using regulator as validator");
      NUM_VALIDATORS = 1;
      NUM_STANDBY_VALIDATORS = 0;
      validatorAccounts = [regulator];
    }
  } else {
    // For local network, separate regulator from validators
    regulator = allAccounts[0];
    const remainingAccounts = allAccounts.slice(1);
    console.log(`Regulator: ${regulator.address}`);
    console.log(`Available validator accounts: ${remainingAccounts.length}`);
    
    // Set up validator accounts - need enough for active + standby
    const requiredValidators = NUM_VALIDATORS + NUM_STANDBY_VALIDATORS;
    
    // Check if we have enough accounts
    if (remainingAccounts.length < requiredValidators) {
      console.warn(`Warning: Not enough accounts. Need ${requiredValidators} validators but only have ${remainingAccounts.length}`);
      console.warn("Adjusting validator configuration to match available accounts...");
      
      if (remainingAccounts.length > 0) {
        // Adjust the validator counts based on what we have
        if (NUM_STANDBY_VALIDATORS > 0 && remainingAccounts.length <= NUM_VALIDATORS) {
          // Use all available accounts as active validators, no standbys
          NUM_VALIDATORS = remainingAccounts.length;
          NUM_STANDBY_VALIDATORS = 0;
          console.log(`Adjusted to ${NUM_VALIDATORS} active validators with no standbys`);
        } else if (NUM_STANDBY_VALIDATORS > 0) {
          // Use at least one standby if possible
          NUM_VALIDATORS = remainingAccounts.length - 1;
          NUM_STANDBY_VALIDATORS = 1;
          console.log(`Adjusted to ${NUM_VALIDATORS} active validators with 1 standby`);
        }
      } else {
        throw new Error("No validator accounts available. Cannot proceed.");
      }
    }
    
    validatorAccounts = remainingAccounts.slice(0, Math.min(requiredValidators, remainingAccounts.length));
  }
  
  console.log(`Active validators to use: ${NUM_VALIDATORS}`);
  console.log(`Standby validators to use: ${NUM_STANDBY_VALIDATORS}`);
  console.log(`Total validator accounts: ${validatorAccounts.length}`);
  
  // Setup validators with the reliability-based manager
  const validatorManager = new ValidatorManager(validatorAccounts);
  console.log(`Active validators: ${validatorManager.getActiveValidators().length}`);
  console.log(`Standby validators: ${validatorManager.getStandbyValidators().length}`);
  
  // Log initial reliability scores
  console.log("Initial validator reliability scores:");
  validatorManager.getActiveValidators().forEach(v => {
    console.log(`- ${v.address.substring(0, 10)}...: ${v.reliability.toFixed(2)}`);
  });
  
  // Set up industry accounts
  let industries = [];
  
  if (networkName === 'purechain') {
    // For PureChain, try to allocate remaining accounts to industries
    const usedAccountCount = 1 + validatorAccounts.length; // 1 regulator + validators
    const remainingAccounts = allAccounts.slice(usedAccountCount);
    console.log(`Accounts used so far: ${usedAccountCount}, Remaining: ${remainingAccounts.length}`);
    
    if (remainingAccounts.length >= 3) {
      // Ideal: Use 3 separate accounts for industries
      console.log("Using separate accounts for each industry");
      industries = remainingAccounts.slice(0, 3);
    } else if (remainingAccounts.length > 0) {
      // Use the remaining accounts + reuse one for the rest
      console.log(`Using ${remainingAccounts.length} unique accounts for industries, reusing for the rest`);
      industries = [...remainingAccounts];
      
      // Fill the rest with the first industry account or regulator
      while (industries.length < 3) {
        industries.push(remainingAccounts[0] || regulator);
      }
    } else {
      // No accounts left, reuse the regulator
      console.log("No accounts left for industries, reusing regulator");
      industries = [regulator, regulator, regulator];
    }
  } else {
    // For local network, use separate accounts for industries
    // Use accounts after validators
    const startIndex = NUM_VALIDATORS + NUM_STANDBY_VALIDATORS + 1; // +1 for regulator
    const endIndex = Math.min(startIndex + 3, allAccounts.length);
    industries = allAccounts.slice(startIndex, endIndex);
    
    // If we don't have enough accounts, reuse some
    while (industries.length < 3) {
      industries.push(industries[0] || allAccounts[0]);
    }
  }
  
  console.log(`Industry accounts: ${industries.length}`);
  
  // Record network type in measurements
  measurements.networkInfo = {
    consensusMechanism: "PoA-Square",
    activeValidators: NUM_VALIDATORS,
    standbyValidators: NUM_STANDBY_VALIDATORS,
    reliabilityThreshold: RELIABILITY_THRESHOLD,
    failureProbability: FAILURE_PROBABILITY
  };

  // Register industries
  console.log("Registering industries...");
  for (let i = 0; i < industries.length; i++) {
    const isEITE = i % 2 === 0; // Alternate EITE status
    const industryName = `Industry-${i+1}`;
    
    const tx = await ketsContract.connect(industries[i]).registerIndustry(industryName, isEITE);
    const receipt = await tx.wait();
    
    recordTransaction(receipt, "registerIndustry");
    console.log(`Registered industry ${industryName}, Gas used: ${receipt.gasUsed.toString()}`);
    
    // Simulate PoA Square consensus with reliability tracking
    await simulatePoASquareConsensus(receipt.transactionHash, validatorManager);
    
    // Check if validator status changed after this transaction
    validatorManager.processValidatorStatus();
  }

  // Update GHG emissions
  console.log("Updating GHG emissions...");
  for (let i = 0; i < industries.length; i++) {
    // The contract's updateGHGEmissions function signature is:
    // updateGHGEmissions(address _industryOwner, uint industryIndex, uint _CO2, uint _CH4, uint _N2O, uint _HFCs, uint _PFCs, uint _SF6)
    const industryAddress = industries[i].address;
    const industryIndex = 0; // First industry for each address

    const tx = await ketsContract.connect(industries[i]).updateGHGEmissions(
      industryAddress,     // _industryOwner
      industryIndex,      // industryIndex
      5000 + i * 1000,    // _CO2
      2000 + i * 500,     // _CH4
      1000 + i * 200,     // _N2O
      3000 + i * 300,     // _HFCs
      2000 + i * 250,     // _PFCs
      1000 + i * 100      // _SF6
    );
    const receipt = await tx.wait();
    
    recordTransaction(receipt, "updateGHGEmissions");
    console.log(`Updated GHG emissions for Industry-${i+1}, Gas used: ${receipt.gasUsed.toString()}`);
    
    // Simulate PoA Square consensus with reliability tracking
    await simulatePoASquareConsensus(receipt.transactionHash, validatorManager);
    
    // Check if validator status changed after this transaction
    validatorManager.processValidatorStatus();
  }

  // Create auction
  console.log("Creating auction...");
  const createAuctionTx = await ketsContract.connect(regulator).createAuction(100, parseEther("0.01"));
  const createAuctionReceipt = await createAuctionTx.wait();
  
  recordTransaction(createAuctionReceipt, "createAuction");
  console.log(`Created auction, Gas used: ${createAuctionReceipt.gasUsed.toString()}`);
  
  // Simulate PoA Square consensus with reliability tracking
  await simulatePoASquareConsensus(createAuctionReceipt.transactionHash, validatorManager);
  
  // Check if validator status changed after this transaction
  validatorManager.processValidatorStatus();

  // Place bids
  console.log("Placing bids...");
  for (let i = 0; i < industries.length; i++) {
    try {
      // For simplicity, just use a fixed bid amount above the minimum
      const bidAmount = parseEther("0.02");
      const tx = await ketsContract.connect(industries[i]).placeBid(10, { value: bidAmount });
      const receipt = await tx.wait();
      
      recordTransaction(receipt, "placeBid");
      console.log(`Placed bid for Industry-${i+1}, Gas used: ${receipt.gasUsed.toString()}`);
      
      // Simulate PoA Square consensus with reliability tracking
      await simulatePoASquareConsensus(receipt.transactionHash, validatorManager);
      
      // Check if validator status changed after this transaction
      validatorManager.processValidatorStatus();
    } catch (error) {
      console.error(`Error placing bid for Industry-${i+1}:`, error.message);
    }
  }

  // Finalize the auction
  console.log("Finalizing auction...");
  try {
    const finalizeTx = await ketsContract.connect(regulator).finalizeAuction();
    const finalizeReceipt = await finalizeTx.wait();
    
    recordTransaction(finalizeReceipt, "finalizeAuction");
    console.log(`Finalized auction, Gas used: ${finalizeReceipt.gasUsed.toString()}`);
    
    // Simulate PoA Square consensus with reliability tracking
    await simulatePoASquareConsensus(finalizeReceipt.transactionHash, validatorManager);
    
    // Final check of validator reliability status
    validatorManager.processValidatorStatus();
  } catch (error) {
    console.error("Error finalizing auction:", error.message);
  }

  // Record end time
  measurements.endTime = Date.now();
  console.log("PoA Square consensus simulation completed");
  
  // Save measurements
  saveMeasurements();
  
  // Return summary
  return {
    consensusMechanism: "PoA-Square",
    transactionsProcessed: measurements.transactions.length,
    averageGasUsed: calculateAverageGas(),
    averageFinality: calculateAverageFinality(),
    totalDuration: measurements.endTime - measurements.startTime
  };
}

/**
 * Simulates PoA Square consensus with reliability-based validator selection
 */
async function simulatePoASquareConsensus(txHash, validatorManager) {
  const blockNumber = measurements.blocks.length + 1;
  const timestamp = Date.now();
  
  console.log(`\n--- PoA Square Block ${blockNumber} Consensus ---`);
  // Safe way to show txHash with a check
  const txHashDisplay = typeof txHash === 'string' && txHash.length > 10 ? 
    `${txHash.substring(0, 10)}...` : 
    `[hash unavailable]`;
  console.log(`Transaction ${txHashDisplay} processing with reliability-based consensus`);
  
  // Get active validators and their reliability scores
  const activeValidators = validatorManager.getActiveValidators();
  console.log(`Active validators: ${activeValidators.length}`);
  
  // Select primary validator based on round robin pattern
  const primary = validatorManager.selectPrimary(blockNumber);
  console.log(`Primary validator: ${primary.address.substring(0, 10)}... (reliability: ${primary.reliability.toFixed(2)})`);
  
  // Phase 1: Propose block - check if primary fails
  const primaryFails = primary.simulateFailure();
  if (primaryFails) {
    console.log(`⚠️ Primary validator ${primary.address.substring(0, 10)}... FAILED during proposal phase!`);
    console.log(`Reliability decreased to ${primary.reliability.toFixed(2)}`);
    
    // Record the failure in the block data
    measurements.blocks.push({
      number: blockNumber,
      timestamp,
      proposer: primary.address,
      proposerReliability: primary.reliability,
      status: 'failed',
      failurePhase: 'proposal',
      finalityTime: null
    });
    
    // No finality since block proposal failed
    return null;
  }
  
  // Primary successfully proposes the block
  primary.recordProposal();
  console.log(`Primary validator successfully proposed block ${blockNumber}`);
  
  // Phase 2: Validation - other validators check the block
  let validations = 0;
  let validatorFailures = 0;
  let reliabilityTotal = 0;
  
  console.log("Validator voting phase:");
  for (const validator of activeValidators) {
    if (validator === primary) continue; // Primary already processed
    
    // Check if this validator fails during validation
    const validatorFails = validator.simulateFailure();
    
    if (validatorFails) {
      console.log(`⚠️ Validator ${validator.address.substring(0, 10)}... FAILED during validation! ` +
                 `Reliability: ${validator.reliability.toFixed(2)}`);
      validatorFailures++;
    } else {
      validator.recordSuccess();
      validations++;
      reliabilityTotal += validator.reliability;
      console.log(`✓ Validator ${validator.address.substring(0, 10)}... confirmed block ` +
                 `(reliability: ${validator.reliability.toFixed(2)})`);
    }
  }
  
  // Calculate if we have enough validations for consensus
  // PoA Square requires a reliability-weighted majority
  const validatorsNeeded = Math.ceil(activeValidators.length / 2);
  const reliabilityScore = reliabilityTotal / activeValidators.length;
  
  console.log(`Received ${validations} valid confirmations (need ${validatorsNeeded}), ` +
              `average reliability score: ${reliabilityScore.toFixed(2)}`);
  
  // Check if block reaches consensus
  const consensusReached = validations >= validatorsNeeded && reliabilityScore >= RELIABILITY_THRESHOLD;
  
  let finalityTime;
  if (consensusReached) {
    // Consensus reached - calculate finality time including reliability check
    const reliabilityCheckTime = 50; // ms - time to calculate reliability
    finalityTime = BLOCK_TIME + reliabilityCheckTime;
    
    console.log(`✅ Consensus REACHED for block ${blockNumber} with reliability-weighted validation`);
    console.log(`Block finalized in ${finalityTime}ms with reliability score ${reliabilityScore.toFixed(2)}`);
    
    // Record successful block
    measurements.blocks.push({
      number: blockNumber,
      timestamp,
      proposer: primary.address,
      proposerReliability: primary.reliability,
      validations,
      validatorFailures,
      reliabilityScore,
      status: 'finalized',
      finalityTime
    });
    
    // Record finality time
    measurements.finalityTimes.push({
      blockNumber,
      txHash,
      finalityTime,
      reliabilityScore,
      timestamp: Date.now()
    });
  } else {
    // Consensus failed - not enough reliable validators
    console.log(`❌ Consensus FAILED for block ${blockNumber} - ` + 
                `insufficient reliable validations (${validations}/${validatorsNeeded}) ` +
                `or reliability score (${reliabilityScore.toFixed(2)}/${RELIABILITY_THRESHOLD})`);
    
    // Record failed block
    measurements.blocks.push({
      number: blockNumber,
      timestamp,
      proposer: primary.address,
      proposerReliability: primary.reliability,
      validations,
      validatorFailures,
      reliabilityScore,
      status: 'failed',
      failurePhase: 'validation'
    });
    
    return null;
  }
  
  // Calculate network overhead - PoA Square uses a reliability messaging pattern
  // that scales with the square of the number of validators
  const activeValidatorCount = activeValidators.length;
  
  // Messages include:
  // 1. Block proposal from primary to all validators
  // 2. Reliability scores exchange (each to each)
  // 3. Validation messages from each validator to all others
  const proposalMessages = activeValidatorCount;
  const reliabilityMessages = activeValidatorCount * activeValidatorCount;
  const validationMessages = validations * activeValidatorCount;
  const totalMessages = proposalMessages + reliabilityMessages + validationMessages;
  
  // Record network overhead
  measurements.networkMessages.push({
    blockNumber,
    proposalMessages,
    reliabilityMessages,
    validationMessages,
    totalMessages,
    messageSize: 1024, // Bytes
    totalBandwidth: totalMessages * 1024
  });
  
  // Record resource usage for PoA Square
  recordResourceUsage(blockNumber, reliabilityScore);
  
  return finalityTime;
}

/**
 * Record transaction metrics
 */
function recordTransaction(receipt, txType) {
  // Record general transaction data
  measurements.transactions.push({
    hash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    type: txType,
    timestamp: Date.now()
  });
  
  // Record gas usage
  measurements.gasUsage.push({
    txType,
    gasUsed: receipt.gasUsed.toString(),
    timestamp: Date.now()
  });
}

/**
 * Records simulated resource usage for the PoA Square consensus with reliability tracking
 * @param {number} blockNumber - The block number
 * @param {number} reliabilityScore - Average reliability score of validators
 */
function recordResourceUsage(blockNumber, reliabilityScore = 1.0) {
  // Simulate resource measurements with reliability factor
  // For PoA Square, resource usage is influenced by reliability scores
  // Lower reliability means more overhead for consensus
  const reliabilityFactor = reliabilityScore > 0 ? 1 / reliabilityScore : 2;
  
  // Base resource usage
  const baseCpuUsage = 20; // percentage
  const baseMemoryUsage = 200; // MB
  const baseNetworkBandwidth = 500; // KB/s
  
  // Adjusted for reliability - lower reliability means higher resource usage
  const cpuUsage = baseCpuUsage * (1 + (0.5 * reliabilityFactor)) + (Math.random() * 10);
  const memoryUsage = baseMemoryUsage * (1 + (0.25 * reliabilityFactor)) + (Math.random() * 50);
  const networkBandwidth = baseNetworkBandwidth * (1 + (0.75 * reliabilityFactor)) + (Math.random() * 200);
  
  measurements.resourceUsage.push({
    blockNumber,
    timestamp: Date.now(),
    reliability: reliabilityScore,
    reliabilityFactor,
    cpu: cpuUsage,
    memory: memoryUsage,
    network: networkBandwidth,
    messageComplexity: "O(n²)", // Square messaging complexity
    reliabilityBasedComplexity: `O(n² * ${reliabilityFactor.toFixed(2)})` // Reliability-adjusted complexity
  });
}

/**
 * Calculates the average gas used across transactions
 */
function calculateAverageGas() {
  if (measurements.gasUsage.length === 0) return 0;
  
  const totalGas = measurements.gasUsage.reduce(
    (sum, tx) => sum + BigInt(tx.gasUsed), 
    BigInt(0)
  );
  
  return Number(totalGas / BigInt(measurements.gasUsage.length));
}

/**
 * Calculates the average finality time across blocks
 */
function calculateAverageFinality() {
  if (measurements.finalityTimes.length === 0) return 0;
  
  const totalFinality = measurements.finalityTimes.reduce(
    (sum, block) => sum + block.finalityTime, 
    0
  );
  
  return totalFinality / measurements.finalityTimes.length;
}

/**
 * Saves measurement data to file
 */
function saveMeasurements() {
  try {
    fs.writeFileSync(
      LOG_FILE, 
      JSON.stringify(measurements, null, 2),
      'utf8'
    );
    console.log(`Measurements saved to ${LOG_FILE}`);
  } catch (error) {
    console.error("Error saving measurements:", error);
  }
}

/**
 * Utility to simulate async waiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the simulation when called directly
if (require.main === module) {
  runPoASquareConsensus()
    .then(summary => {
      console.log("Simulation Summary:", summary);
      process.exit(0);
    })
    .catch(error => {
      console.error("Simulation failed:", error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = {
    runPoASquareConsensus
  };
}
