# File Search e Code Interpreter

## Visão Geral

Quando um Assistant usa **File Search** ou **Code Interpreter**, você precisa recriar os recursos no projeto de destino, pois os IDs de arquivos e vector stores não são transferíveis entre projetos.

## Clonando File Search

### Limitações

- L Você **não pode reutilizar** `file_id` ou `vector_store_id` do projeto de origem
-  Precisa **recriar** todos os recursos no destino
- =Ê **1 vector store por assistant**
- =Ê **10.000 arquivos por vector store**
- =Ê Limites de tamanho e storage aplicam-se

### Processo de Clonagem

#### A) Baixar Conteúdo de um Arquivo da Origem

```bash
curl "https://api.openai.com/v1/files/$FILE_ID/content" \
  -H "Authorization: Bearer $SRC_KEY" \
  --output "arquivo.bin"
```

#### B) Subir o Arquivo no Destino

Isso gera um **NOVO file_id**:

```bash
curl "https://api.openai.com/v1/files" \
  -H "Authorization: Bearer $DST_KEY" \
  -F "purpose=assistants" \
  -F "file=@arquivo.bin"
```

#### C) Criar Vector Store no Destino

Crie um vector store e anexe os novos file_ids:

```bash
curl "https://api.openai.com/v1/vector_stores" \
  -H "Authorization: Bearer $DST_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clone Vector Store",
    "file_ids": ["file_xxx", "file_yyy"]
  }'
```

#### D) Atualizar o Assistant do Destino

Apontando para o novo vector store:

```bash
curl "https://api.openai.com/v1/assistants/$ASST_ID" \
  -H "Authorization: Bearer $DST_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_resources": {
      "file_search": {
        "vector_store_ids": ["vs_xxx"]
      }
    }
  }'
```

### Fluxo Completo para File Search

```javascript
async function cloneFileSearch(srcKey, dstKey, assistantId) {
  // 1. Descobrir vector stores do assistant de origem
  const srcAssistant = await getAssistant(srcKey, assistantId);
  const vsIds = srcAssistant.tool_resources?.file_search?.vector_store_ids || [];

  const newVectorStoreIds = [];

  for (const vsId of vsIds) {
    // 2. Listar arquivos do vector store
    const files = await listVectorStoreFiles(srcKey, vsId);

    const newFileIds = [];

    for (const file of files) {
      // 3. Baixar conteúdo do arquivo
      const content = await downloadFile(srcKey, file.id);

      // 4. Fazer upload no destino
      const newFile = await uploadFile(dstKey, content, file.filename);
      newFileIds.push(newFile.id);
    }

    // 5. Criar vector store no destino
    const newVs = await createVectorStore(dstKey, {
      name: `Clone of ${vsId}`,
      file_ids: newFileIds
    });

    newVectorStoreIds.push(newVs.id);
  }

  // 6. Atualizar assistant no destino
  await updateAssistant(dstKey, newAssistantId, {
    tool_resources: {
      file_search: {
        vector_store_ids: newVectorStoreIds
      }
    }
  });
}
```

## Clonando Code Interpreter

### Processo de Clonagem

Se o assistant tiver **Code Interpreter** e houver arquivos anexados:

1. **Listar arquivos** anexados ao assistant de origem
2. **Baixar** cada arquivo
3. **Re-upar** no projeto de destino
4. **Associar** os novos file_ids ao assistant do destino

### Exemplo de Código

```javascript
async function cloneCodeInterpreter(srcKey, dstKey, assistantId) {
  // 1. Obter assistant de origem
  const srcAssistant = await getAssistant(srcKey, assistantId);
  const fileIds = srcAssistant.tool_resources?.code_interpreter?.file_ids || [];

  const newFileIds = [];

  for (const fileId of fileIds) {
    // 2. Baixar arquivo
    const content = await downloadFile(srcKey, fileId);
    const fileInfo = await getFileInfo(srcKey, fileId);

    // 3. Upload no destino
    const newFile = await uploadFile(dstKey, content, fileInfo.filename);
    newFileIds.push(newFile.id);
  }

  // 4. Atualizar assistant no destino
  await updateAssistant(dstKey, newAssistantId, {
    tool_resources: {
      code_interpreter: {
        file_ids: newFileIds
      }
    }
  });
}
```

## Considerações Importantes

### Custos e Limites

- =° Storage de arquivos e vector stores tem custos associados
- =° Processar arquivos para vector search tem custo
- ñ Criação de vector stores pode demorar (processamento assíncrono)
- =Ê Respeite os limites de tamanho por arquivo e total de storage

### Ordem de Operação

**Ordem correta para clonagem completa:**

1.  Criar o Assistant no destino (sem tool_resources ainda)
2.  Baixar e re-upar arquivos
3.  Criar vector stores com os novos file_ids
4.  Atualizar o Assistant para apontar para os novos recursos

### Tratamento de Erros

-   Arquivos podem falhar no upload (tamanho, formato)
-   Vector store pode falhar ao processar arquivos
-   Implementar retry logic para operações assíncronas
-   Validar status de processamento antes de associar ao assistant

## Feature Flags Recomendadas

No seu `.env`:

```bash
# Habilitar clonagem de File Search
INCLUDE_FILE_SEARCH="false"

# Habilitar clonagem de Code Interpreter
INCLUDE_CODE_INTERPRETER="false"
```

**Por quê?**
- Operações custosas (tempo e $)
- Nem sempre necessário
- Permite clonagem incremental

## Referências

- [API Reference - Files](https://platform.openai.com/docs/api-reference/files?utm_source=chatgpt.com)
- [API Reference - Vector Stores](https://platform.openai.com/docs/api-reference/vector-stores?utm_source=chatgpt.com)
- [Assistants File Search](https://platform.openai.com/docs/assistants/tools/file-search?utm_source=chatgpt.com)
