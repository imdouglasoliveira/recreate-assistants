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
    // Carregar configuração
    const config = loadConfig();
    logger.setLevel(config.logLevel);
    validateConfig(config);

    if (config.dryRun) {
      logger.warn('⚠️  DRY_RUN=true: Nenhuma alteração será feita');
    }

    logger.info('Configuração carregada:');
    logger.info(`  Mode: ${config.cloneMode}`);
    logger.info(`  Dry Run: ${config.dryRun}`);
    logger.info(`  File Search: ${config.includeFileSearch}`);
    logger.info(`  Code Interpreter: ${config.includeCodeInterpreter}`);
    logger.info(`  Max Concurrency: ${config.maxConcurrency}`);
    console.log('');

    // Criar cloner
    const cloner = new AssistantCloner(config);

    // Executar clonagem
    const spinner = ora('Clonando assistants...').start();
    const results = await cloner.clone();
    spinner.succeed('Clonagem concluída!');

    // Gerar relatórios
    const reporter = new Reporter(config);
    await reporter.generateReport(results);

    // Exibir resumo
    Reporter.printSummary(results);

    // Exibir alguns resultados
    console.log('Primeiros resultados:');
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
      console.log(`... e mais ${results.length - 5} assistants`);
      console.log('');
    }

    console.log(`📄 Relatórios salvos em: ${config.outputDir}`);
    console.log('');

    // Exit code baseado em falhas
    const failed = results.filter(r => r.status === 'failed').length;
    if (failed > 0) {
      logger.warn(`${failed} assistants falharam. Verifique o relatório para detalhes.`);
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('Erro ao executar clonagem:', error);
    process.exit(1);
  }
}

main();
