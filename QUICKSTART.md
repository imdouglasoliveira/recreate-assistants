# Quick Start - Replicador de Assistants

## Instalação

```bash
# Clonar o repositório
git clone <repo-url>
cd recriar_assistants

# Instalar dependências
npm install
```

## Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Edite o [.env](.env) e configure suas API keys:

```bash
# OBRIGATÓRIAS
OPENAI_SRC_API_KEY="sk-proj-..."  # API key do projeto de origem
OPENAI_DST_API_KEY="sk-proj-..."  # API key do projeto de destino

# Configure o modo de clonagem
CLONE_MODE="all"  # all | by_id | by_name
```

## Uso

### 1. Planejar (Dry-run)

Visualize o que será clonado sem fazer alterações:

```bash
npm run clone:plan
```

### 2. Executar Clonagem

Execute a clonagem real:

```bash
npm run clone:apply
```

### 3. Exportar Snapshots

Exporte assistants para JSON (backup/versionamento):

```bash
npm run clone:export
```

Arquivo será salvo em `./out/assistants-export-YYYY-MM-DD.json`

### 4. Importar de Snapshot

Importe assistants de um arquivo JSON:

```bash
npm run clone:import ./out/assistants-export-2024-12-03.json
```

## Modos de Clonagem

### Clonar Todos os Assistants

```bash
CLONE_MODE="all"
```

### Clonar Apenas IDs Específicos

```bash
CLONE_MODE="by_id"
CLONE_IDS="asst_abc123,asst_def456,asst_xyz789"
```

### Clonar por Nome (filtro)

```bash
CLONE_MODE="by_name"
CLONE_NAME_PREFIX="Production"  # Clona assistants cujo nome contém "Production"
```

## Features Opcionais

### Clonar File Search (Vector Stores)

⚠️ **Operação custosa em tempo e $$$**

```bash
INCLUDE_FILE_SEARCH="true"
```

Clona:
- Vector stores
- Todos os arquivos associados
- Recria no destino

### Clonar Code Interpreter

⚠️ **Operação custosa em tempo e $$$**

```bash
INCLUDE_CODE_INTERPRETER="true"
```

Clona:
- Arquivos anexados ao assistant
- Re-upload no destino

## Configurações Avançadas

### Performance

```bash
# Número máximo de operações paralelas
MAX_CONCURRENCY="3"

# Níveis: debug | info | warn | error
LOG_LEVEL="info"
```

### Dry Run

Simula a clonagem sem fazer alterações:

```bash
DRY_RUN="true"
npm run clone:apply
```

### Prefixo de Nome

Adiciona prefixo aos nomes dos assistants clonados:

```bash
CLONE_NAME_PREFIX="PROD - "
```

Resultado: `PROD - Customer Support Assistant`

## Relatórios

Após a clonagem, relatórios são gerados em `./out/`:

- **mapping.json**: Mapeamento completo (JSON)
- **report.md**: Relatório formatado (Markdown)

### Estrutura do mapping.json

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
      "srcId": "asst_abc123",
      "dstId": "asst_xyz789",
      "name": "Customer Support",
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

## Exemplo Completo

```bash
# 1. Configure o .env
cat > .env <<EOF
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."
CLONE_MODE="all"
DRY_RUN="false"
INCLUDE_FILE_SEARCH="false"
INCLUDE_CODE_INTERPRETER="false"
MAX_CONCURRENCY="3"
LOG_LEVEL="info"
OUTPUT_DIR="./out"
EOF

# 2. Visualize o plano
npm run clone:plan

# 3. Execute a clonagem
npm run clone:apply

# 4. Verifique os relatórios
cat ./out/report.md
```

## Troubleshooting

### Erro: Missing API Keys

```
OPENAI_SRC_API_KEY e OPENAI_DST_API_KEY são obrigatórias
```

**Solução**: Configure as keys no arquivo `.env`

### Erro: Rate Limit (429)

```
[WARN] Retry attempt 1/3 after 1000ms
```

**Solução**: A ferramenta já faz retry automático. Se persistir, reduza `MAX_CONCURRENCY`.

### Erro: CLONE_IDS não definido

```
CLONE_IDS não definido para modo by_id
```

**Solução**: Configure `CLONE_IDS` no `.env` quando usar `CLONE_MODE="by_id"`

## Próximos Passos

- Leia a [documentação completa](./docs/README.md)
- Veja o [PRD/ADR](./docs/prd-adr.md) para detalhes arquiteturais
- Consulte o [guia de implementação](./docs/guia-implementacao.md)

## Suporte

Para problemas e questões:
- Verifique os logs estruturados
- Consulte a [documentação](./docs/)
- Revise os [error codes da OpenAI](https://platform.openai.com/docs/guides/error-codes)
