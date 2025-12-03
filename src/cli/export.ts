#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import ora from 'ora';
import { loadConfig } from '../config/loader.js';
import { OpenAIProvider } from '../providers/openai/client.js';
import { logger } from '../utils/logger.js';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('    ASSISTANT CLONER - EXPORT MODE');
  console.log('═══════════════════════════════════════');
  console.log('');

  try {
    // Carregar configuração (apenas source)
    const config = loadConfig();
    logger.setLevel(config.logLevel);

    logger.info('Exportando assistants da origem...');
    console.log('');

    // Criar provider
    const provider = new OpenAIProvider(
      config.srcApiKey,
      config.srcOrgId,
      config.srcProjectId
    );

    // Listar assistants
    const spinner = ora('Listando assistants...').start();
    const assistants = await provider.listAllAssistants();
    spinner.succeed(`Encontrados ${assistants.length} assistants`);

    // Preparar export
    const exportData = {
      exported_at: new Date().toISOString(),
      source: {
        org_id: config.srcOrgId,
        project_id: config.srcProjectId,
      },
      assistants,
    };

    // Salvar arquivo
    const outputDir = config.outputDir;
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `assistants-export-${timestamp}.json`;
    const filepath = path.join(outputDir, filename);

    await fs.writeFile(
      filepath,
      JSON.stringify(exportData, null, 2),
      'utf-8'
    );

    logger.success(`Export salvo: ${filepath}`);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`Total exportados: ${assistants.length}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('💡 Para importar, use: npm run clone:import');
    console.log('');

  } catch (error: any) {
    logger.error('Erro ao exportar:', error);
    process.exit(1);
  }
}

main();
