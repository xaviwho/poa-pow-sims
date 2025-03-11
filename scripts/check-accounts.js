// scripts/check-accounts.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Checking network connection and accounts...");
  
  // Get network information
  const network = await ethers.provider.getNetwork();
  console.log(`Connected to network with chain ID: ${network.chainId}`);
  
  // Get accounts
  const accounts = await ethers.getSigners();
  console.log(`Number of accounts available: ${accounts.length}`);
  
  // Log details for each account
  for (let i = 0; i < accounts.length; i++) {
    const balance = await ethers.provider.getBalance(accounts[i].address);
    console.log(`Account ${i}: ${accounts[i].address}`);
    console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });