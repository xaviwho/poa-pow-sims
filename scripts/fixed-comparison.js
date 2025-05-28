// fixed-comparison.js
// A simplified script to generate academic comparisons between PoA, PoW, and DPoS 
// This version handles the specific log formats in your project
const fs = require('fs');
const path = require('path');

// Function to safely extract values from different log formats
function parsePoAOrPoWLog(filePath) {
  try {
    console.log(`Parsing PoA/PoW log: ${path.basename(filePath)}`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // For these files, we'll focus on just extracting the gas used values
    // which are the most reliable data points across all formats
    const gasPattern = /"gasUsed":\s*"(\d+)"/g;
    const actionsPattern = /"action":\s*"([^"]+)"/g;
    
    const gasMatches = [...fileContent.matchAll(gasPattern)];
    const actionMatches = [...fileContent.matchAll(actionsPattern)];
    
    // Extract gas values and actions
    const gasValues = gasMatches.map(match => parseInt(match[1]));
    const actions = actionMatches.map(match => match[1]);
    
    console.log(`Found ${gasValues.length} gas measurements`);
    console.log(`Found ${actions.length} actions`);
    
    // Assume reasonable block times based on consensus mechanism
    const isPoW = filePath.includes('pow');
    const avgBlockTime = isPoW ? 15000 : 5000; // 15s for PoW, 5s for PoA
    
    return {
      consensusMechanism: isPoW ? 'PoW' : 'PoA',
      totalGasUsed: gasValues.reduce((sum, val) => sum + val, 0),
      averageGasUsed: Math.round(gasValues.reduce((sum, val) => sum + val, 0) / gasValues.length),
      transactionCount: gasValues.length,
      estimatedBlockTime: avgBlockTime,
      gasValues,
      actions,
      blockTimeVariability: isPoW ? 'High' : 'Low',
      finality: isPoW ? avgBlockTime * 6 : avgBlockTime, // 6 confirmations for PoW
      throughput: 1000 / avgBlockTime, // tx per second
      actionMap: actions.reduce((map, action, index) => {
        map[action] = map[action] || [];
        if (gasValues[index]) {
          map[action].push(gasValues[index]);
        }
        return map;
      }, {})
    };
  } catch (error) {
    console.error(`Error parsing ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

// Function to parse the DPoS log format
function parseDPoSLog(filePath) {
  try {
    console.log(`Parsing DPoS log: ${path.basename(filePath)}`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    
    // Metrics to extract
    let gasValues = [];
    let durations = [];
    let actions = [];
    let currentAction = null;
    
    // Parse line by line
    for (const line of lines) {
      if (line.startsWith('Action:')) {
        currentAction = line.replace('Action:', '').trim();
        actions.push(currentAction);
      }
      else if (line.startsWith('Gas used:')) {
        const gas = parseInt(line.replace('Gas used:', '').trim());
        if (!isNaN(gas)) {
          gasValues.push(gas);
        }
      }
      else if (line.startsWith('Duration:')) {
        const duration = parseInt(line.replace('Duration:', '').replace('ms', '').trim());
        if (!isNaN(duration)) {
          durations.push(duration);
        }
      }
    }
    
    console.log(`Found ${gasValues.length} gas measurements`);
    console.log(`Found ${actions.length} actions`);
    console.log(`Found ${durations.length} duration measurements`);
    
    const avgBlockTime = durations.reduce((sum, val) => sum + val, 0) / durations.length;
    
    return {
      consensusMechanism: 'DPoS',
      totalGasUsed: gasValues.reduce((sum, val) => sum + val, 0),
      averageGasUsed: Math.round(gasValues.reduce((sum, val) => sum + val, 0) / gasValues.length),
      transactionCount: gasValues.length,
      measuredBlockTime: avgBlockTime,
      gasValues,
      actions,
      durations,
      blockTimeVariability: 'Very Low',
      finality: avgBlockTime * 2, // 2 confirmations for DPoS
      throughput: 1000 / avgBlockTime, // tx per second
      actionMap: actions.reduce((map, action, index) => {
        map[action] = map[action] || [];
        if (gasValues[index]) {
          map[action].push(gasValues[index]);
        }
        return map;
      }, {})
    };
  } catch (error) {
    console.error(`Error parsing ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

// Function to generate the comparison report
function generateComparisonReport() {
  // Parse logs using specialized parsers for each format
  const poaData = parsePoAOrPoWLog(path.join(__dirname, '..', 'gas-measurements.log'));
  const powData = parsePoAOrPoWLog(path.join(__dirname, '..', 'gas-measurements-pow.log'));
  const dposData = parseDPoSLog(path.join(__dirname, '..', 'dpos-measurements.log'));
  
  if (!poaData || !powData || !dposData) {
    console.error("Failed to parse one or more log files. Please check the errors above.");
    return;
  }
  
  // Generate academic comparison
  const report = {
    comparisonDate: new Date().toISOString(),
    consensusMechanismComparison: {
      PoA: {
        blockTime: `${poaData.estimatedBlockTime}ms (estimated)`,
        blockTimeVariability: poaData.blockTimeVariability,
        finality: `${poaData.finality}ms (1 confirmation)`,
        throughput: `${poaData.throughput.toFixed(2)} tx/s (theoretical)`,
        totalGasUsed: poaData.totalGasUsed,
        averageGasUsed: poaData.averageGasUsed,
        securityModel: "Authority-based - Trusted validators",
        energyConsumption: "Low - No mining required",
        decentralization: "Medium - Limited validator set"
      },
      PoW: {
        blockTime: `${powData.estimatedBlockTime}ms (estimated)`,
        blockTimeVariability: powData.blockTimeVariability,
        finality: `${powData.finality}ms (6 confirmations)`,
        throughput: `${powData.throughput.toFixed(2)} tx/s (theoretical)`,
        totalGasUsed: powData.totalGasUsed,
        averageGasUsed: powData.averageGasUsed,
        securityModel: "Work-based - 51% computational power",
        energyConsumption: "High - Intensive mining",
        decentralization: "High - Open participation"
      },
      DPoS: {
        blockTime: `${dposData.measuredBlockTime.toFixed(2)}ms (measured)`,
        blockTimeVariability: dposData.blockTimeVariability,
        finality: `${dposData.finality.toFixed(2)}ms (2 confirmations)`,
        throughput: `${dposData.throughput.toFixed(2)} tx/s (measured)`,
        totalGasUsed: dposData.totalGasUsed,
        averageGasUsed: dposData.averageGasUsed,
        securityModel: "Stake-based - Delegated voting",
        energyConsumption: "Low - No mining required",
        decentralization: "Medium - Limited delegate set"
      }
    },
    operationGasComparison: {},
    academicInsights: {
      gasUsage: "The smart contract operations consume the same amount of gas regardless of consensus mechanism, as gas measures computational work in the EVM.",
      performance: "DPoS and PoA provide much faster transaction finality compared to PoW, making them more suitable for business applications requiring rapid confirmation.",
      scalability: "DPoS offers the best balance of scalability, decentralization, and energy efficiency among the tested mechanisms.",
      suitability: "For the K-ETS application, where transaction finality and throughput are important, DPoS or PoA would be preferable to PoW."
    }
  };
  
  // Add operation-specific gas comparison
  // Find common operations across all mechanisms
  const allActions = new Set([
    ...Object.keys(poaData.actionMap),
    ...Object.keys(powData.actionMap),
    ...Object.keys(dposData.actionMap)
  ]);
  
  allActions.forEach(action => {
    const poaGas = poaData.actionMap[action] ? poaData.actionMap[action][0] : null;
    const powGas = powData.actionMap[action] ? powData.actionMap[action][0] : null;
    const dposGas = dposData.actionMap[action] ? dposData.actionMap[action][0] : null;
    
    if (poaGas || powGas || dposGas) {
      report.operationGasComparison[action] = {
        poaGas: poaGas || "N/A",
        powGas: powGas || "N/A",
        dposGas: dposGas || "N/A",
        notes: "Gas costs are determined by EVM operations, not consensus mechanism"
      };
    }
  });
  
  // Write the report to a JSON file
  fs.writeFileSync(
    path.join(__dirname, '..', 'enhanced-consensus-comparison.json'),
    JSON.stringify(report, null, 2)
  );
  
  console.log("✅ Academic consensus comparison report generated successfully!");
  console.log("📊 Report saved to enhanced-consensus-comparison.json\n");
  
  // Print a summary table
  console.log("=== CONSENSUS MECHANISM COMPARISON FOR K-ETS BLOCKCHAIN ===\n");
  console.log("Metric\t\t\tPoA\t\t\tPoW\t\t\tDPoS");
  console.log("--------------------------------------------------------------------");
  console.log(`Block Time\t\t${poaData.estimatedBlockTime}ms\t\t${powData.estimatedBlockTime}ms\t\t${dposData.measuredBlockTime.toFixed(2)}ms`);
  console.log(`Finality\t\t${poaData.finality}ms\t\t${powData.finality}ms\t\t${dposData.finality.toFixed(2)}ms`);
  console.log(`Throughput\t\t${poaData.throughput.toFixed(2)} tx/s\t\t${powData.throughput.toFixed(2)} tx/s\t\t${dposData.throughput.toFixed(2)} tx/s`);
  console.log(`Avg Gas\t\t\t${poaData.averageGasUsed}\t\t${powData.averageGasUsed}\t\t${dposData.averageGasUsed}`);
  console.log(`Security\t\tAuthority-based\t\tWork-based\t\tStake-based`);
  console.log(`Energy Usage\t\tLow\t\t\tHigh\t\t\tLow`);
  console.log("\nAcademic Recommendation for K-ETS: DPoS or PoA would be preferable due to faster finality and higher throughput.");
}

// Execute the report generation
generateComparisonReport();
