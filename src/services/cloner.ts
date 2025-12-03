import pLimit from 'p-limit';
import { OpenAIProvider } from '../providers/openai/client.js';
import { logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';
import type { AssistantSnapshot, CloneConfig, CloneResult } from '../domain/types.js';

export class AssistantCloner {
  private srcProvider: OpenAIProvider;
  private dstProvider: OpenAIProvider;
  private config: CloneConfig;

  constructor(config: CloneConfig) {
    this.config = config;
    this.srcProvider = new OpenAIProvider(
      config.srcApiKey,
      config.srcOrgId,
      config.srcProjectId
    );
    this.dstProvider = new OpenAIProvider(
      config.dstApiKey,
      config.dstOrgId,
      config.dstProjectId
    );
  }

  /**
   * Planeja a clonagem (dry-run)
   */
  async plan(): Promise<CloneResult[]> {
    logger.info('Iniciando planejamento...');
    const assistants = await this.getAssistantsToClone();
    logger.info(`Encontrados ${assistants.length} assistants para clonar`);

    const results: CloneResult[] = [];

    for (const assistant of assistants) {
      const existing = await this.dstProvider.findByMetadata('cloned_from', assistant.id);
      const operation = existing ? 'updated' : 'created';

      results.push({
        srcId: assistant.id,
        dstId: existing?.id,
        name: assistant.name,
        status: 'skipped',
        operations: {
          assistant: operation,
          file_search: this.config.includeFileSearch ? 'cloned' : 'skipped',
          code_interpreter: this.config.includeCodeInterpreter ? 'cloned' : 'skipped',
        },
        timestamp: new Date().toISOString(),
      });
    }

    return results;
  }

  /**
   * Executa a clonagem
   */
  async clone(): Promise<CloneResult[]> {
    if (this.config.dryRun) {
      logger.info('Modo DRY-RUN ativado - nenhuma alteração será feita');
      return this.plan();
    }

    logger.info('Iniciando clonagem...');
    const assistants = await this.getAssistantsToClone();
    logger.info(`Encontrados ${assistants.length} assistants para clonar`);

    const limit = pLimit(this.config.maxConcurrency);
    const results = await Promise.all(
      assistants.map(assistant => limit(() => this.cloneAssistant(assistant)))
    );

    return results;
  }

  /**
   * Clona um assistant individual
   */
  private async cloneAssistant(srcAssistant: AssistantSnapshot): Promise<CloneResult> {
    const result: CloneResult = {
      srcId: srcAssistant.id,
      name: srcAssistant.name,
      status: 'success',
      operations: {
        assistant: 'created',
      },
      timestamp: new Date().toISOString(),
    };

    try {
      logger.info(`Clonando assistant: ${srcAssistant.name} (${srcAssistant.id})`);

      // Verificar se já existe
      const existing = await this.dstProvider.findByMetadata('cloned_from', srcAssistant.id);

      // Preparar payload (sem tool_resources por enquanto)
      const payload: Omit<AssistantSnapshot, 'id'> = {
        name: this.config.cloneNamePrefix
          ? `${this.config.cloneNamePrefix}${srcAssistant.name}`
          : srcAssistant.name,
        description: srcAssistant.description,
        instructions: srcAssistant.instructions,
        model: srcAssistant.model,
        tools: srcAssistant.tools,
        temperature: srcAssistant.temperature,
        top_p: srcAssistant.top_p,
        response_format: srcAssistant.response_format,
        metadata: {
          ...(srcAssistant.metadata || {}),
          cloned_from: srcAssistant.id,
          cloned_at: new Date().toISOString(),
        },
      };

      let dstAssistant: AssistantSnapshot;

      if (existing) {
        // Atualizar existente
        logger.info(`Assistant já existe no destino, atualizando: ${existing.id}`);
        dstAssistant = await retryWithBackoff(() =>
          this.dstProvider.updateAssistant(existing.id, payload)
        );
        result.operations.assistant = 'updated';
      } else {
        // Criar novo
        dstAssistant = await retryWithBackoff(() =>
          this.dstProvider.createAssistant(payload)
        );
        result.operations.assistant = 'created';
      }

      result.dstId = dstAssistant.id;
      logger.success(`Assistant clonado: ${srcAssistant.id} -> ${dstAssistant.id}`);

      // Clonar File Search (se habilitado)
      if (this.config.includeFileSearch && srcAssistant.tool_resources?.file_search) {
        try {
          await this.cloneFileSearch(srcAssistant, dstAssistant);
          result.operations.file_search = 'cloned';
        } catch (error: any) {
          logger.error(`Erro ao clonar File Search: ${error.message}`);
          result.operations.file_search = 'failed';
        }
      }

      // Clonar Code Interpreter (se habilitado)
      if (this.config.includeCodeInterpreter && srcAssistant.tool_resources?.code_interpreter) {
        try {
          await this.cloneCodeInterpreter(srcAssistant, dstAssistant);
          result.operations.code_interpreter = 'cloned';
        } catch (error: any) {
          logger.error(`Erro ao clonar Code Interpreter: ${error.message}`);
          result.operations.code_interpreter = 'failed';
        }
      }

      result.status = 'success';
    } catch (error: any) {
      logger.error(`Erro ao clonar assistant ${srcAssistant.id}:`, error);
      result.status = 'failed';
      result.operations.assistant = 'failed';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Clona File Search (vector stores + arquivos)
   */
  private async cloneFileSearch(
    srcAssistant: AssistantSnapshot,
    dstAssistant: AssistantSnapshot
  ): Promise<void> {
    const vsIds = srcAssistant.tool_resources?.file_search?.vector_store_ids || [];
    if (vsIds.length === 0) return;

    logger.info(`Clonando ${vsIds.length} vector store(s)...`);
    const newVectorStoreIds: string[] = [];

    for (const vsId of vsIds) {
      const vs = await this.srcProvider.getVectorStore(vsId);
      const files = await this.srcProvider.listVectorStoreFiles(vsId);

      logger.info(`Vector Store ${vsId}: ${files.length} arquivo(s)`);
      const newFileIds: string[] = [];

      for (const file of files) {
        try {
          // Baixar arquivo
          const fileInfo = await this.srcProvider.getFile(file.id);
          const content = await retryWithBackoff(() =>
            this.srcProvider.downloadFileContent(file.id)
          );

          // Upload no destino
          const newFile = await retryWithBackoff(() =>
            this.dstProvider.uploadFile(content, fileInfo.filename)
          );

          newFileIds.push(newFile.id);
          logger.debug(`Arquivo clonado: ${file.id} -> ${newFile.id}`);
        } catch (error: any) {
          logger.warn(`Falha ao clonar arquivo ${file.id}: ${error.message}`);
        }
      }

      // Criar vector store no destino
      const newVs = await retryWithBackoff(() =>
        this.dstProvider.createVectorStore(`Clone of ${vs.name}`, newFileIds)
      );

      newVectorStoreIds.push(newVs.id);
      logger.success(`Vector Store clonado: ${vsId} -> ${newVs.id}`);
    }

    // Atualizar assistant com novos vector stores
    await this.dstProvider.updateAssistant(dstAssistant.id, {
      tool_resources: {
        file_search: {
          vector_store_ids: newVectorStoreIds,
        },
      },
    });

    logger.success('File Search clonado com sucesso');
  }

  /**
   * Clona Code Interpreter (arquivos)
   */
  private async cloneCodeInterpreter(
    srcAssistant: AssistantSnapshot,
    dstAssistant: AssistantSnapshot
  ): Promise<void> {
    const fileIds = srcAssistant.tool_resources?.code_interpreter?.file_ids || [];
    if (fileIds.length === 0) return;

    logger.info(`Clonando ${fileIds.length} arquivo(s) do Code Interpreter...`);
    const newFileIds: string[] = [];

    for (const fileId of fileIds) {
      try {
        const fileInfo = await this.srcProvider.getFile(fileId);
        const content = await retryWithBackoff(() =>
          this.srcProvider.downloadFileContent(fileId)
        );

        const newFile = await retryWithBackoff(() =>
          this.dstProvider.uploadFile(content, fileInfo.filename)
        );

        newFileIds.push(newFile.id);
        logger.debug(`Arquivo clonado: ${fileId} -> ${newFile.id}`);
      } catch (error: any) {
        logger.warn(`Falha ao clonar arquivo ${fileId}: ${error.message}`);
      }
    }

    // Atualizar assistant com novos arquivos
    await this.dstProvider.updateAssistant(dstAssistant.id, {
      tool_resources: {
        code_interpreter: {
          file_ids: newFileIds,
        },
      },
    });

    logger.success('Code Interpreter clonado com sucesso');
  }

  /**
   * Obtém a lista de assistants para clonar baseado na configuração
   */
  private async getAssistantsToClone(): Promise<AssistantSnapshot[]> {
    const allAssistants = await this.srcProvider.listAllAssistants();

    switch (this.config.cloneMode) {
      case 'all':
        return allAssistants;

      case 'by_id':
        if (!this.config.cloneIds || this.config.cloneIds.length === 0) {
          throw new Error('CLONE_IDS não definido para modo by_id');
        }
        return allAssistants.filter(a => this.config.cloneIds!.includes(a.id));

      case 'by_name':
        if (!this.config.cloneNamePrefix) {
          throw new Error('CLONE_NAME_PREFIX não definido para modo by_name');
        }
        return allAssistants.filter(a =>
          a.name.toLowerCase().includes(this.config.cloneNamePrefix!.toLowerCase())
        );

      default:
        throw new Error(`Modo de clonagem inválido: ${this.config.cloneMode}`);
    }
  }
}
