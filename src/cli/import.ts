#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import ora from 'ora';
import pLimit from 'p-limit';
import { loadConfig } from '../config/loader.js';
import { OpenAIProvider } from '../providers/openai/client.js';
import { Reporter } from '../services/reporter.js';
import { logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';
import type { AssistantSnapshot, CloneResult } from '../domain/types.js';

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('    ASSISTANT CLONER - IMPORT MODE');
  console.log('═══════════════════════════════════════');
  console.log('');

  try {
    // Load configuration (destination only)
    const config = loadConfig();
    logger.setLevel(config.logLevel);

    // Get import file path
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('❌ Usage: npm run clone:import <file.json>');
      console.error('');
      console.error('Example:');
      console.error('  npm run clone:import ./out/assistants-export-2024-12-03.json');
      console.error('');
      process.exit(1);
    }

    const importFile = args[0];
    logger.info(`Importing from: ${importFile}`);

    // Read file
    const content = await fs.readFile(importFile, 'utf-8');
    const data = JSON.parse(content);

    if (!data.assistants || !Array.isArray(data.assistants)) {
      throw new Error('Invalid file format: expected { assistants: [...] }');
    }

    const assistants: AssistantSnapshot[] = data.assistants;
    logger.info(`Found ${assistants.length} assistants in file`);
    console.log('');

    // Create destination provider
    const provider = new OpenAIProvider(
      config.dstApiKey,
      config.dstOrgId,
      config.dstProjectId
    );

    // Import assistants
    const spinner = ora('Importing assistants...').start();
    const limit = pLimit(config.maxConcurrency);
    const results: CloneResult[] = [];

    await Promise.all(
      assistants.map(assistant =>
        limit(async () => {
          const result = await importAssistant(provider, assistant);
          results.push(result);
        })
      )
    );

    spinner.succeed('Import completed!');

    // Generate reports
    const reporter = new Reporter(config);
    await reporter.generateReport(results);

    // Display summary
    Reporter.printSummary(results);

    console.log(`📄 Reports saved to: ${config.outputDir}`);
    console.log('');

    // Exit code based on failures
    const failed = results.filter(r => r.status === 'failed').length;
    if (failed > 0) {
      logger.warn(`${failed} assistants failed. Check report for details.`);
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('Error importing:', error);
    process.exit(1);
  }
}

async function importAssistant(
  provider: OpenAIProvider,
  snapshot: AssistantSnapshot
): Promise<CloneResult> {
  const result: CloneResult = {
    srcId: snapshot.id,
    name: snapshot.name,
    status: 'success',
    operations: {
      assistant: 'created',
    },
    timestamp: new Date().toISOString(),
  };

  try {
    logger.info(`Importing: ${snapshot.name} (${snapshot.id})`);

    // Check if already exists
    const existing = await provider.findByMetadata('imported_from', snapshot.id);

    // Prepare payload
    const payload = {
      ...snapshot,
      metadata: {
        ...(snapshot.metadata || {}),
        imported_from: snapshot.id,
        imported_at: new Date().toISOString(),
      },
    };

    let created: AssistantSnapshot;

    if (existing) {
      logger.info(`Assistant already exists, updating: ${existing.id}`);
      created = await retryWithBackoff(() =>
        provider.updateAssistant(existing.id, payload)
      );
      result.operations.assistant = 'updated';
    } else {
      const { id, ...payloadWithoutId } = payload;
      created = await retryWithBackoff(() =>
        provider.createAssistant(payloadWithoutId)
      );
      result.operations.assistant = 'created';
    }

    result.dstId = created.id;
    logger.success(`Imported: ${snapshot.id} -> ${created.id}`);

    result.status = 'success';
  } catch (error: any) {
    logger.error(`Error importing ${snapshot.id}:`, error);
    result.status = 'failed';
    result.operations.assistant = 'failed';
    result.error = error.message;
  }

  return result;
}

main();
