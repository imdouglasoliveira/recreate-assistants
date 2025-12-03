#!/usr/bin/env node
import { program } from 'commander';
import { loadConfig, validateConfig } from './config/loader.js';
import { AssistantCloner } from './services/cloner.js';
import { Reporter } from './services/reporter.js';
import { logger } from './utils/logger.js';

program
  .name('clone-assistants')
  .description('Ferramenta para clonar OpenAI Assistants entre Organizations e Projects')
  .version('1.0.0');

program
  .command('plan')
  .description('Mostra o que seria clonado (dry-run)')
  .action(async () => {
    try {
      const config = loadConfig();
      logger.setLevel(config.logLevel);
      validateConfig(config);

      const cloner = new AssistantCloner(config);
      const results = await cloner.plan();

      console.log('\n📋 Plano de clonagem:\n');
      for (const result of results) {
        console.log(`  - ${result.name} (${result.srcId})`);
        console.log(`    Operation: ${result.operations.assistant}`);
      }

      Reporter.printSummary(results);
    } catch (error: any) {
      logger.error('Erro:', error);
      process.exit(1);
    }
  });

program
  .command('apply')
  .description('Executa a clonagem')
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
      console.log(`\n📄 Relatórios salvos em: ${config.outputDir}\n`);
    } catch (error: any) {
      logger.error('Erro:', error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Exporta assistants para JSON')
  .action(async () => {
    logger.info('Use: npm run clone:export');
  });

program
  .command('import <file>')
  .description('Importa assistants de JSON')
  .action(async (file: string) => {
    logger.info(`Use: npm run clone:import ${file}`);
  });

program.parse();
