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
    // Load configuration (source only)
    const config = loadConfig();
    logger.setLevel(config.logLevel);

    logger.info('Exporting assistants from source...');
    console.log('');

    // Create provider
    const provider = new OpenAIProvider(
      config.srcApiKey,
      config.srcOrgId,
      config.srcProjectId
    );

    // List assistants
    const spinner = ora('Listing assistants...').start();
    const assistants = await provider.listAllAssistants();
    spinner.succeed(`Found ${assistants.length} assistants`);

    // Prepare export
    const exportData = {
      exported_at: new Date().toISOString(),
      source: {
        org_id: config.srcOrgId,
        project_id: config.srcProjectId,
      },
      assistants,
    };

    // Save file
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

    logger.success(`Export saved: ${filepath}`);
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`Total exported: ${assistants.length}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('💡 To import, use: npm run clone:import');
    console.log('');

  } catch (error: any) {
    logger.error('Error exporting:', error);
    process.exit(1);
  }
}

main();
