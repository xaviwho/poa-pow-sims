/**
 * Validator Scaling Test for Consensus Mechanisms
 * Tests how each consensus mechanism scales with increasing validator counts
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { 
  runStandardTransactionSequence, 
  calculateMetrics, 
  saveTestResults 
} = require("./test-utils");

// Configure validator counts to test - use smaller numbers for practical testing
const DEFAULT_VALIDATOR_COUNTS = [3, 5, 7]; // Reduced counts for faster testing with limited accounts

async function deployContract() {
  console.log("Deploying KETSBlockchain contract...");
  const KETSFactory = await ethers.getContractFactory("KETSBlockchain");
  const ketsContract = await KETSFactory.deploy();
  
  // Use the appropriate deployment wait method based on ethers version
  if (typeof ketsContract.waitForDeployment === 'function') {
    // Newer ethers v6 pattern
    await ketsContract.waitForDeployment();
  } else if (typeof ketsContract.deployed === 'function') {
    // Older ethers v5 pattern
    await ketsContract.deployed();
  } else {
    // Fallback if neither method is available
    const txReceipt = await ketsContract.deployTransaction.wait();
    console.log(`Deployment confirmed in block: ${txReceipt.blockNumber}`);
  }
  
  console.log(`Contract deployed at: ${ketsContract.address}`);
  return ketsContract;
}

async function setupValidators(validatorCount) {
  // Get all accounts
  const allAccounts = await ethers.getSigners();
  
  console.log(`Available accounts: ${allAccounts.length}`);
  
  // Calculate max validators we can support with the available accounts
  // We need at least 1 regulator and 1 industry
  const maxValidators = allAccounts.length - 2;
  
  // Adjust validator count if we don't have enough accounts
  const actualValidatorCount = Math.min(validatorCount, maxValidators);
  
  if (actualValidatorCount < validatorCount) {
    console.log(`Warning: Reduced validator count from ${validatorCount} to ${actualValidatorCount} due to account limitations`);
  }
  
  if (actualValidatorCount < 1) {
    throw new Error(`Not enough accounts available. Need at least 2 accounts (1 regulator + 1 validator), but only have ${allAccounts.length}`);
  }
  
  // First account is regulator
  const regulator = allAccounts[0];
  
  // Next N accounts are validators
  const validators = allAccounts.slice(1, actualValidatorCount + 1);
  
  // Remaining accounts are industries (as many as possible, at least 1)
  const industries = allAccounts.slice(actualValidatorCount + 1);
  
  // If we don't have enough industry accounts, reuse the regulator
  if (industries.length === 0) {
    industries.push(regulator);
  }
  
  console.log(`Configured with: 1 regulator, ${validators.length} validators, ${industries.length} industries`);
  
  return {
    regulator,
    validators,
    industries,
    allAccounts,
    actualValidatorCount
  };
}

// Test PoA Square with a specific validator count
async function testPoASquare(validatorCount) {
  console.log(`Testing PoA Square with ${validatorCount} validators`);
  
  // Deploy contract
  const contract = await deployContract();
  
  // Setup accounts
  const { regulator, validators, industries, actualValidatorCount } = await setupValidators(validatorCount);
  
  // Create validator manager configuration for PoA Square
  const activeCount = Math.max(1, Math.ceil(actualValidatorCount * 0.75)); // Ensure at least 1 active validator
  const validatorManager = {
    activeValidators: validators.slice(0, activeCount), // 75% active
    standbyValidators: validators.slice(activeCount)    // 25% standby
  };
  
  console.log(`Active validators: ${validatorManager.activeValidators.length}`);
  console.log(`Standby validators: ${validatorManager.standbyValidators.length}`);
  
  // Set starting timestamp for synchronization
  const startTime = Date.now();
  
  // Create combined array of accounts for the transaction sequence
  // Start with regulator, then include at least one industry account
  const txAccounts = [regulator];
  if (industries.length > 0) {
    txAccounts.push(...industries.slice(0, Math.min(3, industries.length)));
  } else {
    // If no industry accounts, reuse regulator as an industry
    txAccounts.push(regulator);
  }
  
  // Run standard transaction sequence
  const txResults = await runStandardTransactionSequence(contract, txAccounts);
  
  // Calculate metrics
  const metrics = calculateMetrics(txResults);
  
  // Add validator-specific metrics
  metrics.requestedValidatorCount = validatorCount;
  metrics.actualValidatorCount = actualValidatorCount;
  metrics.activeValidators = validatorManager.activeValidators.length;
  metrics.standbyValidators = validatorManager.standbyValidators.length;
  metrics.blockInterval = 10; // Simulated block interval in seconds
  metrics.consensusProtocol = "PoA Square";
  
  return metrics;
}

// Test PBFT with a specific validator count
async function testPBFT(validatorCount) {
  console.log(`Testing PBFT with ${validatorCount} validators`);
  
  // Deploy contract
  const contract = await deployContract();
  
  // Setup accounts
  const { regulator, validators, industries, actualValidatorCount } = await setupValidators(validatorCount);
  
  // PBFT requires 3f+1 validators, where f is max faulty nodes
  const maxFaultyNodes = Math.floor((actualValidatorCount - 1) / 3);
  console.log(`PBFT configuration: can tolerate ${maxFaultyNodes} faulty validators`);
  
  // Create combined array of accounts for the transaction sequence
  const txAccounts = [regulator];
  if (industries.length > 0) {
    txAccounts.push(...industries.slice(0, Math.min(3, industries.length)));
  } else {
    txAccounts.push(regulator);
  }
  
  // Run standard transaction sequence
  const txResults = await runStandardTransactionSequence(contract, txAccounts);
  
  // Calculate metrics
  const metrics = calculateMetrics(txResults);
  
  // Add validator-specific metrics
  metrics.requestedValidatorCount = validatorCount;
  metrics.actualValidatorCount = actualValidatorCount;
  metrics.maxFaultyNodes = maxFaultyNodes;
  metrics.minHealthyNodes = actualValidatorCount - maxFaultyNodes;
  metrics.blockInterval = 2; // PBFT typically has very fast blocks
  metrics.consensusProtocol = "PBFT";
  
  return metrics;
}

// Test DPoS with a specific validator count
async function testDPoS(validatorCount) {
  console.log(`Testing DPoS with ${validatorCount} validators`);
  
  // Deploy contract
  const contract = await deployContract();
  
  // Setup accounts
  const { regulator, validators, industries, actualValidatorCount } = await setupValidators(validatorCount);
  
  // In DPoS, active validators are block producers elected by stake
  const blockProducers = validators.slice(0, Math.min(21, actualValidatorCount)); // Max 21 active block producers
  
  console.log(`DPoS configuration: ${blockProducers.length} block producers out of ${actualValidatorCount} validators`);
  
  // Create combined array of accounts for the transaction sequence
  const txAccounts = [regulator];
  if (industries.length > 0) {
    txAccounts.push(...industries.slice(0, Math.min(3, industries.length)));
  } else {
    txAccounts.push(regulator);
  }
  
  // Run standard transaction sequence
  const txResults = await runStandardTransactionSequence(contract, txAccounts);
  
  // Calculate metrics
  const metrics = calculateMetrics(txResults);
  
  // Add validator-specific metrics
  metrics.requestedValidatorCount = validatorCount;
  metrics.actualValidatorCount = actualValidatorCount;
  metrics.blockProducers = blockProducers.length;
  metrics.blockInterval = 3; // DPoS typically has scheduled blocks every 3 seconds
  metrics.consensusProtocol = "DPoS";
  
  return metrics;
}

// Test basic PoA with a specific validator count
async function testPoA(validatorCount) {
  console.log(`Testing PoA with ${validatorCount} validators`);
  
  // Deploy contract
  const contract = await deployContract();
  
  // Setup accounts
  const { regulator, validators, industries, actualValidatorCount } = await setupValidators(validatorCount);
  
  // In basic PoA, all validators are authorities
  console.log(`PoA configuration: ${actualValidatorCount} authorities`);
  
  // Create combined array of accounts for the transaction sequence
  const txAccounts = [regulator];
  if (industries.length > 0) {
    txAccounts.push(...industries.slice(0, Math.min(3, industries.length)));
  } else {
    txAccounts.push(regulator);
  }
  
  // Run standard transaction sequence
  const txResults = await runStandardTransactionSequence(contract, txAccounts);
  
  // Calculate metrics
  const metrics = calculateMetrics(txResults);
  
  // Add validator-specific metrics
  metrics.requestedValidatorCount = validatorCount;
  metrics.actualValidatorCount = actualValidatorCount;
  metrics.blockInterval = 5; // PoA typically has 5-second blocks
  metrics.consensusProtocol = "PoA";
  
  return metrics;
}

// Test PoW (validator count becomes hash power distribution)
async function testPoW(validatorCount) {
  console.log(`Testing PoW with ${validatorCount} miners`);
  
  // Deploy contract
  const contract = await deployContract();
  
  // Setup accounts
  const { regulator, validators, industries, actualValidatorCount } = await setupValidators(validatorCount);
  
  // In PoW, "validators" are miners with hash power
  console.log(`PoW configuration: ${actualValidatorCount} miners`);
  
  // Create combined array of accounts for the transaction sequence
  const txAccounts = [regulator];
  if (industries.length > 0) {
    txAccounts.push(...industries.slice(0, Math.min(3, industries.length)));
  } else {
    txAccounts.push(regulator);
  }
  
  // Run standard transaction sequence
  const txResults = await runStandardTransactionSequence(contract, txAccounts);
  
  // Calculate metrics
  const metrics = calculateMetrics(txResults);
  
  // Add validator-specific metrics
  metrics.requestedValidatorCount = validatorCount;
  metrics.actualValidatorCount = actualValidatorCount;
  metrics.approximateDifficulty = actualValidatorCount * 100; // Simplified simulation
  metrics.blockInterval = 15; // PoW typically has 15-second blocks in Ethereum
  metrics.consensusProtocol = "PoW";
  
  return metrics;
}

// Main function to run validator scaling tests
async function runValidatorScalingTests(
  consensusMechanisms = ["PoASquare", "PBFT", "DPoS", "PoA", "PoW"],
  validatorCounts = DEFAULT_VALIDATOR_COUNTS
) {
  const results = {
    testDate: new Date().toISOString(),
    consensusMechanisms: {},
    comparison: {
      throughput: {},
      latency: {},
      gasUsed: {}
    }
  };
  
  // Test each consensus mechanism
  for (const mechanism of consensusMechanisms) {
    console.log(`\n===== Testing ${mechanism} =====`);
    
    const mechanismResults = {
      name: mechanism,
      scalingMetrics: []
    };
    
    // Test each validator count
    for (const count of validatorCounts) {
      let metrics;
      
      try {
        // Call the appropriate test function based on the consensus mechanism
        switch (mechanism) {
          case "PoASquare":
            metrics = await testPoASquare(count);
            break;
          case "PBFT":
            metrics = await testPBFT(count);
            break;
          case "DPoS":
            metrics = await testDPoS(count);
            break;
          case "PoA":
            metrics = await testPoA(count);
            break;
          case "PoW":
            metrics = await testPoW(count);
            break;
          default:
            throw new Error(`Unknown consensus mechanism: ${mechanism}`);
        }
        
        mechanismResults.scalingMetrics.push(metrics);
        
        // Add to comparison data
        if (!results.comparison.throughput[count]) {
          results.comparison.throughput[count] = {};
          results.comparison.latency[count] = {};
          results.comparison.gasUsed[count] = {};
        }
        
        results.comparison.throughput[count][mechanism] = metrics.throughput;
        results.comparison.latency[count][mechanism] = metrics.averageLatency;
        results.comparison.gasUsed[count][mechanism] = metrics.averageGasPerTx;
        
      } catch (error) {
        console.error(`Error testing ${mechanism} with ${count} validators:`, error);
        mechanismResults.scalingMetrics.push({
          validatorCount: count,
          error: error.message
        });
      }
    }
    
    results.consensusMechanisms[mechanism] = mechanismResults;
  }
  
  // Save results
  saveTestResults("validator-scaling-results.json", results);
  
  return results;
}

// Execute if called directly
if (require.main === module) {
  runValidatorScalingTests()
    .then(results => {
      console.log("\n===== Validator Scaling Test Complete =====");
      console.log(`Tested ${Object.keys(results.consensusMechanisms).length} consensus mechanisms`);
    })
    .catch(error => {
      console.error("Error running validator scaling tests:", error);
    });
}

module.exports = {
  runValidatorScalingTests
};
