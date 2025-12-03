# PRD + ADR - Replicador de Assistants entre Organizations/Projects

## Contexto Importante

⚠️ A **Assistants API v2** está em caminho de **migração/depreciação**, com alvo de sunset **no 1º semestre de 2026**. A OpenAI recomenda a **Responses API** como caminho novo.

Ainda assim, é possível clonar via Assistants v2 hoje e desenhar o projeto com um "adapter" para migrar depois.

**Referências:**
- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)

---

# PRD — Replicador de Assistants entre Organizations/Projects

## 1. Objetivo

Construir uma aplicação (CLI e/ou serviço) que:

- Lê todos (ou um subconjunto) dos **Assistants** de um **projeto/origem**
- Cria (ou atualiza) Assistants equivalentes em um **projeto/destino** em **outra Organization**
- Replica integralmente as configurações do Assistant:
  - **name, description, instructions**
  - **model**
  - **temperature, top_p**
  - **response_format**
  - **tools**, incluindo **Functions** (tool `type:function`) com `name`, `description` e `parameters` (JSON Schema)
- (Opcional) Replica também recursos de ferramentas hospedadas:
  - **File Search** (vector stores + arquivos)
  - **Code Interpreter** (arquivos anexados, quando houver)

## 2. Motivação / Problema

- No Playground existe "Clone", mas isso tende a ser **dentro do mesmo contexto** (mesma org/projeto)
- Você quer um **clone cross-org** com automação e repetível (CI/CD / IaC)
- Cenário típico: migrar/espelhar ambientes (dev → prod), ou duplicar um conjunto de Assistants entre unidades (org A → org B)

## 3. Stakeholders

- Você (dev/owner)
- Time de automação
- Operações

## 4. Escopo

### In-scope

- ✅ Clone de Assistants via API
- ✅ Clone do **catálogo de Functions** vinculadas ao Assistant
- ✅ Modo **dry-run**
- ✅ "Update if exists" (idempotência via `metadata.cloned_from`)
- ✅ Export/Import em JSON (snapshot)

### Out-of-scope (neste PRD)

- ❌ Migrar threads, mensagens, runs históricos
- ❌ Sincronização contínua em tempo real (pode virar fase 2)
- ❌ Garantir que as Functions "funcionem" sem você portar o backend que executa as chamadas (a OpenAI **não executa** suas funções; ela só sugere a chamada)

## 5. Requisitos Funcionais (FR)

### FR1 — Listar assistants da origem

Buscar todos os Assistants (paginação, se necessário).

### FR2 — Clonar definição do assistant

Para cada assistant selecionado, recuperar detalhes completos e criar no destino mantendo:

- `name`, `description`, `instructions`, `model`
- `tools` (incluindo `type:function` e schema)
- `temperature`, `top_p`, `response_format`
- `metadata` (acrescentar `cloned_from`, `src_project`, `src_org`, timestamp)

### FR3 — Idempotência

Se já existir no destino um assistant com `metadata.cloned_from == <src_assistant_id>`, fazer **update** ao invés de criar novo.

### FR4 — Clonar File Search (opcional, feature flag)

Se o assistant tiver File Search habilitado (`tools` inclui `file_search`), recriar no destino:

- Criar **vector store** no destino e adicionar arquivos
- Anexar o vector store ao assistant destino em `tool_resources`
- Respeitar limitações conhecidas:
  - 1 vector store por assistant
  - 10k arquivos por vector store
  - Limites de tamanho/storage

### FR5 — Clonar Code Interpreter (opcional, feature flag)

Se o assistant tiver Code Interpreter e houver arquivos anexados, re-upar no destino e associar conforme a API suportar.

### FR6 — Relatório final

Gerar um arquivo `mapping.json` com:

- `src_assistant_id → dst_assistant_id`
- status, erros, timestamps

## 6. Requisitos Não-Funcionais (NFR)

- **Segurança**: chaves só por ENV/secret manager; jamais logar keys
- **Observabilidade**: logs estruturados + modo verbose
- **Resiliência**: retries com backoff para 429/5xx
- **Rate limiting**: respeitar limites de Assistants API (GET/POST/DELETE possuem RPM padrões)

## 7. Premissas / Restrições

