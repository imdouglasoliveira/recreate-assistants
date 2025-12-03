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
    // Carregar configuração
    const config = loadConfig();
    logger.setLevel(config.logLevel);
    validateConfig(config);

    logger.info('Configuração carregada:');
    logger.info(`  Mode: ${config.cloneMode}`);
    logger.info(`  Dry Run: ${config.dryRun}`);
    logger.info(`  File Search: ${config.includeFileSearch}`);
    logger.info(`  Code Interpreter: ${config.includeCodeInterpreter}`);
    logger.info(`  Max Concurrency: ${config.maxConcurrency}`);
    console.log('');

    // Criar cloner
    const cloner = new AssistantCloner(config);

    // Executar plano
    const spinner = ora('Analisando assistants...').start();
    const results = await cloner.plan();
    spinner.succeed(`Encontrados ${results.length} assistants`);

    // Exibir plano
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('           PLANO DE CLONAGEM');
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

    // Exibir resumo
    Reporter.printSummary(results);

    console.log('💡 Para executar a clonagem, use: npm run clone:apply');
    console.log('');

  } catch (error: any) {
    logger.error('Erro ao executar plano:', error);
    process.exit(1);
  }
}

main();
