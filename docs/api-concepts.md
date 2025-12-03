# Conceitos Principais da API OpenAI

## Limitações de Transferência entre Organizations/Projects

**Recursos não são transferíveis diretamente entre projetos/organizations**:
- Assistants, threads, files e vector stores são recursos "scoped" ao projeto
- Não podem ser movidos entre projetos/organizations
- Solução: recriar os recursos no destino

**Referências:**
- [OpenAI Help Center - Managing projects](https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)

## Status da Assistants API

⚠️ **IMPORTANTE**: A Assistants API está **deprecada** e tem data de descontinuação publicada:
- **Sunset**: 1º semestre de 2026
- **Recomendação**: Migrar para **Responses API**
- Se estiver começando algo novo, considere já usar o modelo novo

**Referências:**
- [Assistants migration guide](https://platform.openai.com/docs/assistants/migration?utm_source=chatgpt.com)
- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)

## Autenticação e Organização

### API Keys

Você precisa de **duas API keys** para clonar entre organizations:
1. **API key do projeto de origem**
2. **API key do projeto de destino**

### Headers Obrigatórios

Para todas as chamadas da Assistants API v2:
```bash
OpenAI-Beta: assistants=v2
```

### Headers Opcionais para Multi-org

Quando você pertence a múltiplas organizations:
- `OpenAI-Organization: org_...`
- `OpenAI-Project: proj_...`

**Dica**: Keys de projeto são normalmente o jeito mais simples de separar origem e destino.

**Referências:**
- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants?utm_source=chatgpt.com)
- [Production best practices - Setting up organization](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization?utm_source=chatgpt.com)

## Function Calling

As **Functions** definidas no Assistant são apenas **definições** (schemas):
- A OpenAI **não executa** suas funções
- Ela apenas **sugere a chamada** baseado no contexto
- **Você** é responsável por implementar o backend que executa as chamadas

**Referências:**
- [Assistants Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling?utm_source=chatgpt.com)

## Rate Limiting e Quotas

### Limites Conhecidos

**Vector Stores:**
- 1 vector store por assistant
- 10.000 arquivos por vector store
- Limites de tamanho e storage

**Rate Limits:**
- Respeitar RPM (Requests Per Minute) padrões
- GET/POST/DELETE possuem limites específicos
- Implementar retries com backoff para 429/5xx

**Referências:**
- [Error codes](https://platform.openai.com/docs/guides/error-codes?utm_source=chatgpt.com)
