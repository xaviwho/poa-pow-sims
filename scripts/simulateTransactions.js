// simulateTransactions.js - Gas usage measurement for KETSBlockchain
const { ethers } = require("hardhat");
const fs = require("fs");
require('dotenv').config(); // Load .env file - install with: npm install dotenv

// Get the contract address from .env or set manually
const contractAddress = process.env.KETS_CONTRACT_ADDRESS || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

async function simulateTransactions() {
  console.log("Simulating KETSBlockchain transactions and measuring gas usage...");
  console.log(`Using contract at: ${contractAddress}`);
  
  // Get signers (accounts)
  const [regulator, industry1, industry2] = await ethers.getSigners();
  console.log(`Using regulator account: ${regulator.address}`);
  console.log(`Using industry1 account: ${industry1.address}`);
  console.log(`Using industry2 account: ${industry2.address}`);
  
  // Create a log file for detailed gas measurements
  const logStream = fs.createWriteStream('gas-measurements.log', {flags: 'a'});
  const logData = [];
  
  // Helper function to log gas usage
  const logGasUsage = async (txHash, action) => {
    try {
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
        gasCost: ethers.formatEther(gasCost)
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
    
    console.log("=== SIMULATION START ===");
    
    // Get the current gas price
    const feeData = await ethers.provider.getFeeData();
    const baseGasPrice = feeData.gasPrice;
    // Add a premium to ensure transactions go through
    const gasPrice = baseGasPrice * BigInt(15) / BigInt(10);
    console.log(`Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
    
    // Connect to the existing contract
    const KETSBlockchain = await ethers.getContractFactory("KETSBlockchain");
    const ketsBlockchain = await KETSBlockchain.attach(contractAddress);
    
    // 1. Register Industry 1 (from regulator)
    console.log(`Registering Industry 1 from ${regulator.address}`);
    let tx = await ketsBlockchain.connect(regulator).registerIndustry("Industry 1", true, {
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Register Industry 1");
    
    // 2. Register Industry 2 (from industry2 account)
    console.log(`Registering Industry 2 from ${industry2.address}`);
    tx = await ketsBlockchain.connect(industry2).registerIndustry("Industry 2", false, {
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Register Industry 2");
    
    // 3. Update GHG emissions for Industry 1
    console.log(`Updating GHG emissions for Industry 1`);
    tx = await ketsBlockchain.connect(regulator).updateGHGEmissions(
      regulator.address, 0, 1000, 50, 25, 10, 5, 2,
      { gasLimit: 500000, gasPrice: gasPrice }
    );
    await logGasUsage(tx.hash, "Update GHG for Industry 1");
    
    // 4. Free Allocation to Industry 1
    console.log(`Allocating free credits to Industry 1`);
    tx = await ketsBlockchain.connect(regulator).freeAllocation(
      regulator.address, 0, 100,
      { gasLimit: 500000, gasPrice: gasPrice }
    );
    await logGasUsage(tx.hash, "Free Allocation to Industry 1");
    
    // 5. Create an auction
    console.log(`Creating auction`);
    const auctionCredits = 1000;
    const minBidPrice = ethers.parseEther('0.01');
    
    tx = await ketsBlockchain.connect(regulator).createAuction(
      auctionCredits, minBidPrice,
      { gasLimit: 500000, gasPrice: gasPrice }
    );
    await logGasUsage(tx.hash, "Create Auction");
    
    // 6. Place a bid from Industry 2
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
    console.log(`Finalizing auction`);
    tx = await ketsBlockchain.connect(regulator).finalizeAuction({
      gasLimit: 500000,
      gasPrice: gasPrice
    });
    await logGasUsage(tx.hash, "Finalize Auction");
    
    // 8. Get Industry 1 credits and details (view function, no gas)
    console.log(`📊 Checking Industry 1 Credits...`);
    try {
      const industryInfo = await ketsBlockchain.getIndustriesByOwner(regulator.address);
      console.log("Industry Info:", industryInfo);
      
      // Check if Industry 1 has credits
      const industry1Credits = await ketsBlockchain.getIndustryCredits(regulator.address, 0);
      console.log(`Industry 1 has ${industry1Credits.toString()} credits`);
      
      // 9. Trade credits if possible
      if (industry1Credits >= 20) {
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
    
    // Generate a comprehensive gas report
    const gasReportPath = 'gas-report.json';
    
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
        network: await ethers.provider.getNetwork(),
        transactions: validLogData,
        summary: {
          totalGasUsed: totalGasUsed.toString(),
          averageGasUsed: avgGasUsed.toString(),
          operations: validLogData.map(entry => ({
            operation: entry.action,
            gasUsed: entry.gasUsed
          }))
        }
      }, null, 2)
    );
    
    console.log(`✅ Simulation finished successfully.`);
    console.log(`📊 Gas usage report saved to ${gasReportPath}`);
    
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