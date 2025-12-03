# Quick Start

Get started with Recreate Assistants in 3 steps.

## Installation

```bash
npm install
cp .env.example .env
```

Edit [.env](.env):

```bash
OPENAI_SRC_API_KEY="sk-proj-..."  # Source project key
OPENAI_DST_API_KEY="sk-proj-..."  # Destination project key
CLONE_MODE="all"                  # all | by_id | by_name
```

## Basic Usage

```bash
# Preview what will be cloned
npm run clone:plan

# Execute the clone
npm run clone:apply

# Export to JSON backup
npm run clone:export
```

## Clone Modes

**All Assistants**
```bash
CLONE_MODE="all"
```

**Specific IDs**
```bash
CLONE_MODE="by_id"
CLONE_IDS="asst_abc123,asst_def456"
```

**By Name Pattern**
```bash
CLONE_MODE="by_name"
CLONE_NAME_PREFIX="Production"
```

## Optional Features

**File Search** (clones vector stores + files)
```bash
INCLUDE_FILE_SEARCH="true"
```

**Code Interpreter** (clones attached files)
```bash
INCLUDE_CODE_INTERPRETER="true"
```

**Name Prefix** (adds prefix to cloned names)
```bash
CLONE_NAME_PREFIX="PROD - "
```

**Dry Run** (preview without changes)
```bash
DRY_RUN="true"
npm run clone:apply
```

## Configuration Options

```bash
# Performance
MAX_CONCURRENCY="3"        # Parallel operations limit
LOG_LEVEL="info"           # debug | info | warn | error

# Output
OUTPUT_DIR="./out"         # Reports directory
```

## Output Reports

After cloning, check `./out/`:

- `mapping.json` - Complete ID mappings
- `report.md` - Human-readable summary

Example mapping structure:

```json
{
  "cloned_at": "2024-12-03T10:30:00Z",
  "mappings": [
    {
      "srcId": "asst_abc123",
      "dstId": "asst_xyz789",
      "name": "Customer Support",
      "status": "success"
    }
  ],
  "summary": {
    "total": 5,
    "success": 4,
    "failed": 1
  }
}
```

## Common Issues

**Missing API Keys**
```bash
# Add to .env
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."
```

**Rate Limit (429)**
```bash
# Reduce concurrency
MAX_CONCURRENCY="2"
```

**CLONE_IDS Required**
```bash
# For by_id mode
CLONE_MODE="by_id"
CLONE_IDS="asst_abc,asst_def"
```

## Complete Example

```bash
# Configure
cat > .env <<EOF
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."
CLONE_MODE="all"
DRY_RUN="false"
INCLUDE_FILE_SEARCH="false"
MAX_CONCURRENCY="3"
EOF

# Preview
npm run clone:plan

# Execute
npm run clone:apply

# Check results
cat ./out/report.md
```

## Next Steps

- See [README.md](README.md) for feature overview
- Check [docs/](docs/) for technical specifications
- Review [docs/prd-adr.md](docs/prd-adr.md) for architecture decisions
