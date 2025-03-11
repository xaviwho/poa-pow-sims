// simulateTransactions-pow-simulation.js - Gas usage measurement for KETSBlockchain with PoW simulation
const { ethers } = require("hardhat");
const fs = require("fs");

// Get the contract address from .env or set manually
// You should deploy the contract first and update this address
const contractAddress = process.env.KETS_CONTRACT_ADDRESS || "0x3E5E97DD8791ef2aab5BfF75155280192F0b1075";

// Function to simulate mining delay
const simulateMiningDelay = async () => {
  console.log("⛏️ Simulating mining delay...");
  await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second mining delay
};

async function simulateTransactions() {
  console.log("Simulating KETSBlockchain transactions with PoW characteristics...");
  console.log(`Using contract at: ${contractAddress}`);
  
  // Get signers (accounts)
  const [regulator, industry1, industry2] = await ethers.getSigners();
  console.log(`Using regulator account: ${regulator.address}`);
  console.log(`Using industry1 account: ${industry1.address}`);
  console.log(`Using industry2 account: ${industry2.address}`);
  
  // Create a log file for detailed gas measurements
  const logStream = fs.createWriteStream('gas-measurements-pow.log', {flags: 'a'});
  const logData = [];
  
  // Helper function to log gas usage
  const logGasUsage = async (txHash, action) => {
    try {
      await simulateMiningDelay(); // Simulate mining time
      
      const receipt = await ethers.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        console.log(`⚠️ Receipt not found for ${action}`);
        return null;
      }
      
      const tx = await ethers.provider.getTransaction(txHash);
      if (!tx) {
        console.log(`⚠️ Transaction not found for ${action}`);
        return null;
      }
      
      const gasUsed = receipt.gasUsed;
      const gasPrice = tx.gasPrice;
      
      // Convert to BigInt to avoid type errors
      const gasUsedBigInt = BigInt(gasUsed.toString());
      const gasPriceBigInt = BigInt(gasPrice.toString());
      
      // Calculate cost
      const gasCost = gasUsedBigInt * gasPriceBigInt;
      
      const logEntry = {
        action,
        transactionHash: txHash,
        gasUsed: gasUsed.toString(),
        gasPrice: gasPrice.toString(),
        gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
        gasCost: ethers.formatEther(gasCost),
        consensusMechanism: "PoW Simulated"
      };
      
      // Log to console
      console.log(`${action} ✅ Receipt:`, {
        action,
        transactionHash: txHash,
        gasUsed: gasUsed.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + " gwei",
        cost: ethers.formatEther(gasCost) + " ETH"
      });
      
      // Save to log array
      logData.push(logEntry);
      
      // Write to log file
      logStream.write(JSON.stringify(logEntry, null, 2) + ',\n');
      
      return logEntry;
    } catch (error) {
      console.error(`Error getting receipt for ${action}:`, error.message);
      return null;
    }
  };

  try {
    console.log(`✅ Regulator Address: ${regulator.address}`);
    
    // Log initial balances
    const regulatorBalance = await ethers.provider.getBalance(regulator.address);
    const industry2Balance = await ethers.provider.getBalance(industry2.address);
    
    console.log(`💰 Balance of ${regulator.address}: ${ethers.formatEther(regulatorBalance)} ETH`);
    console.log(`💰 Balance of ${industry2.address}: ${ethers.formatEther(industry2Balance)} ETH`);
    
    console.log("=== SIMULATION START (PoW) ===");
    
    // Get the current gas price and increase it to simulate mining competition
    const feeData = await ethers.provider.getFeeData();
    const baseGasPrice = feeData.gasPrice;
    // Higher gas price for PoW simulation - 3x higher than standard
    const gasPrice = baseGasPrice * BigInt(3);
    console.log(`Base gas price: ${ethers.formatUnits(baseGasPrice, 'gwei')} gwei`);
    console.log(`Using PoW simulated gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    
    // Connect to the existing contract
    const KETSBlockchain = await ethers.getContractFactory("KETSBlockchain");
    const ketsBlockchain = await KETSBlockchain.attach(contractAddress);
    
    // 1. Register Industry 1 (from regulator)
    console.log(`\n----- TRANSACTION 1 -----`);
    console.log(`Registering Industry 1 from ${regulator.address}`);
    let tx = await ketsBlockchain.connect(regulator).registerIndustry("Industry 1 (PoW)", true, {
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Register Industry 1");
    
    // 2. Register Industry 2 (from industry2 account)
    console.log(`\n----- TRANSACTION 2 -----`);
    console.log(`Registering Industry 2 from ${industry2.address}`);
    tx = await ketsBlockchain.connect(industry2).registerIndustry("Industry 2 (PoW)", false, {
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Register Industry 2");
    
    // 3. Update GHG emissions for Industry 1
    console.log(`\n----- TRANSACTION 3 -----`);
    console.log(`Updating GHG emissions for Industry 1`);
    tx = await ketsBlockchain.connect(regulator).updateGHGEmissions(
      regulator.address, 0, 1000, 50, 25, 10, 5, 2,
      { gasLimit: 500000, gasPrice: gasPrice }
    );
    await logGasUsage(tx.hash, "Update GHG for Industry 1");
    
    // 4. Free Allocation to Industry 1
    console.log(`\n----- TRANSACTION 4 -----`);
    console.log(`Allocating free credits to Industry 1`);
    tx = await ketsBlockchain.connect(regulator).freeAllocation(
      regulator.address, 0, 100,
      { gasLimit: 500000, gasPrice: gasPrice }
    );
    await logGasUsage(tx.hash, "Free Allocation to Industry 1");
    
    // 5. Create an auction
    console.log(`\n----- TRANSACTION 5 -----`);
    console.log(`Creating auction`);
    const auctionCredits = 1000;
    const minBidPrice = ethers.parseEther('0.01');
    
    tx = await ketsBlockchain.connect(regulator).createAuction(
      auctionCredits, minBidPrice,
      { gasLimit: 500000, gasPrice: gasPrice }
    );
    await logGasUsage(tx.hash, "Create Auction");
    
    // 6. Place a bid from Industry 2
    console.log(`\n----- TRANSACTION 6 -----`);
    console.log(`Industry 2 placing bid for 50 credits`);
    const bidCredits = 50;
    const bidValue = BigInt(bidCredits) * minBidPrice;
    
    tx = await ketsBlockchain.connect(industry2).placeBid(bidCredits, {
      value: bidValue,
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Place Bid by Industry 2");
    
    // 7. Finalize the auction
    console.log(`\n----- TRANSACTION 7 -----`);
    console.log(`Finalizing auction`);
    tx = await ketsBlockchain.connect(regulator).finalizeAuction({
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Finalize Auction");
    
    // 8. Get Industry 1 credits and details (view function, no gas)
    console.log(`\n----- CHECKING CREDITS -----`);
    console.log(`📊 Checking Industry 1 Credits...`);
    try {
      const industryInfo = await ketsBlockchain.getIndustriesByOwner(regulator.address);
      console.log("Industry Info:", industryInfo);
      
      // Check if Industry 1 has credits
      const industry1Credits = await ketsBlockchain.getIndustryCredits(regulator.address, 0);
      console.log(`Industry 1 has ${industry1Credits.toString()} credits`);
      
      // 9. Trade credits if possible
      if (industry1Credits >= 20) {
        console.log(`\n----- TRANSACTION 8 -----`);
        console.log(`Trading 20 credits from Industry 1 to Industry 2`);
        tx = await ketsBlockchain.connect(regulator).tradeCredits(
          industry2.address, 0, 0, 20,
          { gasLimit: 500000, gasPrice: gasPrice }
        );
        await logGasUsage(tx.hash, "Trade Credits");
      } else {
        console.log(`❌ Industry 1 does not have enough credits to trade.`);
      }
    } catch (error) {
      console.error(`Error checking industry credits: ${error.message}`);
    }
    
    // Calculate mining statistics to include in the report
    const totalTransactions = logData.filter(entry => entry !== null).length;
    const totalMiningTime = totalTransactions * 3; // 3 seconds per transaction
    
    // Generate a comprehensive gas report
    const gasReportPath = 'gas-report-pow.json';
    
    // Filter out null entries
    const validLogData = logData.filter(entry => entry !== null);
    
    // Calculate total gas used only from valid entries
    const totalGasUsed = validLogData.reduce((total, entry) => 
      total + BigInt(entry.gasUsed), BigInt(0));
    
    // Calculate average gas used
    const avgGasUsed = validLogData.length > 0 ? 
      totalGasUsed / BigInt(validLogData.length) : BigInt(0);
    
    fs.writeFileSync(
      gasReportPath,
      JSON.stringify({
        contract: "KETSBlockchain",
        contractAddress: contractAddress,
        consensusMechanism: "PoW Simulated",
        network: await ethers.provider.getNetwork(),
        miningStatistics: {
          averageMiningTime: "3 seconds",
          totalMiningTime: `${totalMiningTime} seconds`,
          miningDifficulty: "Simulated"
        },
        transactions: validLogData,
        summary: {
          totalGasUsed: totalGasUsed.toString(),
          averageGasUsed: avgGasUsed.toString(),
          totalTransactions: totalTransactions,
          averageGasPrice: validLogData.length > 0 ? 
            ethers.formatUnits(BigInt(validLogData[0].gasPrice), 'gwei') + " gwei" : 
            "N/A",
          operations: validLogData.map(entry => ({
            operation: entry.action,
            gasUsed: entry.gasUsed
          }))
        }
      }, null, 2)
    );
    
    console.log(`✅ PoW simulation finished successfully.`);
    console.log(`📊 Gas usage report saved to ${gasReportPath}`);
    
    // Generate comparison report if PoA report exists
    try {
      if (fs.existsSync('gas-report.json')) {
        const poaReport = JSON.parse(fs.readFileSync('gas-report.json', 'utf8'));
        const powReport = JSON.parse(fs.readFileSync(gasReportPath, 'utf8'));
        
        const comparisonReport = {
          comparisonDate: new Date().toISOString(),
          poaNetwork: {
            totalGasUsed: poaReport.summary.totalGasUsed,
            averageGasUsed: poaReport.summary.averageGasUsed,
            totalTransactions: poaReport.transactions.length,
            consensusMechanism: "PoA"
          },
          powNetwork: {
            totalGasUsed: powReport.summary.totalGasUsed,
            averageGasUsed: powReport.summary.averageGasUsed,
            totalTransactions: powReport.transactions.length,
            consensusMechanism: "PoW Simulated",
            miningTime: `${totalMiningTime} seconds`
          },
          operationComparison: {}
        };
        
        // Compare operations
        poaReport.summary.operations.forEach(op => {
          const powOp = powReport.summary.operations.find(p => p.operation === op.operation);
          if (powOp) {
            comparisonReport.operationComparison[op.operation] = {
              poaGasUsed: op.gasUsed,
              powGasUsed: powOp.gasUsed,
              difference: (BigInt(powOp.gasUsed) - BigInt(op.gasUsed)).toString(),
              percentageDifference: ((BigInt(powOp.gasUsed) - BigInt(op.gasUsed)) * BigInt(100) / BigInt(op.gasUsed)).toString() + "%"
            };
          }
        });
        
        fs.writeFileSync(
          'consensus-comparison-report.json',
          JSON.stringify(comparisonReport, null, 2)
        );
        
        console.log("📊 Consensus mechanism comparison report generated: consensus-comparison-report.json");
      }
    } catch (error) {
      console.error("Error generating comparison report:", error.message);
    }
    
  } catch (error) {
    console.error("❌ Error during simulation:", error);
    console.error(error.stack);
  } finally {
    logStream.end();
  }
}

// Execute the simulation
simulateTransactions()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });