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
    // Carregar configuração (apenas destination)
    const config = loadConfig();
    logger.setLevel(config.logLevel);

    // Perguntar pelo arquivo de import
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('❌ Uso: npm run clone:import <arquivo.json>');
      console.error('');
      console.error('Exemplo:');
      console.error('  npm run clone:import ./out/assistants-export-2024-12-03.json');
      console.error('');
      process.exit(1);
    }

    const importFile = args[0];
    logger.info(`Importando de: ${importFile}`);

    // Ler arquivo
    const content = await fs.readFile(importFile, 'utf-8');
    const data = JSON.parse(content);

    if (!data.assistants || !Array.isArray(data.assistants)) {
      throw new Error('Formato de arquivo inválido: esperado { assistants: [...] }');
    }

    const assistants: AssistantSnapshot[] = data.assistants;
    logger.info(`Encontrados ${assistants.length} assistants no arquivo`);
    console.log('');

    // Criar provider de destino
    const provider = new OpenAIProvider(
      config.dstApiKey,
      config.dstOrgId,
      config.dstProjectId
    );

    // Importar assistants
    const spinner = ora('Importando assistants...').start();
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

    spinner.succeed('Import concluído!');

    // Gerar relatórios
    const reporter = new Reporter(config);
    await reporter.generateReport(results);

    // Exibir resumo
    Reporter.printSummary(results);

    console.log(`📄 Relatórios salvos em: ${config.outputDir}`);
    console.log('');

    // Exit code baseado em falhas
    const failed = results.filter(r => r.status === 'failed').length;
    if (failed > 0) {
      logger.warn(`${failed} assistants falharam. Verifique o relatório para detalhes.`);
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('Erro ao importar:', error);
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
    logger.info(`Importando: ${snapshot.name} (${snapshot.id})`);

    // Verificar se já existe
    const existing = await provider.findByMetadata('imported_from', snapshot.id);

    // Preparar payload
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
      logger.info(`Assistant já existe, atualizando: ${existing.id}`);
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
    logger.success(`Importado: ${snapshot.id} -> ${created.id}`);

    result.status = 'success';
  } catch (error: any) {
    logger.error(`Erro ao importar ${snapshot.id}:`, error);
    result.status = 'failed';
    result.operations.assistant = 'failed';
    result.error = error.message;
  }

  return result;
}

main();
