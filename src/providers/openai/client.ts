import OpenAI from 'openai';
import type { AssistantSnapshot, VectorStore, VectorStoreFile, FileObject } from '../../domain/types.js';

export class OpenAIProvider {
  private client: OpenAI;
  private orgId?: string;
  private projectId?: string;

  constructor(apiKey: string, orgId?: string, projectId?: string) {
    this.client = new OpenAI({
      apiKey,
      defaultHeaders: {
        'OpenAI-Beta': 'assistants=v2',
        ...(orgId ? { 'OpenAI-Organization': orgId } : {}),
        ...(projectId ? { 'OpenAI-Project': projectId } : {}),
      },
    });
    this.orgId = orgId;
    this.projectId = projectId;
  }

  /**
   * Lista todos os assistants (com paginação)
   */
  async listAllAssistants(): Promise<AssistantSnapshot[]> {
    const assistants: AssistantSnapshot[] = [];
    let after: string | undefined = undefined;

    while (true) {
      const response = await this.client.beta.assistants.list({
        limit: 100,
        after,
      });

      assistants.push(...response.data.map(this.mapToSnapshot));

      if (!response.has_more) break;
      after = response.data[response.data.length - 1]?.id;
      if (!after) break;
    }

    return assistants;
  }

  /**
   * Recupera um assistant específico
   */
  async getAssistant(assistantId: string): Promise<AssistantSnapshot> {
    const assistant = await this.client.beta.assistants.retrieve(assistantId);
    return this.mapToSnapshot(assistant);
  }

  /**
   * Cria um novo assistant
   */
  async createAssistant(snapshot: Omit<AssistantSnapshot, 'id'>): Promise<AssistantSnapshot> {
    const assistant = await this.client.beta.assistants.create({
      name: snapshot.name,
      description: snapshot.description,
      instructions: snapshot.instructions,
      model: snapshot.model,
      tools: snapshot.tools as any,
      temperature: snapshot.temperature,
      top_p: snapshot.top_p,
      response_format: snapshot.response_format as any,
      metadata: snapshot.metadata,
    });

    return this.mapToSnapshot(assistant);
  }

  /**
   * Atualiza um assistant existente
   */
  async updateAssistant(assistantId: string, snapshot: Partial<AssistantSnapshot>): Promise<AssistantSnapshot> {
    const assistant = await this.client.beta.assistants.update(assistantId, {
      name: snapshot.name,
      description: snapshot.description,
      instructions: snapshot.instructions,
      model: snapshot.model,
      tools: snapshot.tools as any,
      temperature: snapshot.temperature,
      top_p: snapshot.top_p,
      response_format: snapshot.response_format as any,
      tool_resources: snapshot.tool_resources as any,
      metadata: snapshot.metadata,
    });

    return this.mapToSnapshot(assistant);
  }

  /**
   * Procura assistant por metadata
   */
  async findByMetadata(key: string, value: string): Promise<AssistantSnapshot | null> {
    const assistants = await this.listAllAssistants();
    return assistants.find(a => a.metadata?.[key] === value) || null;
  }

  /**
   * Lista arquivos de um vector store
   */
  async listVectorStoreFiles(vectorStoreId: string): Promise<VectorStoreFile[]> {
    const files: VectorStoreFile[] = [];
    let after: string | undefined = undefined;

    while (true) {
      const response = await this.client.beta.vectorStores.files.list(vectorStoreId, {
        limit: 100,
        after,
      });

      files.push(...response.data as any);

      if (!response.has_more) break;
      after = response.data[response.data.length - 1]?.id;
      if (!after) break;
    }

    return files;
  }

  /**
   * Recupera informações de um arquivo
   */
  async getFile(fileId: string): Promise<FileObject> {
    const file = await this.client.files.retrieve(fileId);
    return file as FileObject;
  }

  /**
   * Baixa o conteúdo de um arquivo
   */
  async downloadFileContent(fileId: string): Promise<Buffer> {
    const response = await this.client.files.content(fileId);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Faz upload de um arquivo
   */
  async uploadFile(content: Buffer, filename: string, purpose: 'assistants' = 'assistants'): Promise<FileObject> {
    const file = new File([content], filename);
    const response = await this.client.files.create({
      file,
      purpose,
    });
    return response as FileObject;
  }

  /**
   * Cria um vector store
   */
  async createVectorStore(name: string, fileIds: string[]): Promise<VectorStore> {
    const vectorStore = await this.client.beta.vectorStores.create({
      name,
      file_ids: fileIds,
    });
    return vectorStore as VectorStore;
  }

  /**
   * Recupera um vector store
   */
  async getVectorStore(vectorStoreId: string): Promise<VectorStore> {
    const vectorStore = await this.client.beta.vectorStores.retrieve(vectorStoreId);
    return vectorStore as VectorStore;
  }

  /**
   * Mapeia Assistant da API para AssistantSnapshot
   */
  private mapToSnapshot(assistant: any): AssistantSnapshot {
    return {
      id: assistant.id,
      name: assistant.name,
      description: assistant.description,
      instructions: assistant.instructions,
      model: assistant.model,
      temperature: assistant.temperature,
      top_p: assistant.top_p,
      response_format: assistant.response_format,
      tools: assistant.tools,
      tool_resources: assistant.tool_resources,
      metadata: assistant.metadata,
    };
  }
}
