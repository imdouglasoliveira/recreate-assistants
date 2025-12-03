Sim — **dá para “clonar”/replicar** seus Assistants de uma Organization para outra, **mas não existe um “transferir” direto**: *assistants, threads, files e vector stores são recursos “scoped” ao projeto e não podem ser movidos entre projetos* (e, na prática, entre orgs também, porque cada org tem seus projetos). ([OpenAI Help Center][1])

O caminho é:

1. **Ler** a definição do Assistant na org/projeto de origem (API: listar + recuperar).
2. **Criar** um novo Assistant na org/projeto de destino com os mesmos campos.
3. Se usar **File Search / Code Interpreter**, **recriar os recursos** (re-upar arquivos e recriar vector stores) e só então **reatribuir** ao novo assistant. ([OpenAI Platform][2])

> Observação importante: a Assistants API está **deprecada** em favor da **Responses API** e tem data de descontinuação (shut down) publicada; então, se você estiver começando algo novo, pode valer migrar/replicar já no modelo novo. ([OpenAI Platform][3])

---

## O que você precisa para fazer isso via API

* **Uma API key do projeto de origem** e **uma API key do projeto de destino** (normalmente você cria uma em cada projeto/org).
* Nas chamadas da Assistants API, inclua o header **`OpenAI-Beta: assistants=v2`** (a própria referência do endpoint mostra isso). ([OpenAI Platform][4])
* Se você pertence a múltiplas orgs, existe header para **selecionar a org** em requests (útil em alguns cenários), mas na prática **keys de projeto** costumam ser o jeito mais simples/limpo de separar origem e destino. ([OpenAI Platform][5])

---

## Exemplo rápido (cURL): listar → pegar detalhes → criar no destino

### 1) Listar assistants na origem

```bash
curl "https://api.openai.com/v1/assistants?limit=100" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

([OpenAI Platform][4])

### 2) Recuperar um assistant específico (detalhado)

```bash
curl "https://api.openai.com/v1/assistants/$ASST_ID" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

([OpenAI Platform][4])

### 3) Criar um assistant “igual” no destino

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

([OpenAI Platform][4])

---

## Se o assistant usa File Search (vector store): como clonar os arquivos

Você **não pode reutilizar** `file_id`/`vector_store_id` do projeto de origem no destino. Precisa recriar:

### A) Baixar conteúdo de um arquivo da origem

```bash
curl "https://api.openai.com/v1/files/$FILE_ID/content" \
  -H "Authorization: Bearer $SRC_KEY" \
  --output "arquivo.bin"
```

([OpenAI Platform][6])

### B) Subir esse arquivo no destino (gera NOVO file_id)

```bash
curl "https://api.openai.com/v1/files" \
  -H "Authorization: Bearer $DST_KEY" \
  -F "purpose=assistants" \
  -F "file=@arquivo.bin"
```

([OpenAI Platform][6])

### C) Criar um vector store no destino e anexar os file_ids novos

(Endpoints de vector stores / batches estão no reference)
([OpenAI Platform][7])

### D) Atualizar o assistant do destino para apontar para o NOVO vector store

(Você faz um “modify assistant” informando `tool_resources.file_search.vector_store_ids`.)

---

## Script pronto (Node.js) para clonar “a definição” dos assistants

Esse script copia **nome/instructions/model/tools/metadados**. (Para file_search/code_interpreter, você complementa com a parte de reupload/vector store.)

