/**
 * Comprehensive Consensus Comparison Test Suite
 * Runs multiple tests to thoroughly evaluate different consensus mechanisms
 * for the Korean Emissions Trading Scheme (K-ETS) blockchain
 */
const fs = require('fs');
const path = require('path');
const { runValidatorScalingTests } = require('./validator-scaling-test');
const { runTransactionStressTests } = require('./transaction-stress-test');
const { saveTestResults } = require('./test-utils');

// Configure which consensus mechanisms to test
const CONSENSUS_MECHANISMS = ["PoASquare", "PBFT", "DPoS", "PoA", "PoW"];

// Configure which tests to run
const TEST_CONFIG = {
  validatorScaling: {
    enabled: true,
    validatorCounts: [4, 8, 16] // Reduced counts for faster testing
  },
  transactionStress: {
    enabled: true,
    txRates: [1, 5, 10] // Reduced rates for faster testing
  },
  networkLatency: {
    enabled: false, // Not implemented yet
    latencyConditions: []
  },
  byzantineFaults: {
    enabled: false, // Not implemented yet
    faultPercentages: []
  }
};

// Generate a comprehensive report
function generateComprehensiveReport(results) {
  // Create detailed summary
  const summary = {
    testDate: new Date().toISOString(),
    consensusMechanismsEvaluated: CONSENSUS_MECHANISMS,
    completedTests: [],
    rankings: {},
    recommendations: {}
  };
  
  // Process validator scaling results
  if (results.validatorScaling) {
    summary.completedTests.push("validatorScaling");
    
    // Calculate scaling efficiency for each mechanism
    const scalingEfficiency = {};
    const baselineThroughputs = {}; // at lowest validator count
    const scalingRatios = {};
    
    Object.entries(results.validatorScaling.consensusMechanisms).forEach(([mechanism, data]) => {
      if (data.scalingMetrics && data.scalingMetrics.length > 0) {
        const baseline = data.scalingMetrics[0]; // lowest validator count
        baselineThroughputs[mechanism] = baseline.throughput || 0;
        
        const highest = data.scalingMetrics[data.scalingMetrics.length - 1]; // highest validator count
        const ratio = highest.throughput / (baseline.throughput || 1);
        scalingRatios[mechanism] = ratio;
        
        // Higher ratio is better for scaling (1.0 = perfect scaling, <1.0 = degradation)
        scalingEfficiency[mechanism] = ratio;
      }
    });
    
    // Rank by scaling efficiency
    summary.rankings.scalingEfficiency = Object.entries(scalingEfficiency)
      .sort((a, b) => b[1] - a[1])
      .map(([mechanism, score], index) => ({
        rank: index + 1,
        mechanism,
        score: score.toFixed(2),
        description: `Throughput ratio from ${TEST_CONFIG.validatorScaling.validatorCounts[0]} to ${
          TEST_CONFIG.validatorScaling.validatorCounts[TEST_CONFIG.validatorScaling.validatorCounts.length - 1]
        } validators`
      }));
  }
  
  // Process transaction stress test results
  if (results.transactionStress) {
    summary.completedTests.push("transactionStress");
    
    // Extract max throughput for each mechanism
    const maxThroughput = results.transactionStress.comparison.maxThroughput;
    
    // Rank by max throughput
    summary.rankings.maxThroughput = Object.entries(maxThroughput)
      .sort((a, b) => b[1] - a[1])
      .map(([mechanism, throughput], index) => ({
        rank: index + 1,
        mechanism,
        score: throughput.toFixed(2),
        description: `Maximum transactions per second`
      }));
      
    // Extract latency at common tx rate (use the lowest tested rate)
    const lowestRate = TEST_CONFIG.transactionStress.txRates[0];
    const latencyAtLowestRate = {};
    
    Object.entries(results.transactionStress.comparison.latency[lowestRate] || {}).forEach(([mechanism, latency]) => {
      latencyAtLowestRate[mechanism] = latency;
    });
    
    // Rank by latency (lower is better)
    summary.rankings.transactionLatency = Object.entries(latencyAtLowestRate)
      .sort((a, b) => a[1] - b[1])
      .map(([mechanism, latency], index) => ({
        rank: index + 1,
        mechanism,
        score: latency.toFixed(2),
        description: `Average transaction latency (ms) at ${lowestRate} tx/sec`
      }));
  }
  
  // Generate overall rankings based on completed tests
  const overallScores = {};
  
  // Helper to get normalized score (higher is better, 1.0 = best)
  function normalizeScore(scores, mechanism, invert = false) {
    const values = Object.values(scores);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    
    if (range === 0) return 1.0; // All equal
    
    const score = scores[mechanism];
    return invert 
      ? 1 - ((score - min) / range) // Invert (lower raw score is better)
      : (score - min) / range;      // Normal (higher raw score is better)
  }
  
  // Calculate overall scores based on all rankings
  CONSENSUS_MECHANISMS.forEach(mechanism => {
    let totalScore = 0;
    let categories = 0;
    
    // Scaling efficiency (higher is better)
    if (summary.rankings.scalingEfficiency) {
      const scalingRank = summary.rankings.scalingEfficiency.find(r => r.mechanism === mechanism);
      if (scalingRank) {
        const scalingScore = normalizeScore(
          Object.fromEntries(summary.rankings.scalingEfficiency.map(r => [r.mechanism, parseFloat(r.score)])),
          mechanism
        );
        totalScore += scalingScore * 0.3; // 30% weight
        categories++;
      }
    }
    
    // Max throughput (higher is better)
    if (summary.rankings.maxThroughput) {
      const throughputRank = summary.rankings.maxThroughput.find(r => r.mechanism === mechanism);
      if (throughputRank) {
        const throughputScore = normalizeScore(
          Object.fromEntries(summary.rankings.maxThroughput.map(r => [r.mechanism, parseFloat(r.score)])),
          mechanism
        );
        totalScore += throughputScore * 0.4; // 40% weight
        categories++;
      }
    }
    
    // Transaction latency (lower is better, so invert)
    if (summary.rankings.transactionLatency) {
      const latencyRank = summary.rankings.transactionLatency.find(r => r.mechanism === mechanism);
      if (latencyRank) {
        const latencyScore = normalizeScore(
          Object.fromEntries(summary.rankings.transactionLatency.map(r => [r.mechanism, parseFloat(r.score)])),
          mechanism,
          true // Invert because lower latency is better
        );
        totalScore += latencyScore * 0.3; // 30% weight
        categories++;
      }
    }
    
    // Calculate final score (0-100)
    overallScores[mechanism] = categories > 0 
      ? Math.round((totalScore / categories) * 100) 
      : 0;
  });
  
  // Add overall ranking
  summary.rankings.overall = Object.entries(overallScores)
    .sort((a, b) => b[1] - a[1])
    .map(([mechanism, score], index) => ({
      rank: index + 1,
      mechanism,
      score,
      description: `Overall performance score (0-100)`
    }));
  
  // Generate recommendations
  const topMechanism = summary.rankings.overall[0].mechanism;
  const secondMechanism = summary.rankings.overall[1]?.mechanism;
  
  summary.recommendations = {
    bestOverall: {
      mechanism: topMechanism,
      description: `${topMechanism} provides the best overall performance based on scaling efficiency, throughput, and latency.`
    },
    alternative: secondMechanism ? {
      mechanism: secondMechanism,
      description: `${secondMechanism} is a viable alternative with different performance characteristics.`
    } : null,
    scalability: {
      mechanism: summary.rankings.scalingEfficiency?.[0]?.mechanism,
      description: `For large-scale deployments with many validators, ${summary.rankings.scalingEfficiency?.[0]?.mechanism} offers the best scaling characteristics.`
    },
    performance: {
      mechanism: summary.rankings.maxThroughput?.[0]?.mechanism,
      description: `For high-throughput applications, ${summary.rankings.maxThroughput?.[0]?.mechanism} delivers the best transaction processing capacity.`
    },
    responsiveness: {
      mechanism: summary.rankings.transactionLatency?.[0]?.mechanism,
      description: `For low-latency applications requiring quick response times, ${summary.rankings.transactionLatency?.[0]?.mechanism} provides the fastest transaction confirmation.`
    },
    ketsRecommendation: {
      mechanism: topMechanism,
      description: `For the Korean Emissions Trading Scheme (K-ETS) blockchain implementation, ${topMechanism} is recommended based on its balance of throughput, latency, and scaling properties which align well with carbon credit trading requirements.`
    }
  };
  
  return summary;
}

