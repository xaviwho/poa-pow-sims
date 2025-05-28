// generate-consensus-comparison.js - Comprehensive comparison of all consensus mechanisms
const fs = require('fs');
const path = require('path');

// List of consensus mechanisms to compare
const mechanisms = [
  { name: 'PoA', file: 'gas-report.json' },
  { name: 'PoW', file: 'gas-report-pow.json' },
  { name: 'PoAA', file: 'gas-report-poaa.json' }, // PoA square
  { name: 'DPoS', file: 'gas-report-dpos.json' },
  { name: 'PBFT', file: 'gas-report-pbft.json' }
];

// Operation names for consistency in comparison
const standardOperations = [
  "Register Industry 1",
  "Register Industry 2",
  "Update GHG for Industry 1",
  "Free Allocation to Industry 1",
  "Create Auction",
  "Place Bid by Industry 2",
  "Finalize Auction",
  "Trade Credits"
];

// Metrics to compare
const metricsToCompare = [
  { name: 'Gas Usage', unit: 'gas units' },
  { name: 'Latency', unit: 'ms' },
  { name: 'Throughput', unit: 'tx/s' },
  { name: 'Scalability', unit: '' },
  { name: 'Fault Tolerance', unit: 'f value' }
];

function generateComprehensiveComparison() {
  console.log('Generating comprehensive consensus mechanism comparison...');
  
  // Load reports that exist
  const reports = [];
  
  for (const mechanism of mechanisms) {
    try {
      if (fs.existsSync(mechanism.file)) {
        const data = JSON.parse(fs.readFileSync(mechanism.file, 'utf8'));
        reports.push({
          mechanism: mechanism.name,
          data
        });
        console.log(`✅ Loaded data for ${mechanism.name}`);
      } else {
        console.log(`⚠️ No data found for ${mechanism.name} (${mechanism.file} does not exist)`);
      }
    } catch (error) {
      console.error(`Error loading ${mechanism.name} data:`, error.message);
    }
  }
  
  if (reports.length < 2) {
    console.error('❌ Not enough reports to generate comparison (need at least 2)');
    return;
  }
  
  // Create the comprehensive comparison report
  const comparisonReport = {
    title: "Comprehensive Consensus Mechanism Comparison",
    comparisonDate: new Date().toISOString(),
    mechanisms: {},
    gasUsageComparison: {
      byOperation: {},
      summary: {}
    },
    performanceComparison: {
      latency: {
        average: {},
        byOperation: {}
      },
      throughput: {
        average: {},
        theoretical: {}
      },
      scalability: {
        metrics: {},
        analysis: {}
      },
      faultTolerance: {}
    },
    overallRanking: {}
  };
  
  // 1. Add basic gas usage data for each mechanism
  reports.forEach(report => {
    comparisonReport.mechanisms[report.mechanism] = {
      totalGasUsed: report.data.summary.totalGasUsed,
      averageGasUsed: report.data.summary.averageGasUsed,
      totalTransactions: report.data.summary.totalTransactions,
      consensusMechanism: report.mechanism
    };
    
    // Add to summary comparison
    comparisonReport.gasUsageComparison.summary[report.mechanism] = {
      totalGas: report.data.summary.totalGasUsed,
      avgGas: report.data.summary.averageGasUsed
    };
  });
  
  // 2. Compare gas usage by operation
  standardOperations.forEach(operation => {
    comparisonReport.gasUsageComparison.byOperation[operation] = {};
    
    reports.forEach(report => {
      const op = report.data.summary.operations.find(o => o.operation === operation);
      if (op) {
        comparisonReport.gasUsageComparison.byOperation[operation][report.mechanism] = {
          gasUsed: op.gasUsed
        };
      }
    });
  });
  
  // 3. Compare performance metrics
  reports.forEach(report => {
    // Latency
    if (report.data.performanceMetrics && report.data.performanceMetrics.latencyMs) {
      comparisonReport.performanceComparison.latency.average[report.mechanism] = 
        report.data.performanceMetrics.latencyMs.average;
      
      // By operation
      standardOperations.forEach(operation => {
        if (!comparisonReport.performanceComparison.latency.byOperation[operation]) {
          comparisonReport.performanceComparison.latency.byOperation[operation] = {};
        }
        
        const op = report.data.summary.operations.find(o => o.operation === operation);
        if (op && op.latency) {
          comparisonReport.performanceComparison.latency.byOperation[operation][report.mechanism] = op.latency;
        }
      });
    }
    
    // Throughput
    if (report.data.performanceMetrics && report.data.performanceMetrics.throughput) {
      comparisonReport.performanceComparison.throughput.average[report.mechanism] = 
        report.data.performanceMetrics.throughput.transactionsPerSecond;
      
      if (report.data.performanceMetrics.throughput.theoreticalMaxThroughput) {
        comparisonReport.performanceComparison.throughput.theoretical[report.mechanism] = 
          report.data.performanceMetrics.throughput.theoreticalMaxThroughput;
      }
    }
    
    // Scalability
    if (report.data.performanceMetrics && report.data.performanceMetrics.scalability) {
      comparisonReport.performanceComparison.scalability.metrics[report.mechanism] = 
        report.data.performanceMetrics.scalability;
      
      // Add analysis based on mechanism type
      switch (report.mechanism) {
        case 'PoA':
          comparisonReport.performanceComparison.scalability.analysis[report.mechanism] = 
            "PoA has high throughput but limited scalability due to centralized authority";
          break;
        case 'PoW':
          comparisonReport.performanceComparison.scalability.analysis[report.mechanism] = 
            "PoW has limited throughput and scalability due to high computational requirements";
          break;
        case 'PoAA':
          comparisonReport.performanceComparison.scalability.analysis[report.mechanism] = 
            "PoA square provides improved scalability over traditional PoA with added security";
          break;
        case 'DPoS':
          comparisonReport.performanceComparison.scalability.analysis[report.mechanism] = 
            "DPoS has good scalability with throughput proportional to delegate count";
          break;
        case 'PBFT':
          comparisonReport.performanceComparison.scalability.analysis[report.mechanism] = 
            "PBFT has limited scalability due to O(n²) message complexity but high fault tolerance";
          break;
      }
    }
    
    // Fault Tolerance
    if (report.data.performanceMetrics && 
        report.data.performanceMetrics.scalability && 
        report.data.performanceMetrics.scalability.faultTolerance) {
      comparisonReport.performanceComparison.faultTolerance[report.mechanism] = 
        report.data.performanceMetrics.scalability.faultTolerance;
    } else {
      // Default fault tolerance values based on consensus type
      switch (report.mechanism) {
        case 'PoA':
          comparisonReport.performanceComparison.faultTolerance[report.mechanism] = "n/a (centralized)";
          break;
        case 'PoW':
          comparisonReport.performanceComparison.faultTolerance[report.mechanism] = "50% hashpower";
          break;
        case 'PoAA':
          comparisonReport.performanceComparison.faultTolerance[report.mechanism] = "Improved over PoA";
          break;
        case 'DPoS':
          comparisonReport.performanceComparison.faultTolerance[report.mechanism] = "2/3 of delegates";
          break;
        case 'PBFT':
          comparisonReport.performanceComparison.faultTolerance[report.mechanism] = 
            Math.floor((report.data.pbftStatistics?.nodeCount || 4) - 1) / 3;
          break;
      }
    }
  });
  
  // 4. Generate overall ranking for each metric
  // Helper to rank mechanisms by a numeric metric (lower is better)
  const rankByMetric = (metricAccessor, metricName, lowerIsBetter = true) => {
    const values = [];
    reports.forEach(report => {
      const value = metricAccessor(report);
      if (value !== undefined && value !== null) {
        values.push({
          mechanism: report.mechanism,
          value: Number(value)
        });
      }
    });
    
    // Sort by value
    values.sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);
    
    // Assign ranks
    const ranks = {};
    values.forEach((item, index) => {
      ranks[item.mechanism] = index + 1;
    });
    
    comparisonReport.overallRanking[metricName] = {
      ranks,
      lowerIsBetter
    };
  };
  
  // Rank by gas usage (lower is better)
  rankByMetric(
    report => report.data.summary.averageGasUsed,
    'Gas Usage',
    true
  );
  
  // Rank by latency (lower is better)
  rankByMetric(
    report => report.data.performanceMetrics?.latencyMs?.average,
    'Latency',
    true
  );
  
  // Rank by throughput (higher is better)
  rankByMetric(
    report => report.data.performanceMetrics?.throughput?.transactionsPerSecond,
    'Throughput',
    false
  );
  
  // 5. Write the comparison report
  fs.writeFileSync(
    'comprehensive-consensus-comparison.json',
    JSON.stringify(comparisonReport, null, 2)
  );
  
  // 6. Generate a human-readable summary
  const summaryLines = [
    '# Comprehensive Consensus Mechanism Comparison',
    '',
    `Generated on: ${new Date().toISOString()}`,
    '',
    '## Mechanisms Compared',
    ''
  ];
  
  Object.keys(comparisonReport.mechanisms).forEach(mechanism => {
    summaryLines.push(`- ${mechanism}`);
  });
  
  summaryLines.push('', '## Summary of Results', '');
  
  // Gas usage summary
  summaryLines.push('### Gas Usage', '');
  summaryLines.push('| Mechanism | Average Gas | Total Gas |');
  summaryLines.push('|-----------|-------------|-----------|');
  
  Object.entries(comparisonReport.gasUsageComparison.summary).forEach(([mechanism, data]) => {
    summaryLines.push(`| ${mechanism} | ${data.avgGas} | ${data.totalGas} |`);
  });
  
  // Latency summary
  if (Object.keys(comparisonReport.performanceComparison.latency.average).length > 0) {
    summaryLines.push('', '### Latency (ms)', '');
    summaryLines.push('| Mechanism | Average Latency (ms) |');
    summaryLines.push('|-----------|---------------------|');
    
    Object.entries(comparisonReport.performanceComparison.latency.average).forEach(([mechanism, value]) => {
      summaryLines.push(`| ${mechanism} | ${value} |`);
    });
  }
  
  // Throughput summary
  if (Object.keys(comparisonReport.performanceComparison.throughput.average).length > 0) {
    summaryLines.push('', '### Throughput (tx/s)', '');
    summaryLines.push('| Mechanism | Average Throughput | Theoretical Max |');
    summaryLines.push('|-----------|-------------------|----------------|');
    
    Object.entries(comparisonReport.performanceComparison.throughput.average).forEach(([mechanism, value]) => {
      const theoretical = comparisonReport.performanceComparison.throughput.theoretical[mechanism] || 'N/A';
      summaryLines.push(`| ${mechanism} | ${value} | ${theoretical} |`);
    });
  }
  
  // Scalability and Fault Tolerance
  summaryLines.push('', '### Scalability and Fault Tolerance', '');
  summaryLines.push('| Mechanism | Scalability Notes | Fault Tolerance |');
  summaryLines.push('|-----------|-------------------|----------------|');
  
  Object.entries(comparisonReport.performanceComparison.scalability.analysis).forEach(([mechanism, analysis]) => {
    const faultTolerance = comparisonReport.performanceComparison.faultTolerance[mechanism] || 'N/A';
    summaryLines.push(`| ${mechanism} | ${analysis} | ${faultTolerance} |`);
  });
  
  // Overall Ranking
  summaryLines.push('', '## Overall Ranking', '');
  summaryLines.push('| Mechanism | Gas Usage Rank | Latency Rank | Throughput Rank |');
  summaryLines.push('|-----------|----------------|--------------|-----------------|');
  
  const allMechanisms = Object.keys(comparisonReport.mechanisms);
  allMechanisms.forEach(mechanism => {
    const gasRank = comparisonReport.overallRanking['Gas Usage']?.ranks[mechanism] || 'N/A';
    const latencyRank = comparisonReport.overallRanking['Latency']?.ranks[mechanism] || 'N/A';
    const throughputRank = comparisonReport.overallRanking['Throughput']?.ranks[mechanism] || 'N/A';
    
    summaryLines.push(`| ${mechanism} | ${gasRank} | ${latencyRank} | ${throughputRank} |`);
  });
  
  // Write summary markdown file
  fs.writeFileSync(
    'consensus-comparison-summary.md',
    summaryLines.join('\n')
  );
  
  console.log('✅ Comprehensive consensus comparison generated successfully!');
  console.log('📊 JSON report: comprehensive-consensus-comparison.json');
  console.log('📄 Summary report: consensus-comparison-summary.md');
}

// Execute the comparison generator
generateComprehensiveComparison();