```js
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

Endpoints/headers usados acima estão na referência da Assistants API (inclui `OpenAI-Beta: assistants=v2`). ([OpenAI Platform][4])

---

Se você me disser **se seus assistants usam File Search / Code Interpreter e se você quer clonar também os arquivos/vector stores**, eu já te devolvo a versão do script com: listar vector stores → listar arquivos do store → baixar content → reupload → criar store no destino → atualizar assistant.

[1]: https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects "Managing projects in the API platform | OpenAI Help Center"
[2]: https://platform.openai.com/docs/assistants/tools/file-search?utm_source=chatgpt.com "Assistants File Search - OpenAI API"
[3]: https://platform.openai.com/docs/assistants/migration?utm_source=chatgpt.com "Assistants migration guide - OpenAI API"
[4]: https://platform.openai.com/docs/api-reference/assistants?utm_source=chatgpt.com "API Reference"
[5]: https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization?utm_source=chatgpt.com "Production best practices - OpenAI API"
[6]: https://platform.openai.com/docs/api-reference/files?utm_source=chatgpt.com "API Reference - OpenAI API"
[7]: https://platform.openai.com/docs/api-reference/vector-stores?utm_source=chatgpt.com "API Reference"


A seguir está um **PRD + ADR** (no formato “documento de produto/arquitetura”) para uma aplicação que **replica Assistants entre Organizations/Projects** na mesma conta OpenAI, **incluindo Functions**, e (opcionalmente) **File Search / Code Interpreter**.

> Nota de contexto importante: a **Assistants API v2** está em caminho de **migração/depreciação**, com alvo de sunset **no 1º semestre de 2026**; a OpenAI recomenda a **Responses API** como caminho novo. Ainda assim, dá para clonar via Assistants v2 hoje e desenhar o projeto com um “adapter” pra migrar depois. ([OpenAI Help Center][1])

---

# PRD — Replicador de Assistants entre Organizations/Projects

## 1) Objetivo

Construir uma aplicação (CLI e/ou serviço) que:

* Lê todos (ou um subconjunto) dos **Assistants** de um **projeto/origem**;
* Cria (ou atualiza) Assistants equivalentes em um **projeto/destino** em **outra Organization**;
* Replica integralmente as configurações do Assistant:

  * **name, description, instructions**
  * **model**
  * **temperature, top_p**
  * **response_format**
  * **tools**, incluindo **Functions** (tool `type:function`) com `name`, `description` e `parameters` (JSON Schema) ([OpenAI Platform][2])
* (Opcional) Replica também recursos de ferramentas hospedadas:

  * **File Search** (vector stores + arquivos)
  * **Code Interpreter** (arquivos anexados, quando houver)

## 2) Motivação / Problema

* No Playground existe “Clone”, mas isso tende a ser **dentro do mesmo contexto** (mesma org/projeto). Você quer um **clone cross-org** com automação e repetível (CI/CD / IaC).
* Cenário típico: migrar/espelhar ambientes (dev → prod), ou duplicar um conjunto de Assistants entre unidades (org A → org B).

## 3) Stakeholders

* Você (dev/owner), time de automação, operações.

## 4) Escopo

### In-scope

* Clone de Assistants via API.
* Clone do **catálogo de Functions** vinculadas ao Assistant.
* Modo **dry-run**.
* “Update if exists” (idempotência via `metadata.cloned_from`).
* Export/Import em JSON (snapshot).

### Out-of-scope (neste PRD)

* Migrar threads, mensagens, runs históricos.
* Sincronização contínua em tempo real (pode virar fase 2).
* Garantir que as Functions “funcionem” sem você portar o backend que executa as chamadas (a OpenAI **não executa** suas funções; ela só sugere a chamada). ([OpenAI Help Center][1])

## 5) Requisitos Funcionais (FR)

**FR1 — Listar assistants da origem**

* Buscar todos os Assistants (paginação, se necessário).

**FR2 — Clonar definição do assistant**

* Para cada assistant selecionado, recuperar detalhes completos e criar no destino mantendo:

  * `name`, `description`, `instructions`, `model`
  * `tools` (incluindo `type:function` e schema)
  * `temperature`, `top_p`, `response_format`
  * `metadata` (acrescentar `cloned_from`, `src_project`, `src_org`, timestamp)

**FR3 — Idempotência**

* Se já existir no destino um assistant com `metadata.cloned_from == <src_assistant_id>`, fazer **update** ao invés de criar novo.

**FR4 — Clonar File Search (opcional, feature flag)**

* Se o assistant tiver File Search habilitado (`tools` inclui `file_search`), recriar no destino:

  * Criar **vector store** no destino e adicionar arquivos.
  * Anexar o vector store ao assistant destino em `tool_resources`.
* Respeitar limitações conhecidas:

  * 1 vector store por assistant; 10k arquivos por vector store; limites de tamanho/storage. ([OpenAI Help Center][1])

**FR5 — Clonar Code Interpreter (opcional, feature flag)**

* Se o assistant tiver Code Interpreter e houver arquivos anexados, re-upar no destino e associar conforme a API suportar.

**FR6 — Relatório final**

* Gerar um arquivo `mapping.json` com:

  * `src_assistant_id → dst_assistant_id`
  * status, erros, timestamps

## 6) Requisitos Não-Funcionais (NFR)

* **Segurança**: chaves só por ENV/secret manager; jamais logar keys.
* **Observabilidade**: logs estruturados + modo verbose.
* **Resiliência**: retries com backoff para 429/5xx.
* **Rate limiting**: respeitar limites de Assistants API (GET/POST/DELETE possuem RPM padrões). ([OpenAI Help Center][1])

## 7) Premissas / Restrições (importantes)

1. **Recursos não são “transferíveis” entre projetos**: IDs de arquivos/vector stores não “existem” no destino; precisa recriar.
2. **Functions** no Playground são *definições* (schema) — executar o call é responsabilidade do seu app. ([OpenAI Help Center][1])
3. Para clonar entre **Organizations diferentes**, você precisa de credenciais com acesso em **ambas** (idealmente **project API keys** de cada projeto, uma por org). A API também suporta headers para escolher org/projeto quando aplicável (`OpenAI-Organization` / `OpenAI-Project`). ([OpenAI Platform][3])

---

# ADR — Decisões de Arquitetura

## ADR-001 — API-alvo: Assistants v2 agora, com “adapter” p/ Responses depois

**Decisão**
Implementar a clonagem usando **Assistants API v2** (para reproduzir exatamente o que você configurou no Playground hoje), mas isolar chamadas em um módulo `openaiProvider` para futura migração.

**Justificativa**

* Você quer clonar “como está” (incluindo configuração do Assistant).
* Mas existe roadmap de migração para Responses API e sunset da Assistants API v2 (1H 2026). ([OpenAI Help Center][1])

**Consequência**

* Código terá camadas:

  * `domain/` (modelo de AssistantSnapshot)
  * `providers/openai_assistants_v2/` (calls)
  * `providers/openai_responses/` (placeholder futuro)

## ADR-002 — Idempotência via metadata

**Decisão**
Adicionar `metadata.cloned_from = <src_assistant_id>` no assistant do destino e usar isso como chave.

**Consequência**

* Permite reexecutar o clone sem duplicar.
* Facilita “sync” incremental (fase 2).

---

# Instruções claras de como fazer (passo a passo)

## Passo 0 — Preparar acessos

1. Na **Org de origem**, crie/seleciona um **Project** que contenha seus Assistants.
2. Na **Org de destino**, crie um **Project** para receber os clones.
3. Gere:

   * `SRC_PROJECT_API_KEY`
   * `DST_PROJECT_API_KEY`

> Alternativa: usar uma “user API key” + headers `OpenAI-Organization` e `OpenAI-Project` para direcionar cobrança/escopo quando necessário. ([OpenAI Platform][3])

## Passo 1 — Definir variáveis de ambiente (ENV)

Crie um `.env` (ou configure no seu secret manager) assim:

```bash
# Obrigatórias
OPENAI_SRC_API_KEY="..."
OPENAI_DST_API_KEY="..."

