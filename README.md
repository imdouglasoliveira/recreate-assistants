# Recreate Assistants

Clone OpenAI Assistants between Organizations and Projects, preserving configurations, functions, file search, and code interpreter.

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env with your API keys

# 3. Preview (dry-run)
npm run clone:plan

# 4. Execute
npm run clone:apply
```

## Features

- **Clone Assistants** - Full configuration including model, instructions, temperature
- **Functions** - All function definitions and schemas
- **File Search** - Vector stores and associated files (optional)
- **Code Interpreter** - Attached files (optional)
- **Backup/Export** - Save snapshots to JSON
- **Flexible Modes** - Clone all, by ID, or by name pattern

## Configuration

Create [.env](.env) file:

```bash
# Required
OPENAI_SRC_API_KEY="sk-proj-..."  # Source project
OPENAI_DST_API_KEY="sk-proj-..."  # Destination project

# Clone mode
CLONE_MODE="all"                  # all | by_id | by_name

# Optional
INCLUDE_FILE_SEARCH="false"       # Clone vector stores (costly)
INCLUDE_CODE_INTERPRETER="false"  # Clone attached files (costly)
CLONE_NAME_PREFIX=""              # Add prefix to names
DRY_RUN="false"                   # Preview without changes
```

## Usage

### Clone All Assistants

```bash
CLONE_MODE="all" npm run clone:apply
```

### Clone Specific IDs

```bash
CLONE_MODE="by_id"
CLONE_IDS="asst_abc123,asst_def456"
npm run clone:apply
```

### Clone by Name Pattern

```bash
CLONE_MODE="by_name"
CLONE_NAME_PREFIX="Production"
npm run clone:apply
```

### Export to JSON

```bash
npm run clone:export
# Output: ./out/assistants-export-YYYY-MM-DD.json
```

### Import from JSON

```bash
npm run clone:import ./out/assistants-export-2024-12-03.json
```

## Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Detailed setup and usage guide
- **[docs/](docs/)** - Technical specifications and implementation details

## Key Limitations

- **IDs not transferable** - file_ids and vector_store_ids must be recreated
- **Threads not cloned** - Conversation history not migrated (future scope)
- **Functions not executable** - Only schemas are cloned, backend must be ported manually
- **API sunset 2026** - Plan migration to Responses API

## Reports

After cloning, reports are generated in `./out/`:

- `mapping.json` - Complete ID mapping
- `report.md` - Formatted summary

## Troubleshooting

**Missing API Keys**
```bash
# Configure in .env
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."
```

**Rate Limit (429)**
```bash
# Reduce concurrency
MAX_CONCURRENCY="2"
```

**CLONE_IDS not defined**
```bash
# Required for by_id mode
CLONE_IDS="asst_abc,asst_def"
```

## References

- [Assistants API](https://platform.openai.com/docs/api-reference/assistants)
- [Managing Projects](https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)
- [Error Codes](https://platform.openai.com/docs/guides/error-codes)