1. **Recursos não são "transferíveis" entre projetos**: IDs de arquivos/vector stores não "existem" no destino; precisa recriar
2. **Functions** no Playground são *definições* (schema) — executar o call é responsabilidade do seu app
3. Para clonar entre **Organizations diferentes**, você precisa de credenciais com acesso em **ambas** (idealmente **project API keys** de cada projeto, uma por org). A API também suporta headers para escolher org/projeto quando aplicável (`OpenAI-Organization` / `OpenAI-Project`)

---

# ADR — Decisões de Arquitetura

## ADR-001 — API-alvo: Assistants v2 agora, com "adapter" p/ Responses depois

### Decisão

Implementar a clonagem usando **Assistants API v2** (para reproduzir exatamente o que você configurou no Playground hoje), mas isolar chamadas em um módulo `openaiProvider` para futura migração.

### Justificativa

- Você quer clonar "como está" (incluindo configuração do Assistant)
- Mas existe roadmap de migração para Responses API e sunset da Assistants API v2 (1H 2026)

### Consequência

Código terá camadas:

```
domain/              # modelo de AssistantSnapshot
providers/
  openai_assistants_v2/   # calls atuais
  openai_responses/       # placeholder futuro
```

## ADR-002 — Idempotência via metadata

### Decisão

Adicionar `metadata.cloned_from = <src_assistant_id>` no assistant do destino e usar isso como chave.

### Consequência

- Permite reexecutar o clone sem duplicar
- Facilita "sync" incremental (fase 2)

---

# Riscos e Mitigação

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **429 / rate limit** | Alto | Implementar fila e `MAX_CONCURRENCY`, retry com backoff |
| **Erros de org/projeto** | Médio | Orientar uso correto de headers/chaves e mensagens claras |
| **Assistants API sunset** | Alto | Colocar "adapter" p/ migração para Responses API (ADR-001) |
| **Custos de storage** | Médio | Feature flags para File Search/Code Interpreter opcionais |
| **Falhas no upload de arquivos** | Médio | Retry logic, validação de formato/tamanho |

---

# Checklist de Entrega (Definition of Done)

- [ ] `.env.example` com todas variáveis
- [ ] CLI funcionando: `plan/apply/export/import`
- [ ] `mapping.json` + `report.md`
- [ ] Logs estruturados
- [ ] Idempotência via `metadata.cloned_from`
- [ ] Feature flags para File Search / Code Interpreter
- [ ] Documentação rápida "Como rodar"
- [ ] Testes unitários para funções críticas
- [ ] Tratamento de erros com mensagens claras

---

# Especificação do Produto

## CLI Commands

### 1. `clone-assistants plan`

Mostra o que seria criado/atualizado (dry-run implícito).

**Saída:**
- Lista de assistants a serem clonados
- Operação para cada um (create/update)
- Recursos adicionais (files, vector stores)

### 2. `clone-assistants apply`

Executa clonagem.

**Comportamento:**
- Cria/atualiza assistants
- Copia files/vector stores (se habilitado)
- Gera relatório ao final

### 3. `clone-assistants export`

Exporta snapshots para JSON (IaC).

**Saída:**
- `assistants-snapshot.json` com todas configurações

### 4. `clone-assistants import`

Importa snapshots num destino (sem depender da origem).

**Entrada:**
- `assistants-snapshot.json`

## Critérios de Aceite

- ✅ Clonar um assistant com 3 functions preserva:
  - nomes, descrições, schemas (`parameters`) e ordem/estrutura
- ✅ Reexecução não cria duplicados (idempotência via metadata)
- ✅ Suporta seleção por ID e por nome
- ✅ File Search: arquivos são transferidos e vector store recriado
- ✅ Code Interpreter: arquivos são transferidos
- ✅ Dry-run mostra exatamente o que será feito
- ✅ Relatório final tem mapeamento de IDs origem→destino

## Estrutura de Dados

### AssistantSnapshot

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
  tools: Tool[]
  tool_resources?: ToolResources
  metadata?: Record<string, string>
}

type Tool = {
  type: 'function' | 'file_search' | 'code_interpreter'
  function?: {
    name: string
    description: string
    parameters: object  // JSON Schema
  }
}

type ToolResources = {
  file_search?: {
    vector_store_ids: string[]
  }
  code_interpreter?: {
    file_ids: string[]
  }
}
```

---

# Referências

- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)
- [Assistants Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling?utm_source=chatgpt.com)
- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants?utm_source=chatgpt.com)
- [Production best practices](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization?utm_source=chatgpt.com)
- [Error codes](https://platform.openai.com/docs/guides/error-codes?utm_source=chatgpt.com)
