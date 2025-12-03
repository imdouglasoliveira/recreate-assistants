<<<<<<< HEAD
# recreate-assistants
Recreate Assistants in another organization on the same account.
=======
# Documentação - Replicador de Assistants OpenAI

## Visão Geral

Esta documentação descreve como clonar/replicar **Assistants da OpenAI** entre Organizations e Projects, incluindo suas configurações, Functions, File Search e Code Interpreter.

## Índice de Documentos

### 1. [Conceitos Principais da API](./docs/conceitos-api.md)

Entenda os fundamentos:
- Limitações de transferência entre Organizations/Projects
- Status da Assistants API (depreciação em 2026)
- Autenticação e organização
- Function Calling
- Rate limiting e quotas

### 2. [Guia de Clonagem de Assistants](./docs/clonagem-assistants.md)

Aprenda a clonar assistants:
- Processo de clonagem básico
- Endpoints da API
- Script Node.js completo
- Campos clonados e não clonados
- Idempotência

### 3. [File Search e Code Interpreter](./docs/file-search-code-interpreter.md)

Clone recursos avançados:
- Clonagem de File Search (vector stores + arquivos)
- Clonagem de Code Interpreter
- Limitações e considerações
- Feature flags recomendadas

### 4. [PRD + ADR](./docs/prd-adr.md)

Especificação completa do produto:
- Requisitos funcionais e não-funcionais
- Decisões arquiteturais (ADRs)
- Riscos e mitigação
- Checklist de entrega
- CLI commands

### 5. [Guia de Implementação](./docs/guia-implementacao.md)

Passo a passo para implementar:
- Preparar acessos e API keys
- Definir variáveis de ambiente
- Algoritmo de clonagem detalhado
- Validação e relatórios
- Tratamento de erros
- Segurança

## Quick Start

### 1. Configure suas API Keys

```bash
# .env
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."
```

### 2. Execute o Plan (Dry-run)

```bash
DRY_RUN=true npm run clone:plan
```

### 3. Execute a Clonagem

```bash
npm run clone:apply
```

## Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────┐
│                    ORIGEM (Org A)                       │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Assistant 1  │  │ Assistant 2  │  │ Assistant 3  │ │
│  │              │  │              │  │              │ │
│  │ + Functions  │  │ + File Search│  │ + Code Int.  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                          │                             │
└──────────────────────────┼─────────────────────────────┘
                           │
                           │ API Clone
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    DESTINO (Org B)                      │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Assistant 1' │  │ Assistant 2' │  │ Assistant 3' │ │
│  │              │  │              │  │              │ │
│  │ + Functions  │  │ + Vector Store│ │ + Files      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Casos de Uso

### 1. Migração Dev → Prod

Clone assistants de ambiente de desenvolvimento para produção.

**Configuração:**
```bash
CLONE_MODE="all"
INCLUDE_FILE_SEARCH="true"
```

### 2. Backup e Versionamento

Exporte snapshots dos assistants para versionamento.

**Comando:**
```bash
npm run clone:export
```

### 3. Replicação entre Clientes

Clone assistants entre diferentes organizations de clientes.

**Configuração:**
```bash
CLONE_MODE="by_id"
CLONE_IDS="asst_abc,asst_def"
CLONE_NAME_PREFIX="Cliente XYZ - "
```

## Limitações Conhecidas

| Limitação | Descrição | Solução |
|-----------|-----------|---------|
| **IDs não transferíveis** | file_ids e vector_store_ids não existem entre projetos | Recriar recursos no destino |
| **Threads não clonadas** | Histórico de conversas não é migrado | Escopo futuro (fase 2) |
| **Functions não executáveis** | API só define schemas, não executa | Portar backend manualmente |
| **Rate limits** | 429 em operações em massa | Implementar backoff e concurrency |
| **API deprecada** | Sunset em 2026 | Planejar migração para Responses API |

## Contribuindo

Para contribuir com melhorias:

1. Leia a documentação completa
2. Siga as ADRs definidas
3. Implemente testes
4. Documente suas mudanças

## Referências Oficiais

- [OpenAI Help Center - Managing projects](https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)
- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)
- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants?utm_source=chatgpt.com)
- [Assistants migration guide](https://platform.openai.com/docs/assistants/migration?utm_source=chatgpt.com)
- [Production best practices](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization?utm_source=chatgpt.com)

## Suporte

Para questões e problemas:
- Consulte primeiro a documentação acima
- Verifique os error codes na [documentação oficial](https://platform.openai.com/docs/guides/error-codes?utm_source=chatgpt.com)
- Revise os logs estruturados da aplicação

---

**Última atualização:** 2024-12-03
>>>>>>> 426e67b (Sender Application for repo)