// Main function to run all tests
async function runComprehensiveTests() {
  console.log("=== Starting Comprehensive Consensus Comparison Tests ===");
  console.log(`Testing consensus mechanisms: ${CONSENSUS_MECHANISMS.join(', ')}`);
  
  const results = {};
  
  // Run validator scaling tests if enabled
  if (TEST_CONFIG.validatorScaling.enabled) {
    console.log("\n=== Running Validator Scaling Tests ===");
    results.validatorScaling = await runValidatorScalingTests(
      CONSENSUS_MECHANISMS,
      TEST_CONFIG.validatorScaling.validatorCounts
    );
  }
  
  // Run transaction stress tests if enabled
  if (TEST_CONFIG.transactionStress.enabled) {
    console.log("\n=== Running Transaction Stress Tests ===");
    results.transactionStress = await runTransactionStressTests(
      CONSENSUS_MECHANISMS,
      TEST_CONFIG.transactionStress.txRates
    );
  }
  
  // TODO: Add other tests as they are implemented
  
  // Generate comprehensive report
  console.log("\n=== Generating Comprehensive Report ===");
  const report = generateComprehensiveReport(results);
  
  // Save comprehensive report
  saveTestResults("comprehensive-consensus-report.json", report);
  
  // Print summary to console
  console.log("\n=== Consensus Mechanism Comparison Summary ===");
  console.log(`Tests completed: ${report.completedTests.join(', ')}`);
  
  if (report.rankings.overall) {
    console.log("\nOverall Rankings:");
    report.rankings.overall.forEach(({ rank, mechanism, score }) => {
      console.log(`${rank}. ${mechanism}: ${score} points`);
    });
  }
  
  if (report.recommendations.ketsRecommendation) {
    console.log(`\nRecommended for K-ETS: ${report.recommendations.ketsRecommendation.mechanism}`);
    console.log(report.recommendations.ketsRecommendation.description);
  }
  
  return { results, report };
}

// Execute if called directly
if (require.main === module) {
  runComprehensiveTests()
    .then(() => {
      console.log("\n=== Comprehensive Tests Complete ===");
      console.log("Full results saved to logs/comprehensive-consensus-report.json");
    })
    .catch(error => {
      console.error("Error running comprehensive tests:", error);
    });
}

module.exports = {
  runComprehensiveTests
};
