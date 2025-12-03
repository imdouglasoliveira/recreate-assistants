#!/usr/bin/env node
import ora from 'ora';
import { loadConfig, validateConfig } from '../config/loader.js';
import { AssistantCloner } from '../services/cloner.js';
import { Reporter } from '../services/reporter.js';
import { logger } from '../utils/logger.js';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('    ASSISTANT CLONER - PLAN MODE');
  console.log('═══════════════════════════════════════');
  console.log('');

  try {
    // Load configuration
    const config = loadConfig();
    logger.setLevel(config.logLevel);
    validateConfig(config);

    logger.info('Configuration loaded:');
    logger.info(`  Mode: ${config.cloneMode}`);
    logger.info(`  Dry Run: ${config.dryRun}`);
    logger.info(`  File Search: ${config.includeFileSearch}`);
    logger.info(`  Code Interpreter: ${config.includeCodeInterpreter}`);
    logger.info(`  Max Concurrency: ${config.maxConcurrency}`);
    console.log('');

    // Create cloner
    const cloner = new AssistantCloner(config);

    // Execute plan
    const spinner = ora('Analyzing assistants...').start();
    const results = await cloner.plan();
    spinner.succeed(`Found ${results.length} assistants`);

    // Display plan
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('           CLONING PLAN');
    console.log('═══════════════════════════════════════');
    console.log('');

    for (const result of results) {
      console.log(`📋 ${result.name}`);
      console.log(`   Source ID: ${result.srcId}`);
      console.log(`   Operation: ${result.operations.assistant}`);

      if (result.dstId) {
        console.log(`   Existing ID: ${result.dstId}`);
      }

      if (result.operations.file_search !== 'skipped') {
        console.log(`   File Search: ${result.operations.file_search}`);
      }

      if (result.operations.code_interpreter !== 'skipped') {
        console.log(`   Code Interpreter: ${result.operations.code_interpreter}`);
      }

      console.log('');
    }

    // Display summary
    Reporter.printSummary(results);

    console.log('💡 To execute cloning, use: npm run clone:apply');
    console.log('');

  } catch (error: any) {
    logger.error('Error executing plan:', error);
    process.exit(1);
  }
}

main();
