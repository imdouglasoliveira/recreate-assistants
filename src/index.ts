#!/usr/bin/env node
import { program } from 'commander';
import { loadConfig, validateConfig } from './config/loader.js';
import { AssistantCloner } from './services/cloner.js';
import { Reporter } from './services/reporter.js';
import { logger } from './utils/logger.js';

program
  .name('clone-assistants')
  .description('Tool to clone OpenAI Assistants between Organizations and Projects')
  .version('1.0.0');

program
  .command('plan')
  .description('Shows what would be cloned (dry-run)')
  .action(async () => {
    try {
      const config = loadConfig();
      logger.setLevel(config.logLevel);
      validateConfig(config);

      const cloner = new AssistantCloner(config);
      const results = await cloner.plan();

      console.log('\n📋 Cloning plan:\n');
      for (const result of results) {
        console.log(`  - ${result.name} (${result.srcId})`);
        console.log(`    Operation: ${result.operations.assistant}`);
      }

      Reporter.printSummary(results);
    } catch (error: any) {
      logger.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Execute the cloning')
  .action(async () => {
    try {
      const config = loadConfig();
      logger.setLevel(config.logLevel);
      validateConfig(config);

      const cloner = new AssistantCloner(config);
      const results = await cloner.clone();

      const reporter = new Reporter(config);
      await reporter.generateReport(results);

      Reporter.printSummary(results);
      console.log(`\n📄 Reports saved to: ${config.outputDir}\n`);
    } catch (error: any) {
      logger.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export assistants to JSON')
  .action(async () => {
    logger.info('Use: npm run clone:export');
  });

program
  .command('import <file>')
  .description('Import assistants from JSON')
  .action(async (file: string) => {
    logger.info(`Use: npm run clone:import ${file}`);
  });

program.parse();
