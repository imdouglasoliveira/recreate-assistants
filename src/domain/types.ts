/**
 * Tipos principais do domínio
 */

export interface AssistantSnapshot {
  id: string;
  name: string;
  description?: string;
  instructions: string;
  model: string;
  temperature?: number;
  top_p?: number;
  response_format?: ResponseFormat;
  tools: Tool[];
  tool_resources?: ToolResources;
  metadata?: Record<string, string>;
}

export interface Tool {
  type: 'function' | 'file_search' | 'code_interpreter';
  function?: FunctionTool;
}

export interface FunctionTool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface ResponseFormat {
  type?: 'text' | 'json_object' | 'json_schema';
  json_schema?: Record<string, any>;
}

export interface ToolResources {
  file_search?: {
    vector_store_ids: string[];
  };
  code_interpreter?: {
    file_ids: string[];
  };
}

export interface CloneConfig {
  srcApiKey: string;
  dstApiKey: string;
  srcOrgId?: string;
  dstOrgId?: string;
  srcProjectId?: string;
  dstProjectId?: string;
  cloneMode: 'all' | 'by_id' | 'by_name';
  cloneIds?: string[];
  cloneNamePrefix?: string;
  dryRun: boolean;
  includeFileSearch: boolean;
  includeCodeInterpreter: boolean;
  maxConcurrency: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  outputDir: string;
}

export interface CloneResult {
  srcId: string;
  dstId?: string;
  name: string;
  status: 'success' | 'failed' | 'skipped';
  operations: {
    assistant: 'created' | 'updated' | 'skipped' | 'failed';
    file_search?: 'cloned' | 'skipped' | 'failed';
    code_interpreter?: 'cloned' | 'skipped' | 'failed';
  };
  error?: string;
  timestamp: string;
}

export interface CloneReport {
  cloned_at: string;
  source: {
    org_id?: string;
    project_id?: string;
  };
  destination: {
    org_id?: string;
    project_id?: string;
  };
  mappings: CloneResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
}

export interface VectorStoreFile {
  id: string;
  object: 'vector_store.file';
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'failed';
  last_error?: {
    code: string;
    message: string;
  };
}

export interface FileObject {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status?: 'uploaded' | 'processed' | 'error';
}

export interface VectorStore {
  id: string;
  object: 'vector_store';
  created_at: number;
  name: string;
  usage_bytes: number;
  file_counts: {
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  status: 'expired' | 'in_progress' | 'completed';
  expires_after?: {
    anchor: string;
    days: number;
  };
  expires_at?: number;
  last_active_at?: number;
  metadata?: Record<string, string>;
}
