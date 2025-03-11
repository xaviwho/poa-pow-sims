// scripts/deploy-pow.js
const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying contract using Account [0]:", deployer.address);
  console.log("💰 Account Balance:", ethers.formatUnits(await deployer.getBalance(), 18), "ETH");

  // Get the current gas price
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  console.log(`Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

  // Deploy the contract
  const KETSBlockchain = await ethers.getContractFactory("KETSBlockchain");
  console.log("Deploying contract to PoW network...");
  
  const kets = await KETSBlockchain.deploy({
    gasLimit: 5000000
  });

  // Wait for deployment
  console.log("Waiting for deployment to complete...");
  await kets.waitForDeployment();

  // Get the contract address
  const contractAddress = await kets.getAddress();
  console.log(`✅ KETSBlockchain deployed to: ${contractAddress}`);

  // Save to a PoW-specific .env file
  fs.writeFileSync(
    '.env.pow',
    `POW_CONTRACT_ADDRESS=${contractAddress}\n` +
    `POW_DEPLOYER_ADDRESS=${deployer.address}\n`
  );
  console.log("Contract address saved to .env.pow file");

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