# Opcionais (úteis se você usa user-key ou precisa forçar roteamento)
OPENAI_SRC_ORG_ID="org_..."
OPENAI_DST_ORG_ID="org_..."
OPENAI_SRC_PROJECT_ID="proj_..."
OPENAI_DST_PROJECT_ID="proj_..."

# Execução
CLONE_MODE="all"                # all | by_id | by_name
CLONE_IDS="asst_x,asst_y"       # quando CLONE_MODE=by_id
CLONE_NAME_PREFIX=""            # ex: "PROD - " (opcional)
DRY_RUN="false"
INCLUDE_FILE_SEARCH="false"     # true para clonar vector stores
INCLUDE_CODE_INTERPRETER="false"
MAX_CONCURRENCY="3"
LOG_LEVEL="info"                # debug|info|warn|error
OUTPUT_DIR="./out"
```

Headers suportados para direcionar org/projeto em requests aparecem em exemplos oficiais (`OpenAI-Organization` e `OpenAI-Project`) e a documentação menciona contabilização por org/projeto. ([OpenAI Platform][3])

## Passo 2 — Fluxo de clonagem (algoritmo)

Para cada assistant selecionado:

### 2.1) Extrair snapshot do assistant (origem)

* `list assistants`
* `retrieve assistant` → construir `AssistantSnapshot`:

```ts
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
  tool_resources?: any   // file_search / code_interpreter quando aplicável
  metadata?: Record<string, string>
}
```

As tools de função são definidas com JSON Schema (`parameters`) e são parte da configuração do assistant/tooling. ([OpenAI Platform][2])

### 2.2) Aplicar no destino

* Procurar se já existe `metadata.cloned_from == snapshot.id`

  * Se sim: `update assistant`
  * Se não: `create assistant`

### 2.3) (Opcional) Clonar File Search

Se `INCLUDE_FILE_SEARCH=true` e o snapshot indicar File Search:

1. Descobrir vector store(s) associados
2. Para cada arquivo do VS na origem:

   * baixar conteúdo
   * upar no destino
3. Criar vector store no destino e anexar arquivos
4. Atualizar assistant destino apontando `tool_resources.file_search.vector_store_ids=[novo_vs_id]`

File Search usa **Vector Store** e tem limites (1 VS por assistant etc.). ([OpenAI Platform][4])

### 2.4) (Opcional) Clonar Code Interpreter

Se `INCLUDE_CODE_INTERPRETER=true`:

* Re-upar arquivos anexados (quando existirem) e associar no assistant do destino.

> Importante: custos/limites e troubleshooting de erros e quota/headers aparecem na documentação/FAQ e guias de error codes. ([OpenAI Help Center][1])

## Passo 3 — Validação / Aceite

Para cada assistant clonado:

* Comparar (origem vs destino):

  * model, instructions hash, tools (especialmente functions), response_format, temperature/top_p
* Produzir `out/mapping.json` e `out/report.md`

---

# Especificação do Produto (o que o Claude Code deve implementar)

## CLI Commands

1. `clone-assistants plan`

* Mostra o que seria criado/atualizado (dry-run implícito)

2. `clone-assistants apply`

* Executa clonagem

3. `clone-assistants export`

* Exporta snapshots para JSON (IaC)

4. `clone-assistants import`

* Importa snapshots num destino (sem depender da origem)

## Critérios de aceite

* Clonar um assistant com 3 functions (ex.: `Verificar_Pedidos`, `Criar_ou_atualizar`, `Verificar_Cliente_Dados`) preserva:

  * nomes, descrições, schemas (`parameters`) e ordem/estrutura.
* Reexecução não cria duplicados (idempotência via metadata).
* Suporta seleção por ID e por nome.

---

# Riscos e mitigação

* **429 / rate limit**: implementar fila e `MAX_CONCURRENCY`, retry com backoff. A FAQ traz limites RPM por método no Assistants API. ([OpenAI Help Center][1])
* **Erros de org/projeto**: orientar uso correto de headers/chaves e mensagens claras (docs reforçam checar org/project no header em caso de erro). ([OpenAI Platform][5])
* **Assistants API sunset**: colocar “adapter” p/ migração para Responses API (ADR-001). ([OpenAI Help Center][1])

---

# Checklist de entrega (Definition of Done)

* [ ] `.env.example` com todas variáveis
* [ ] CLI funcionando: `plan/apply/export/import`
* [ ] `mapping.json` + `report.md`
* [ ] Logs estruturados
* [ ] Idempotência via `metadata.cloned_from`
* [ ] Feature flags para File Search / Code Interpreter
* [ ] Documentação rápida “Como rodar”

---

Se você quiser, eu também já te passo um **esqueleto de repositório** (tree + scripts NPM + types TS + interfaces) alinhado com esse PRD/ADR — pronto pro Claude Code preencher — mas o documento acima já é o “contrato” completo do que construir.

[1]: https://help.openai.com/en/articles/8550641-assistants-api-v2-faq "Assistants API (v2) FAQ | OpenAI Help Center"
[2]: https://platform.openai.com/docs/assistants/tools/function-calling?utm_source=chatgpt.com "Assistants Function Calling - OpenAI API"
[3]: https://platform.openai.com/docs/api-reference/certificates/object?utm_cta=website-workload-data-warehouse-cross-cloud&utm_source=chatgpt.com "API Reference"
[4]: https://platform.openai.com/docs/assistants/tools/file-search?utm_source=chatgpt.com "Assistants File Search - OpenAI API"
[5]: https://platform.openai.com/docs/guides/error-codes?utm_source=chatgpt.com "Error codes - OpenAI API"
