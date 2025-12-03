#!/usr/bin/env node
import ora from 'ora';
import { loadConfig, validateConfig } from '../config/loader.js';
import { AssistantCloner } from '../services/cloner.js';
import { Reporter } from '../services/reporter.js';
import { logger } from '../utils/logger.js';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('    ASSISTANT CLONER - APPLY MODE');
  console.log('═══════════════════════════════════════');
  console.log('');

  try {
    // Load configuration
    const config = loadConfig();
    logger.setLevel(config.logLevel);
    validateConfig(config);

    if (config.dryRun) {
      logger.warn('⚠️  DRY_RUN=true: No changes will be made');
    }

    logger.info('Configuration loaded:');
    logger.info(`  Mode: ${config.cloneMode}`);
    logger.info(`  Dry Run: ${config.dryRun}`);
    logger.info(`  File Search: ${config.includeFileSearch}`);
    logger.info(`  Code Interpreter: ${config.includeCodeInterpreter}`);
    logger.info(`  Max Concurrency: ${config.maxConcurrency}`);
    console.log('');

    // Create cloner
    const cloner = new AssistantCloner(config);

    // Execute cloning
    const spinner = ora('Cloning assistants...').start();
    const results = await cloner.clone();
    spinner.succeed('Cloning completed!');

    // Generate reports
    const reporter = new Reporter(config);
    await reporter.generateReport(results);

    // Display summary
    Reporter.printSummary(results);

    // Display some results
    console.log('First results:');
    console.log('');

    for (const result of results.slice(0, 5)) {
      const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
      console.log(`${icon} ${result.name}`);
      console.log(`   ${result.srcId} -> ${result.dstId || 'N/A'}`);
      console.log(`   Operation: ${result.operations.assistant}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    }

    if (results.length > 5) {
      console.log(`... and ${results.length - 5} more assistants`);
      console.log('');
    }

    console.log(`📄 Reports saved to: ${config.outputDir}`);
    console.log('');

    // Exit code based on failures
    const failed = results.filter(r => r.status === 'failed').length;
    if (failed > 0) {
      logger.warn(`${failed} assistants failed. Check report for details.`);
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('Error executing cloning:', error);
    process.exit(1);
  }
}

main();
