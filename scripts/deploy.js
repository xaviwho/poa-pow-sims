const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("🚀 Deploying contract using Account [0]:", deployer.address);
  console.log("💰 Account Balance:", ethers.formatUnits(balance, 18), "ETH");

  // Get the current base fee
  const feeData = await ethers.provider.getFeeData();
  const baseFee = feeData.gasPrice;
  console.log(`Current base fee: ${ethers.formatUnits(baseFee, 'gwei')} gwei`);
  
  // Add a premium to the base fee to ensure the transaction is accepted
  const gasPrice = baseFee * BigInt(15) / BigInt(10);
  console.log(`Using gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

  // Deploy the contract
  const KETSBlockchain = await ethers.getContractFactory("KETSBlockchain");
  console.log("Deploying contract...");
  
  const kets = await KETSBlockchain.deploy({
    gasLimit: 5000000,
    gasPrice: gasPrice
  });

  // Wait for deployment
  console.log("Waiting for deployment to complete...");
  await kets.waitForDeployment();

  // Get the contract address
  const contractAddress = await kets.getAddress();
  console.log(`✅ KETSBlockchain deployed to: ${contractAddress}`);

  // Save to .env file
  fs.writeFileSync(
    '.env',
    `KETS_CONTRACT_ADDRESS=${contractAddress}\n` +
    `DEPLOYER_ADDRESS=${deployer.address}\n`
  );
  console.log("Contract address saved to .env file");

  return contractAddress;
}

main()
  .then((address) => {
    console.log(`Deployment successful: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });