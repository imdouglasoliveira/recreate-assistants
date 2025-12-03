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
   * Plan cloning (dry-run)
   */
  async plan(): Promise<CloneResult[]> {
    logger.info('Starting planning...');
    const assistants = await this.getAssistantsToClone();
    logger.info(`Found ${assistants.length} assistants to clone`);

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
   * Execute cloning
   */
  async clone(): Promise<CloneResult[]> {
    if (this.config.dryRun) {
      logger.info('DRY-RUN mode enabled - no changes will be made');
      return this.plan();
    }

    logger.info('Starting cloning...');
    const assistants = await this.getAssistantsToClone();
    logger.info(`Found ${assistants.length} assistants to clone`);

    const limit = pLimit(this.config.maxConcurrency);
    const results = await Promise.all(
      assistants.map(assistant => limit(() => this.cloneAssistant(assistant)))
    );

    return results;
  }

  /**
   * Clone an individual assistant
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
      logger.info(`Cloning assistant: ${srcAssistant.name} (${srcAssistant.id})`);

      // Check if already exists
      const existing = await this.dstProvider.findByMetadata('cloned_from', srcAssistant.id);

      // Prepare payload (without tool_resources for now)
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
        // Update existing
        logger.info(`Assistant already exists in destination, updating: ${existing.id}`);
        dstAssistant = await retryWithBackoff(() =>
          this.dstProvider.updateAssistant(existing.id, payload)
        );
        result.operations.assistant = 'updated';
      } else {
        // Create new
        dstAssistant = await retryWithBackoff(() =>
          this.dstProvider.createAssistant(payload)
        );
        result.operations.assistant = 'created';
      }

      result.dstId = dstAssistant.id;
      logger.success(`Assistant cloned: ${srcAssistant.id} -> ${dstAssistant.id}`);

      // Clone File Search (if enabled)
      if (this.config.includeFileSearch && srcAssistant.tool_resources?.file_search) {
        try {
          await this.cloneFileSearch(srcAssistant, dstAssistant);
          result.operations.file_search = 'cloned';
        } catch (error: any) {
          logger.error(`Error cloning File Search: ${error.message}`);
          result.operations.file_search = 'failed';
        }
      }

      // Clone Code Interpreter (if enabled)
      if (this.config.includeCodeInterpreter && srcAssistant.tool_resources?.code_interpreter) {
        try {
          await this.cloneCodeInterpreter(srcAssistant, dstAssistant);
          result.operations.code_interpreter = 'cloned';
        } catch (error: any) {
          logger.error(`Error cloning Code Interpreter: ${error.message}`);
          result.operations.code_interpreter = 'failed';
        }
      }

      result.status = 'success';
    } catch (error: any) {
      logger.error(`Error cloning assistant ${srcAssistant.id}:`, error);
      result.status = 'failed';
      result.operations.assistant = 'failed';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Clone File Search (vector stores + files)
   */
  private async cloneFileSearch(
    srcAssistant: AssistantSnapshot,
    dstAssistant: AssistantSnapshot
  ): Promise<void> {
    const vsIds = srcAssistant.tool_resources?.file_search?.vector_store_ids || [];
    if (vsIds.length === 0) return;

    logger.info(`Cloning ${vsIds.length} vector store(s)...`);
    const newVectorStoreIds: string[] = [];

    for (const vsId of vsIds) {
      const vs = await this.srcProvider.getVectorStore(vsId);
      const files = await this.srcProvider.listVectorStoreFiles(vsId);

      logger.info(`Vector Store ${vsId}: ${files.length} file(s)`);
      const newFileIds: string[] = [];

      for (const file of files) {
        try {
          // Download file
          const fileInfo = await this.srcProvider.getFile(file.id);
          const content = await retryWithBackoff(() =>
            this.srcProvider.downloadFileContent(file.id)
          );

          // Upload to destination
          const newFile = await retryWithBackoff(() =>
            this.dstProvider.uploadFile(content, fileInfo.filename)
          );

          newFileIds.push(newFile.id);
          logger.debug(`File cloned: ${file.id} -> ${newFile.id}`);
        } catch (error: any) {
          logger.warn(`Failed to clone file ${file.id}: ${error.message}`);
        }
      }

      // Create vector store in destination
      const newVs = await retryWithBackoff(() =>
        this.dstProvider.createVectorStore(`Clone of ${vs.name}`, newFileIds)
      );

      newVectorStoreIds.push(newVs.id);
      logger.success(`Vector Store cloned: ${vsId} -> ${newVs.id}`);
    }

    // Update assistant with new vector stores
    await this.dstProvider.updateAssistant(dstAssistant.id, {
      tool_resources: {
        file_search: {
          vector_store_ids: newVectorStoreIds,
        },
      },
    });

    logger.success('File Search cloned successfully');
  }

  /**
   * Clone Code Interpreter (files)
   */
  private async cloneCodeInterpreter(
    srcAssistant: AssistantSnapshot,
    dstAssistant: AssistantSnapshot
  ): Promise<void> {
    const fileIds = srcAssistant.tool_resources?.code_interpreter?.file_ids || [];
    if (fileIds.length === 0) return;

    logger.info(`Cloning ${fileIds.length} Code Interpreter file(s)...`);
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
        logger.debug(`File cloned: ${fileId} -> ${newFile.id}`);
      } catch (error: any) {
        logger.warn(`Failed to clone file ${fileId}: ${error.message}`);
      }
    }

    // Update assistant with new files
    await this.dstProvider.updateAssistant(dstAssistant.id, {
      tool_resources: {
        code_interpreter: {
          file_ids: newFileIds,
        },
      },
    });

    logger.success('Code Interpreter cloned successfully');
  }

  /**
   * Get the list of assistants to clone based on configuration
   */
  private async getAssistantsToClone(): Promise<AssistantSnapshot[]> {
    const allAssistants = await this.srcProvider.listAllAssistants();

    switch (this.config.cloneMode) {
      case 'all':
        return allAssistants;

      case 'by_id':
        if (!this.config.cloneIds || this.config.cloneIds.length === 0) {
          throw new Error('CLONE_IDS not defined for by_id mode');
        }
        return allAssistants.filter(a => this.config.cloneIds!.includes(a.id));

      case 'by_name':
        if (!this.config.cloneNamePrefix) {
          throw new Error('CLONE_NAME_PREFIX not defined for by_name mode');
        }
        return allAssistants.filter(a =>
          a.name.toLowerCase().includes(this.config.cloneNamePrefix!.toLowerCase())
        );

      default:
        throw new Error(`Invalid clone mode: ${this.config.cloneMode}`);
    }
  }
}
