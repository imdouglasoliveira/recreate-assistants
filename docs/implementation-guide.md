# Guia de Implementação - Replicador de Assistants

## Passo 0 — Preparar Acessos

### 1. Configurar Projects nas Organizations

**Org de origem:**
1. Crie/selecione um **Project** que contenha seus Assistants
2. Anote o ID: `proj_xxx`

**Org de destino:**
1. Crie um **Project** para receber os clones
2. Anote o ID: `proj_yyy`

### 2. Gerar API Keys

Gere as seguintes chaves:
- `SRC_PROJECT_API_KEY` (origem)
- `DST_PROJECT_API_KEY` (destino)

**Alternativa:** usar uma "user API key" + headers `OpenAI-Organization` e `OpenAI-Project` para direcionar cobrança/escopo.

**Referências:**
- [API Reference - Certificates](https://platform.openai.com/docs/api-reference/certificates/object?utm_cta=website-workload-data-warehouse-cross-cloud&utm_source=chatgpt.com)

---

## Passo 1 — Definir Variáveis de Ambiente

Crie um `.env` (ou configure no seu secret manager):

```bash
# ============================================
# OBRIGATÓRIAS
# ============================================
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."

# ============================================
# OPCIONAIS (úteis se você usa user-key)
# ============================================
OPENAI_SRC_ORG_ID="org_..."
OPENAI_DST_ORG_ID="org_..."
OPENAI_SRC_PROJECT_ID="proj_..."
OPENAI_DST_PROJECT_ID="proj_..."

# ============================================
# EXECUÇÃO
# ============================================

# Modo de clonagem
# - "all": clona todos os assistants
# - "by_id": clona apenas IDs especificados
# - "by_name": clona assistants com nome contendo prefixo
CLONE_MODE="all"

# IDs específicos (quando CLONE_MODE=by_id)
CLONE_IDS="asst_abc123,asst_def456"

# Prefixo de nome (opcional)
# Ex: "PROD - " adiciona esse prefixo aos nomes no destino
CLONE_NAME_PREFIX=""

# Dry-run (não executa, apenas mostra o que seria feito)
DRY_RUN="false"

# ============================================
# FEATURES OPCIONAIS
# ============================================

# Clonar vector stores e arquivos do File Search
INCLUDE_FILE_SEARCH="false"

# Clonar arquivos do Code Interpreter
INCLUDE_CODE_INTERPRETER="false"

# ============================================
# PERFORMANCE E LOGS
# ============================================

# Máximo de operações paralelas
MAX_CONCURRENCY="3"

# Nível de log: debug | info | warn | error
LOG_LEVEL="info"

# Diretório de saída para relatórios
OUTPUT_DIR="./out"
```

**Headers suportados:**
- `OpenAI-Organization`: direciona para uma org específica
- `OpenAI-Project`: direciona para um projeto específico

**Referências:**
- [Production best practices](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization?utm_source=chatgpt.com)

---

## Passo 2 — Fluxo de Clonagem (Algoritmo)

### Visão Geral

Para cada assistant selecionado:

```
1. Extrair snapshot (origem)
2. Verificar se já existe no destino
3. Criar/atualizar no destino
4. (Opcional) Clonar File Search
5. (Opcional) Clonar Code Interpreter
6. Gerar relatório
```

### 2.1) Extrair Snapshot do Assistant (Origem)

```javascript
async function extractSnapshot(srcKey, assistantId) {
  // 1. Listar assistants
  const list = await listAssistants(srcKey);

  // 2. Retrieve assistant detalhado
  const assistant = await getAssistant(srcKey, assistantId);

  // 3. Construir snapshot
  return {
    id: assistant.id,
    name: assistant.name,
    description: assistant.description,
    instructions: assistant.instructions,
    model: assistant.model,
    temperature: assistant.temperature,
    top_p: assistant.top_p,
    response_format: assistant.response_format,
    tools: assistant.tools,  // inclui Functions com JSON Schema
    tool_resources: assistant.tool_resources,
    metadata: assistant.metadata
  };
}
```

**Tipo de Dados:**

```typescript
type AssistantSnapshot = {
  id: string
  name: string
  description?: string
  instructions: string
  model: string
  temperature?: number
  top_p?: number
  response_format?: any
  tools: any[]           // inclui type:function com JSON schema
  tool_resources?: any   // file_search / code_interpreter
  metadata?: Record<string, string>
}
```

### 2.2) Aplicar no Destino

```javascript
async function applySnapshot(dstKey, snapshot, srcAssistantId) {
  // 1. Procurar se já existe
  const existing = await findByMetadata(
    dstKey,
    'cloned_from',
    srcAssistantId
  );

  if (existing) {
    // Update
    return await updateAssistant(dstKey, existing.id, {
      name: snapshot.name,
      description: snapshot.description,
      instructions: snapshot.instructions,
      model: snapshot.model,
      temperature: snapshot.temperature,
      top_p: snapshot.top_p,
      response_format: snapshot.response_format,
      tools: snapshot.tools,
      metadata: {
        ...snapshot.metadata,
        cloned_from: srcAssistantId,
        last_cloned_at: new Date().toISOString()
      }
    });
  } else {
    // Create
    return await createAssistant(dstKey, {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        cloned_from: srcAssistantId,
        cloned_at: new Date().toISOString()
      }
    });
  }
}
```

### 2.3) (Opcional) Clonar File Search

Se `INCLUDE_FILE_SEARCH=true` e o snapshot indicar File Search:

```javascript
async function cloneFileSearch(srcKey, dstKey, srcAssistant, dstAssistant) {
  const vsIds = srcAssistant.tool_resources?.file_search?.vector_store_ids || [];

  const newVectorStoreIds = [];

  for (const vsId of vsIds) {
    // 1. Listar arquivos do vector store
    const files = await listVectorStoreFiles(srcKey, vsId);

    const newFileIds = [];

    for (const file of files) {
      // 2. Baixar conteúdo
      const content = await downloadFileContent(srcKey, file.id);
      const fileInfo = await getFile(srcKey, file.id);

      // 3. Upload no destino
      const newFile = await uploadFile(dstKey, {
        file: content,
        purpose: 'assistants',
        filename: fileInfo.filename
      });

      newFileIds.push(newFile.id);
    }

    // 4. Criar vector store no destino
    const newVs = await createVectorStore(dstKey, {
      name: `Clone of ${vsId}`,
      file_ids: newFileIds
    });

    newVectorStoreIds.push(newVs.id);
  }

  // 5. Atualizar assistant
  await updateAssistant(dstKey, dstAssistant.id, {
    tool_resources: {
      file_search: {
        vector_store_ids: newVectorStoreIds
      }
    }
  });
}
```

**Importante:**
- File Search usa **Vector Store**
- Limites: 1 VS por assistant, 10k arquivos por VS

**Referências:**
- [Assistants File Search](https://platform.openai.com/docs/assistants/tools/file-search?utm_source=chatgpt.com)

### 2.4) (Opcional) Clonar Code Interpreter

Se `INCLUDE_CODE_INTERPRETER=true`:

```javascript
async function cloneCodeInterpreter(srcKey, dstKey, srcAssistant, dstAssistant) {
  const fileIds = srcAssistant.tool_resources?.code_interpreter?.file_ids || [];

  const newFileIds = [];

  for (const fileId of fileIds) {
    // 1. Baixar arquivo
    const content = await downloadFileContent(srcKey, fileId);
    const fileInfo = await getFile(srcKey, fileId);

    // 2. Upload no destino
    const newFile = await uploadFile(dstKey, {
      file: content,
      purpose: 'assistants',
      filename: fileInfo.filename
    });

    newFileIds.push(newFile.id);
  }

  // 3. Atualizar assistant
  await updateAssistant(dstKey, dstAssistant.id, {
    tool_resources: {
      code_interpreter: {
        file_ids: newFileIds
      }
    }
  });
}
```

---

## Passo 3 — Validação / Aceite

Para cada assistant clonado:

### Comparação Origem vs Destino

```javascript
async function validateClone(srcKey, dstKey, srcId, dstId) {
  const src = await getAssistant(srcKey, srcId);
  const dst = await getAssistant(dstKey, dstId);

  const checks = {
    model: src.model === dst.model,
    instructions: hashString(src.instructions) === hashString(dst.instructions),
    tools: JSON.stringify(src.tools) === JSON.stringify(dst.tools),
    temperature: src.temperature === dst.temperature,
    top_p: src.top_p === dst.top_p,
    response_format: JSON.stringify(src.response_format) === JSON.stringify(dst.response_format)
  };

  return {
    srcId,
    dstId,
    checks,
    allPassed: Object.values(checks).every(v => v)
  };
}
```

### Gerar Relatórios

**`out/mapping.json`:**

```json
{
  "cloned_at": "2024-12-03T10:30:00Z",
  "source": {
    "org_id": "org_xxx",
    "project_id": "proj_xxx"
  },
  "destination": {
    "org_id": "org_yyy",
    "project_id": "proj_yyy"
  },
  "mappings": [
    {
      "src_id": "asst_abc123",
      "dst_id": "asst_xyz789",
      "name": "Customer Support Assistant",
      "status": "success",
      "operations": {
        "assistant": "created",
        "file_search": "cloned",
        "code_interpreter": "skipped"
      }
    }
  ],
  "summary": {
    "total": 5,
    "success": 4,
    "failed": 1
  }
}
```

**`out/report.md`:**

```markdown
# Clone Report

**Date:** 2024-12-03 10:30:00
**Source:** org_xxx / proj_xxx
**Destination:** org_yyy / proj_yyy

## Summary

- ✅ Total: 5 assistants
- ✅ Success: 4
- ❌ Failed: 1

## Details

### ✅ Customer Support Assistant
- **Source ID:** asst_abc123
- **Destination ID:** asst_xyz789
- **Operation:** Created
- **File Search:** Cloned (2 files, 1 vector store)
- **Functions:** 3 functions cloned

### ❌ Sales Assistant
- **Source ID:** asst_def456
- **Error:** Rate limit exceeded (429)
- **Retry:** Recommended

...
```

---

## Passo 4 — Executar

### Comando Plan (Dry-run)

```bash
DRY_RUN=true npm run clone:plan
```

**Saída esperada:**
- Lista de assistants que serão clonados
- Operação para cada um (create/update)
- Recursos adicionais (files, vector stores)
- Estimativa de custos

### Comando Apply

```bash
npm run clone:apply
```

**Saída esperada:**
- Progresso em tempo real
- Logs estruturados
- Relatório final em `out/`

---

## Estrutura de Arquivos Recomendada

```
clone-assistants/
├── .env.example
├── .env
├── src/
│   ├── domain/
│   │   └── AssistantSnapshot.ts
│   ├── providers/
│   │   └── openai/
│   │       ├── assistants.ts
│   │       ├── files.ts
│   │       └── vectorStores.ts
│   ├── services/
│   │   ├── cloner.ts
│   │   ├── validator.ts
│   │   └── reporter.ts
│   ├── cli/
│   │   ├── plan.ts
│   │   ├── apply.ts
│   │   ├── export.ts
│   │   └── import.ts
│   └── index.ts
├── out/
│   ├── mapping.json
│   └── report.md
└── package.json
```

---

## Tratamento de Erros

### Rate Limiting (429)

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // exponential backoff
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### Validação de Headers

```javascript
function validateConfig(env) {
  if (!env.OPENAI_SRC_API_KEY || !env.OPENAI_DST_API_KEY) {
    throw new Error('Missing required API keys');
  }

  // Verificar formato das keys
  if (!env.OPENAI_SRC_API_KEY.startsWith('sk-')) {
    throw new Error('Invalid source API key format');
  }
}
```

---

## Segurança

### Boas Práticas

- ✅ Chaves apenas em ENV/secret manager
- ✅ JAMAIS logar keys
- ✅ Usar HTTPS para todas as chamadas
- ✅ Validar entrada do usuário
- ✅ Sanitizar logs (remover dados sensíveis)

### Exemplo de Log Seguro

```javascript
function logSafe(message, data) {
  const safe = { ...data };

  // Remover keys
  delete safe.api_key;
  delete safe.authorization;

  // Mascarar IDs sensíveis
  if (safe.assistant_id) {
    safe.assistant_id = maskId(safe.assistant_id);
  }

  console.log(message, safe);
}

function maskId(id) {
  if (id.length <= 8) return '***';
  return id.substring(0, 4) + '***' + id.substring(id.length - 4);
}
```

---

## Próximos Passos

1. ✅ Configure suas API keys
2. ✅ Execute `clone:plan` para validar
3. ✅ Execute `clone:apply` para clonar
4. ✅ Valide os resultados no destino
5. ✅ Configure CI/CD (opcional)

---

## Referências

- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)
- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants?utm_source=chatgpt.com)
- [Error codes](https://platform.openai.com/docs/guides/error-codes?utm_source=chatgpt.com)
- [Production best practices](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization?utm_source=chatgpt.com)
