/**
 * Transaction Stress Test for Consensus Mechanisms
 * Tests how each consensus mechanism handles increasing transaction loads
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { 
  calculateMetrics, 
  saveTestResults,
  sleep
} = require("./test-utils");

// Default transaction rates to test (transactions per second)
const DEFAULT_TX_RATES = [1, 2, 5, 10, 20, 50];

// Duration of each test in milliseconds (2 minutes)
const TEST_DURATION = 2 * 60 * 1000;

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

async function setupAccounts(validatorCount = 4) {
  // Get all accounts
  const allAccounts = await ethers.getSigners();
  console.log(`Available accounts: ${allAccounts.length}`);
  
  // Calculate max validators we can support with the available accounts
  // We need at least 1 regulator and 3 industry accounts for meaningful testing
  const minIndustryAccounts = 3;
  const maxValidators = Math.max(1, allAccounts.length - 1 - minIndustryAccounts);
  
  // Adjust validator count if we don't have enough accounts
  const actualValidatorCount = Math.min(validatorCount, maxValidators);
  
  if (actualValidatorCount < validatorCount) {
    console.log(`Warning: Reduced validator count from ${validatorCount} to ${actualValidatorCount} due to account limitations`);
  }
  
  // First account is regulator
  const regulator = allAccounts[0];
  
  // Next N accounts are validators
  const validators = allAccounts.slice(1, actualValidatorCount + 1);
  
  // Remaining accounts are industries (as many as possible for stress testing)
  const industries = allAccounts.slice(actualValidatorCount + 1);
  
  console.log(`Setup complete: 1 regulator, ${validators.length} validators, ${industries.length} industry accounts`);
  
  return {
    regulator,
    validators,
    industries,
    allAccounts,
    actualValidatorCount
  };
}

// Generate a random GHG emission update transaction
async function submitRandomEmissionUpdate(contract, industryAccount, year) {
  try {
    // Random emission values for GHG data
    const co2 = Math.floor(Math.random() * 5000) + 1000;
    const ch4 = Math.floor(Math.random() * 2000) + 500;
    const n2o = Math.floor(Math.random() * 1000) + 300;
    const hfcs = Math.floor(Math.random() * 500) + 100;
    const pfcs = Math.floor(Math.random() * 800) + 200;
    const sf6 = Math.floor(Math.random() * 300) + 50;
    
    // The contract requires us to provide the industry owner address and index
    // Each industry account has registered an industry at index 0
    const industryOwner = industryAccount.address;
    const industryIndex = 0; // First industry for this address
    
    const startTime = Date.now();
    
    // Submit transaction with proper parameters matching the contract function:
    // function updateGHGEmissions(address _industryOwner, uint industryIndex, uint _CO2, uint _CH4, uint _N2O, uint _HFCs, uint _PFCs, uint _SF6)
    const tx = await contract.connect(industryAccount).updateGHGEmissions(
      industryOwner,    // industry owner address
      industryIndex,    // industry index (0 for first industry under this address)
      co2,              // CO2 emissions
      ch4,              // CH4 emissions
      n2o,              // N2O emissions
      hfcs,             // HFCs emissions
      pfcs,             // PFCs emissions
      sf6               // SF6 emissions
    );
    
    const receipt = await tx.wait();
    
    const endTime = Date.now();
    
    return {
      success: true,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      latency: endTime - startTime,
      timestamp: endTime
    };
  } catch (error) {
    console.log(`Transaction error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// Run a stress test for a specific consensus mechanism and transaction rate
async function runStressTest(consensusMechanism, txPerSecond) {
  console.log(`Running ${consensusMechanism} stress test at ${txPerSecond} tx/sec`);
  
  // Deploy contract
  const contract = await deployContract();
  
  // Setup accounts with appropriate validator count for the mechanism
  let validatorCount = 4; // Default
  
  // Ideal validator counts for each consensus mechanism
  if (consensusMechanism === "PBFT") validatorCount = 4;
  else if (consensusMechanism === "PoASquare") validatorCount = 8;
  else if (consensusMechanism === "DPoS") validatorCount = 16; // Reduced from 21 to work with available accounts
  else if (consensusMechanism === "PoA") validatorCount = 5;
  else if (consensusMechanism === "PoW") validatorCount = 10;
  
  // Setup accounts - the function will automatically adjust validator count if needed
  const { regulator, industries, actualValidatorCount } = await setupAccounts(validatorCount);
  
  console.log(`${consensusMechanism} test using ${actualValidatorCount} validators (requested: ${validatorCount})`);
  
  if (actualValidatorCount < 4 && (consensusMechanism === "PBFT" || consensusMechanism === "PoASquare")) {
    console.log(`Warning: ${consensusMechanism} typically requires at least 4 validators for proper operation`);
  }
  
  // Register industries first (setup phase)
  console.log("Registering industries for test...");
  for (let i = 0; i < industries.length; i++) {
    try {
      const tx = await contract.connect(industries[i]).registerIndustry(`Industry-${i+1}`, i % 2 === 0);
      await tx.wait();
      console.log(`Registered Industry-${i+1}`);
    } catch (error) {
      console.error(`Error registering Industry-${i+1}:`, error.message);
    }
  }
  
  // Prepare stress test
  const targetInterval = 1000 / txPerSecond; // ms between transactions
  const results = {
    consensusMechanism,
    targetTxRate: txPerSecond,
    transactions: [],
    startTime: Date.now(),
    endTime: null,
    totalDuration: 0,
    successfulTx: 0,
    failedTx: 0
  };
  
  console.log(`Starting stress test: Target interval ${targetInterval}ms between transactions`);
  console.log(`Test will run for ${TEST_DURATION / 1000} seconds`);
  
  // Run the stress test for the specified duration
  const endTime = results.startTime + TEST_DURATION;
  let txCount = 0;
  
  while (Date.now() < endTime) {
    const txStartTime = Date.now();
    
    // Select a random industry account
    const industryIndex = txCount % industries.length;
    const industry = industries[industryIndex];
    
    // Submit random emission update
    const txResult = await submitRandomEmissionUpdate(
      contract,
      industry,
      (Math.floor(txCount / 10) % 5) + 1 // Years 1-5, changing every 10 transactions
    );
    
    // Record transaction result
    results.transactions.push({
      id: txCount,
      ...txResult
    });
    
    if (txResult.success) {
      results.successfulTx++;
    } else {
      results.failedTx++;
    }
    
    txCount++;
    
    // Calculate time to next transaction
    const elapsed = Date.now() - txStartTime;
    const sleepTime = Math.max(0, targetInterval - elapsed);
    
    if (sleepTime > 0) {
      await sleep(sleepTime);
    }
    
    // Log progress every 10 transactions
    if (txCount % 10 === 0) {
      const elapsedSec = (Date.now() - results.startTime) / 1000;
      const actualRate = txCount / elapsedSec;
      console.log(`Processed ${txCount} transactions (${results.successfulTx} successful) at ${actualRate.toFixed(2)} tx/sec`);
    }
  }
  
  // Finalize results
  results.endTime = Date.now();
  results.totalDuration = results.endTime - results.startTime;
  results.actualTxRate = results.transactions.length / (results.totalDuration / 1000);
  results.successRate = results.successfulTx / results.transactions.length;
  
  // Calculate latency statistics
  const latencies = results.transactions
    .filter(tx => tx.success)
    .map(tx => tx.latency);
  
  if (latencies.length > 0) {
    results.minLatency = Math.min(...latencies);
    results.maxLatency = Math.max(...latencies);
    results.avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    
    // Calculate 95th percentile latency
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const percentileIndex = Math.floor(sortedLatencies.length * 0.95);
    results.percentile95Latency = sortedLatencies[percentileIndex];
  }
  
  console.log(`\nTest complete at ${results.actualTxRate.toFixed(2)} tx/sec (target: ${txPerSecond})`);
  console.log(`Success rate: ${(results.successRate * 100).toFixed(2)}%`);
  console.log(`Average latency: ${results.avgLatency ? results.avgLatency.toFixed(2) : 'N/A'}ms`);
  
  return results;
}

// Main function to run transaction stress tests
async function runTransactionStressTests(
  consensusMechanisms = ["PoASquare", "PBFT", "DPoS", "PoA", "PoW"],
  txRates = DEFAULT_TX_RATES
) {
  const results = {
    testDate: new Date().toISOString(),
    consensusMechanisms: {},
    comparison: {
      successRate: {},
      latency: {},
      maxThroughput: {}
    }
  };
  
  // Test each consensus mechanism
  for (const mechanism of consensusMechanisms) {
    console.log(`\n===== Testing ${mechanism} =====`);
    
    const mechanismResults = {
      name: mechanism,
      stressTests: []
    };
    
    let breakingPointReached = false;
    
    // Test each transaction rate
    for (const rate of txRates) {
      if (breakingPointReached) {
        console.log(`Skipping ${rate} tx/sec as breaking point already reached`);
        continue;
      }
      
      try {
        const testResults = await runStressTest(mechanism, rate);
        mechanismResults.stressTests.push(testResults);
        
        // Add to comparison data
        if (!results.comparison.successRate[rate]) {
          results.comparison.successRate[rate] = {};
          results.comparison.latency[rate] = {};
        }
        
        results.comparison.successRate[rate][mechanism] = testResults.successRate;
        results.comparison.latency[rate][mechanism] = testResults.avgLatency || 0;
        
        // Check if breaking point reached (success rate < 50% or actual rate < 50% of target)
        if (testResults.successRate < 0.5 || testResults.actualTxRate < (rate * 0.5)) {
          console.log(`Breaking point reached at ${rate} tx/sec target`);
          breakingPointReached = true;
          
          // Record max throughput
          results.comparison.maxThroughput[mechanism] = testResults.actualTxRate;
        }
      } catch (error) {
        console.error(`Error testing ${mechanism} at ${rate} tx/sec:`, error);
        mechanismResults.stressTests.push({
          targetTxRate: rate,
          error: error.message
        });
        
        breakingPointReached = true;
      }
    }
    
    // If we never reached a breaking point, record the max tested throughput
    if (!breakingPointReached && mechanismResults.stressTests.length > 0) {
      const lastTest = mechanismResults.stressTests[mechanismResults.stressTests.length - 1];
      results.comparison.maxThroughput[mechanism] = lastTest.actualTxRate;
    }
    
    results.consensusMechanisms[mechanism] = mechanismResults;
  }
  
  // Save results
  saveTestResults("transaction-stress-results.json", results);
  
  return results;
}

// Execute if called directly
if (require.main === module) {
  runTransactionStressTests()
    .then(results => {
      console.log("\n===== Transaction Stress Test Complete =====");
      console.log(`Tested ${Object.keys(results.consensusMechanisms).length} consensus mechanisms`);
      
      console.log("\nMax Throughput Comparison:");
      Object.entries(results.comparison.maxThroughput).forEach(([mechanism, throughput]) => {
        console.log(`- ${mechanism}: ${throughput.toFixed(2)} tx/sec`);
      });
    })
    .catch(error => {
      console.error("Error running transaction stress tests:", error);
    });
}

module.exports = {
  runTransactionStressTests
};
