import dotenv from 'dotenv';
import type { CloneConfig, LogLevel } from '../domain/types.js';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
export function loadConfig(): CloneConfig {
  // Validate required variables
  const srcApiKey = process.env.OPENAI_SRC_API_KEY;
  const dstApiKey = process.env.OPENAI_DST_API_KEY;

  if (!srcApiKey || !dstApiKey) {
    throw new Error(
      'OPENAI_SRC_API_KEY and OPENAI_DST_API_KEY are required. ' +
      'Configure them in the .env file'
    );
  }

  // Validate clone mode
  const cloneMode = (process.env.CLONE_MODE || 'all') as 'all' | 'by_id' | 'by_name';
  if (!['all', 'by_id', 'by_name'].includes(cloneMode)) {
    throw new Error(`Invalid CLONE_MODE: ${cloneMode}. Use: all, by_id or by_name`);
  }

  // Parse IDs
  const cloneIds = process.env.CLONE_IDS
    ? process.env.CLONE_IDS.split(',').map(id => id.trim()).filter(Boolean)
    : undefined;

  // Parse booleans
  const dryRun = process.env.DRY_RUN === 'true';
  const includeFileSearch = process.env.INCLUDE_FILE_SEARCH === 'true';
  const includeCodeInterpreter = process.env.INCLUDE_CODE_INTERPRETER === 'true';

  // Parse numbers
  const maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || '3', 10);
  if (isNaN(maxConcurrency) || maxConcurrency < 1) {
    throw new Error('MAX_CONCURRENCY must be a number greater than 0');
  }

  // Validate log level
  const logLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Use: debug, info, warn or error`);
  }

  return {
    srcApiKey,
    dstApiKey,
    srcOrgId: process.env.OPENAI_SRC_ORG_ID,
    dstOrgId: process.env.OPENAI_DST_ORG_ID,
    srcProjectId: process.env.OPENAI_SRC_PROJECT_ID,
    dstProjectId: process.env.OPENAI_DST_PROJECT_ID,
    cloneMode,
    cloneIds,
    cloneNamePrefix: process.env.CLONE_NAME_PREFIX,
    dryRun,
    includeFileSearch,
    includeCodeInterpreter,
    maxConcurrency,
    logLevel,
    outputDir: process.env.OUTPUT_DIR || './out',
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: CloneConfig): void {
  // Mode-specific validations
  if (config.cloneMode === 'by_id' && (!config.cloneIds || config.cloneIds.length === 0)) {
    throw new Error('CLONE_IDS is required when CLONE_MODE=by_id');
  }

  if (config.cloneMode === 'by_name' && !config.cloneNamePrefix) {
    throw new Error('CLONE_NAME_PREFIX is required when CLONE_MODE=by_name');
  }

  // Warnings
  if (config.includeFileSearch) {
    console.warn('⚠️  INCLUDE_FILE_SEARCH=true: costly operation in time and $$$');
  }

  if (config.includeCodeInterpreter) {
    console.warn('⚠️  INCLUDE_CODE_INTERPRETER=true: costly operation in time and $$$');
  }
}
