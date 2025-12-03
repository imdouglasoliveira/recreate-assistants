# Guia de Clonagem de Assistants

## Visão Geral

Este documento explica como clonar/replicar Assistants entre Organizations/Projects da OpenAI.

## Processo de Clonagem

Para clonar um Assistant, siga estas etapas:

1. **Ler** a definição do Assistant na org/projeto de origem (API: listar + recuperar)
2. **Criar** um novo Assistant na org/projeto de destino com os mesmos campos
3. Se usar **File Search / Code Interpreter**, **recriar os recursos** (re-upar arquivos e recriar vector stores) e reatribuir ao novo assistant

## Endpoints da API

### 1. Listar Assistants na Origem

```bash
curl "https://api.openai.com/v1/assistants?limit=100" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

### 2. Recuperar Assistant Específico

```bash
curl "https://api.openai.com/v1/assistants/$ASST_ID" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

### 3. Criar Assistant no Destino

```bash
curl "https://api.openai.com/v1/assistants" \
  -H "Authorization: Bearer $DST_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clone do Assistant",
    "model": "gpt-4.1-mini",
    "instructions": "Mesmas instruções...",
    "tools": [{"type":"file_search"}],
    "metadata": {"cloned_from":"'"$ASST_ID"'"}
  }'
```

## Script Node.js para Clonagem

Este script copia **nome/instructions/model/tools/metadados**:

```javascript
// node clone-assistants.js
// env: SRC_KEY, DST_KEY

const BASE = "https://api.openai.com/v1";

async function oai(key, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${key}`,
      "OpenAI-Beta": "assistants=v2",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${txt}`);
  }
  return res.json();
}

async function listAllAssistants(key) {
  const out = [];
  let after = undefined;
  while (true) {
    const q = new URLSearchParams({ limit: "100", ...(after ? { after } : {}) });
    const page = await oai(key, `/assistants?${q.toString()}`, { method: "GET" });
    out.push(...(page.data || []));
    if (!page.has_more) break;
    after = out[out.length - 1]?.id;
    if (!after) break;
  }
  return out;
}

async function getAssistant(key, id) {
  return oai(key, `/assistants/${id}`, { method: "GET" });
}

async function createAssistant(key, payload) {
  return oai(key, `/assistants`, { method: "POST", body: JSON.stringify(payload) });
}

(async () => {
  const SRC_KEY = process.env.SRC_KEY;
  const DST_KEY = process.env.DST_KEY;
  if (!SRC_KEY || !DST_KEY) throw new Error("Defina SRC_KEY e DST_KEY no ambiente.");

  const list = await listAllAssistants(SRC_KEY);

  for (const item of list) {
    const full = await getAssistant(SRC_KEY, item.id);

    const payload = {
      name: full.name,
      description: full.description,
      model: full.model,
      instructions: full.instructions,
      tools: full.tools,
      response_format: full.response_format,
      temperature: full.temperature,
      top_p: full.top_p,
      metadata: { ...(full.metadata || {}), cloned_from: full.id },
      // NÃO copie tool_resources diretamente: ids não existem no destino
    };

    const created = await createAssistant(DST_KEY, payload);
    console.log(`OK: ${full.id} -> ${created.id}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## Campos Clonados

O script acima clona os seguintes campos:

- ✅ `name`
- ✅ `description`
- ✅ `model`
- ✅ `instructions`
- ✅ `tools` (incluindo Functions com schemas)
- ✅ `response_format`
- ✅ `temperature`
- ✅ `top_p`
- ✅ `metadata` (com `cloned_from` adicionado)

## O Que NÃO é Clonado Automaticamente

- ❌ `tool_resources` - IDs não existem no destino
- ❌ Arquivos do File Search
- ❌ Vector Stores
- ❌ Arquivos do Code Interpreter

**Para clonar esses recursos, consulte:** [File Search e Code Interpreter](./file-search-code-interpreter.md)

## Idempotência

Para evitar duplicações, use `metadata.cloned_from`:
- Adicione o ID do assistant original em `metadata.cloned_from`
- Verifique se já existe um assistant com esse metadata antes de criar novo
- Se existir, faça **update** ao invés de criar

## Referências

- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants?utm_source=chatgpt.com)
- [Assistants File Search](https://platform.openai.com/docs/assistants/tools/file-search?utm_source=chatgpt.com)
- [Assistants Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling?utm_source=chatgpt.com)
