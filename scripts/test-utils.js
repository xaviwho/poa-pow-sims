/**
 * Test Utilities for Consensus Mechanism Comparison
 * Contains shared functions for testing scalability and latency
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

// Helper function to handle parseEther for different ethers versions
function parseEther(amount) {
  // Check if ethers.parseEther exists (v6)
  if (typeof ethers.parseEther === 'function') {
    return ethers.parseEther(amount);
  }
  // Check if ethers.utils.parseEther exists (v5)
  else if (ethers.utils && typeof ethers.utils.parseEther === 'function') {
    return ethers.utils.parseEther(amount);
  }
  // Fallback implementation
  else {
    // Simple parseEther implementation (1 ether = 10^18 wei)
    return ethers.BigNumber.from(amount).mul(ethers.BigNumber.from(10).pow(18));
  }
}

// Standard transaction sequence for testing consensus mechanisms
async function runStandardTransactionSequence(contract, accounts) {
  const results = {
    transactions: [],
    startTime: Date.now(),
    consensusEvents: []
  };
  
  try {
    console.log(`Running transaction sequence with ${accounts.length} accounts`);
    console.log(`Regulator: ${accounts[0].address}`);
    console.log(`Industries: ${accounts.slice(1, 4).map(a => a.address).join(', ')}`);
    
    // 1. Register three industries
    for (let i = 0; i < Math.min(3, accounts.length-1); i++) {
      console.log(`Registering Industry-${i+1}...`);
      const tx = await contract.connect(accounts[i+1]).registerIndustry(`Industry-${i+1}`, i % 2 === 0);
      const receipt = await tx.wait();
      
      results.transactions.push({
        type: "registerIndustry",
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        timestamp: Date.now()
      });
      console.log(`Industry-${i+1} registered, gas used: ${receipt.gasUsed.toString()}`);
    }
    
    // 2. Update GHG emissions
    for (let i = 0; i < Math.min(3, accounts.length-1); i++) {
      console.log(`Updating emissions for Industry-${i+1}...`);
      // The contract's updateGHGEmissions function requires the industry owner and index
      // along with the 6 GHG emission parameters
      const industryOwner = accounts[i+1].address;
      const industryIndex = 0; // Since we're only registering one industry per account
      
      const tx = await contract.connect(accounts[i+1]).updateGHGEmissions(
        industryOwner,    // industry owner address
        industryIndex,    // industry index (0 for first industry under this address)
        1000 + i*500,     // CO2 emissions
        500 + i*200,      // CH4 emissions
        300 + i*100,      // N2O emissions
        100 + i*50,       // HFCs emissions
        200 + i*100,      // PFCs emissions
        50 + i*25         // SF6 emissions
      );
      const receipt = await tx.wait();
      
      results.transactions.push({
        type: "updateGHGEmissions",
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        timestamp: Date.now()
      });
      console.log(`Industry-${i+1} emissions updated, gas used: ${receipt.gasUsed.toString()}`);
    }
    
    // 3. Create and finalize auction
    const regulator = accounts[0];
    console.log(`Creating auction...`);
    
    // Create auction with 10 credits available and a minimum bid price of 0.01 ETH
    // Parameters match the contract function: createAuction(uint _creditsAvailable, uint _minBidPrice)
    const auctionTx = await contract.connect(regulator).createAuction(
      10,                // creditsAvailable 
      parseEther("0.01") // minBidPrice
    );
    
    const auctionReceipt = await auctionTx.wait();
    
    results.transactions.push({
      type: "createAuction",
      gasUsed: auctionReceipt.gasUsed.toString(),
      blockNumber: auctionReceipt.blockNumber,
      timestamp: Date.now()
    });
    console.log(`Auction created, gas used: ${auctionReceipt.gasUsed.toString()}`);
    
    // Add a placeholder bid to ensure the auction can be finalized properly
    // We'll use one of the industry accounts to place a bid
    if (accounts.length > 1) {
      console.log(`Placing bid on auction...`);
      try {
        const bidTx = await contract.connect(accounts[1]).placeBid(
          5, // bidCredits (5 credits, which is 50% of available credits)
          { value: parseEther("0.05") } // 5 credits * 0.01 ETH per credit = 0.05 ETH
        );
        const bidReceipt = await bidTx.wait();
        console.log(`Bid placed, gas used: ${bidReceipt.gasUsed.toString()}`);
      } catch (error) {
        console.log(`Error placing bid: ${error.message}`);
      }
    }
    
    // Finalize auction
    console.log(`Finalizing auction...`);
    const finalizeTx = await contract.connect(regulator).finalizeAuction();
    const finalizeReceipt = await finalizeTx.wait();
    
    results.transactions.push({
      type: "finalizeAuction",
      gasUsed: finalizeReceipt.gasUsed.toString(), 
      blockNumber: finalizeReceipt.blockNumber,
      timestamp: Date.now()
    });
    console.log(`Auction finalized, gas used: ${finalizeReceipt.gasUsed.toString()}`);
    
    // Record end time
    results.endTime = Date.now();
    results.totalDuration = results.endTime - results.startTime;
    
    console.log(`Transaction sequence completed successfully in ${results.totalDuration}ms`);
    return results;
  } catch (error) {
    console.error("Error in transaction sequence:", error);
    results.error = error.message;
    results.endTime = Date.now();
    results.totalDuration = results.endTime - results.startTime;
    return results;
  }
}

// Calculate metrics from results
function calculateMetrics(results) {
  // Basic metrics
  const txCount = results.transactions.length;
  const totalGasUsed = results.transactions.reduce((sum, tx) => sum + parseInt(tx.gasUsed || 0), 0);
  
  // Calculate transaction latency
  const latencies = [];
  for (let i = 1; i < results.transactions.length; i++) {
    latencies.push(results.transactions[i].timestamp - results.transactions[i-1].timestamp);
  }
  
  const averageLatency = latencies.length > 0 
    ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length 
    : 0;
  
  // Calculate throughput
  const throughput = txCount / (results.totalDuration / 1000); // tx per second
  
  return {
    transactionCount: txCount,
    totalGasUsed,
    averageGasPerTx: txCount > 0 ? totalGasUsed / txCount : 0,
    averageLatency,
    throughput,
    totalDuration: results.totalDuration,
    error: results.error
  };
}

// Ensure the logs directory exists
function ensureLogDirectory() {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

// Save test results to file
function saveTestResults(filename, results) {
  const logDir = ensureLogDirectory();
  const filePath = path.join(logDir, filename);
  
  fs.writeFileSync(
    filePath,
    JSON.stringify(results, null, 2)
  );
  
  console.log(`Results saved to ${filePath}`);
  return filePath;
}

// Sleep function for timing control
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  runStandardTransactionSequence,
  calculateMetrics,
  ensureLogDirectory,
  saveTestResults,
  sleep
};
