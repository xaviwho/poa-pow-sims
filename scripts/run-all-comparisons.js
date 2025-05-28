// run-all-comparisons.js - Automates running all consensus mechanism simulations
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

// Configuration for each consensus mechanism
const consensusMechanisms = [
  {
    name: 'PoA',
    networkName: 'localPoA',
    port: 8545,
    startCommand: 'npx hardhat node --port 8545',
    deployScript: 'scripts/deploy.js',
    simulationScript: 'scripts/simulateTransactions.js',
    reportFile: 'gas-report.json'
  },
  {
    name: 'PoW',
    networkName: 'ganachePoW',
    port: 8546,
    startCommand: 'npx ganache --port 8546 --chain.chainId 1338 --deterministic',
    deployScript: 'scripts/deploy.js',
    simulationScript: 'scripts/simulateTransactions-pow-simulation.js',
    reportFile: 'gas-report-pow.json'
  },
  {
    name: 'DPoS',
    networkName: 'simulatedDPoS',
    port: 8547,
    startCommand: 'npx hardhat node --port 8547 --network simulatedDPoS',
    deployScript: 'scripts/deploy.js',
    simulationScript: 'scripts/simulateTransactions-dpos.js',
    reportFile: 'gas-report-dpos.json'
  },
  {
    name: 'PBFT',
    networkName: 'simulatedPBFT',
    port: 8548,
    startCommand: 'npx hardhat node --port 8548 --network simulatedPBFT',
    deployScript: 'scripts/deploy.js',
    simulationScript: 'scripts/simulateTransactions-pbft.js',
    reportFile: 'gas-report-pbft.json'
  }
  // Add PoAA configuration here when you have the details
  // {
  //   name: 'PoAA',
  //   networkName: 'poaaNetwork',
  //   port: 8549,
  //   startCommand: 'your-poaa-start-command',
  //   deployScript: 'scripts/deploy.js',
  //   simulationScript: 'scripts/simulateTransactions-poaa.js', // Create this file based on your PoAA mechanism
  //   reportFile: 'gas-report-poaa.json'
  // }
];

// Function to check if a port is in use
async function isPortInUse(port) {
  try {
    const { stdout, stderr } = await execPromise(`netstat -ano | findstr :${port}`);
    return stdout.toString().includes(`:${port}`);
  } catch (error) {
    return false; // If the command fails, port is likely not in use
  }
}

// Function to run a command and wait for completion
async function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    const { stdout, stderr } = await execPromise(command);
    console.log(`✅ ${description} completed successfully`);
    console.log(stdout);
    if (stderr) console.error(stderr);
    return stdout;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

// Function to run network, deploy contract, simulate transactions, and clean up
async function runConsensusTest(mechanism) {
  console.log(`\n===== Testing ${mechanism.name} Consensus Mechanism =====`);
  
  // Check if port is already in use
  const portInUse = await isPortInUse(mechanism.port);
  if (portInUse) {
    console.log(`⚠️ Port ${mechanism.port} is already in use. Please free this port and try again.`);
    return false;
  }
  
  // Start the network in a separate process
  console.log(`🌐 Starting ${mechanism.name} network on port ${mechanism.port}...`);
  const network = exec(mechanism.startCommand);
  
  let success = false;
  
  try {
    // Wait for network to start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Deploy the contract
    await runCommand(`npx hardhat run ${mechanism.deployScript} --network ${mechanism.networkName}`, 
      `Deploying contract for ${mechanism.name}`);
    
    // Run the simulation
    await runCommand(`npx hardhat run ${mechanism.simulationScript} --network ${mechanism.networkName}`,
      `Running ${mechanism.name} simulation`);
    
    // Verify report was generated
    if (fs.existsSync(mechanism.reportFile)) {
      console.log(`📊 ${mechanism.name} report generated successfully: ${mechanism.reportFile}`);
      success = true;
    } else {
      console.error(`❌ ${mechanism.name} report was not generated`);
    }
    
  } catch (error) {
    console.error(`❌ Error during ${mechanism.name} testing:`, error.message);
  } finally {
    // Kill the network process
    console.log(`🛑 Stopping ${mechanism.name} network...`);
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${network.pid} /f /t`);
    } else {
      network.kill();
    }
  }
  
  return success;
}

// Main function to run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive consensus mechanism comparison');
  
  const results = [];
  
  for (const mechanism of consensusMechanisms) {
    const success = await runConsensusTest(mechanism);
    results.push({
      mechanism: mechanism.name,
      success,
      reportFile: mechanism.reportFile
    });
    
    // Wait between tests to ensure clean state
    console.log('⏳ Waiting 5 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Generate comprehensive comparison
  console.log('\n===== Generating Comprehensive Comparison =====');
  try {
    await runCommand('node scripts/generate-consensus-comparison.js', 
      'Generating comprehensive comparison report');
    
    console.log('\n✅ All consensus mechanism tests completed!');
    console.log('\nResults summary:');
    results.forEach(result => {
      console.log(`${result.mechanism}: ${result.success ? '✅ Success' : '❌ Failed'}`);
    });
    
    console.log('\n📊 Final comparison reports:');
    console.log('- comprehensive-consensus-comparison.json');
    console.log('- consensus-comparison-summary.md');
    
  } catch (error) {
    console.error('❌ Error generating comparison report:', error.message);
  }
}

// Execute all tests
runAllTests().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
