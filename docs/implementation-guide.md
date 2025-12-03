# Implementation Guide

Quick reference for implementing the Assistants cloning tool.

## Step 0 — Prepare Access

### 1. Configure Projects

**Source organization:**
1. Create/select a **Project** containing your Assistants
2. Note the ID: `proj_xxx`

**Destination organization:**
1. Create a **Project** to receive the clones
2. Note the ID: `proj_yyy`

### 2. Generate API Keys

Generate the following keys:
- `SRC_PROJECT_API_KEY` (source)
- `DST_PROJECT_API_KEY` (destination)

**Alternative:** Use a "user API key" + headers `OpenAI-Organization` and `OpenAI-Project` to direct billing/scope.

## Step 1 — Environment Variables

Create a `.env` file:

```bash
# Required
OPENAI_SRC_API_KEY="sk-proj-..."
OPENAI_DST_API_KEY="sk-proj-..."

# Clone mode
CLONE_MODE="all"  # all | by_id | by_name

# Optional
INCLUDE_FILE_SEARCH="false"
INCLUDE_CODE_INTERPRETER="false"
CLONE_NAME_PREFIX=""
DRY_RUN="false"
MAX_CONCURRENCY="3"
LOG_LEVEL="info"
OUTPUT_DIR="./out"
```

## Step 2 — Cloning Algorithm

### Basic Flow

```
1. List assistants in source
2. For each assistant:
   a. Retrieve full definition
   b. Create assistant in destination
   c. If File Search enabled: clone vector stores
   d. If Code Interpreter enabled: clone files
3. Generate mapping report
```

### Pseudocode

```javascript
async function cloneAssistants(srcKey, dstKey, config) {
  // 1. List source assistants
  const assistants = await listAssistants(srcKey, config.mode);

  const mapping = [];

  for (const asst of assistants) {
    // 2. Create in destination
    const newAsst = await createAssistant(dstKey, {
      name: config.prefix + asst.name,
      model: asst.model,
      instructions: asst.instructions,
      tools: asst.tools,
      metadata: { cloned_from: asst.id }
    });

    // 3. Clone File Search if enabled
    if (config.includeFileSearch && hasFileSearch(asst)) {
      await cloneFileSearch(srcKey, dstKey, asst.id, newAsst.id);
    }

    // 4. Clone Code Interpreter if enabled
    if (config.includeCodeInterpreter && hasCodeInterpreter(asst)) {
      await cloneCodeInterpreter(srcKey, dstKey, asst.id, newAsst.id);
    }

    mapping.push({ srcId: asst.id, dstId: newAsst.id });
  }

  // 5. Generate report
  await saveMapping(mapping, config.outputDir);
}
```

## Step 3 — Validation

After cloning, validate:

```bash
# Check assistant count
src_count=$(curl -H "Authorization: Bearer $SRC_KEY" \
  "https://api.openai.com/v1/assistants" | jq '.data | length')

dst_count=$(curl -H "Authorization: Bearer $DST_KEY" \
  "https://api.openai.com/v1/assistants" | jq '.data | length')

echo "Source: $src_count, Destination: $dst_count"
```

## Step 4 — Error Handling

### Rate Limits (429)

Implement exponential backoff:

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
}
```

### Common Errors

**Invalid API Key:**
```
401 Unauthorized
```
Solution: Verify API keys in `.env`

**Resource Not Found:**
```
404 Not Found
```
Solution: Check assistant/file IDs exist in source

**Quota Exceeded:**
```
429 Too Many Requests
```
Solution: Reduce `MAX_CONCURRENCY` or wait

## Step 5 — Reporting

### Mapping File Format

`./out/mapping.json`:

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
      "status": "success"
    }
  ]
}
```

### Summary Report

`./out/report.md`:

```markdown
# Clone Report

## Summary
- Total: 5 assistants
- Success: 4
- Failed: 1

## Successful Clones
- asst_abc123 → asst_xyz789 (Customer Support)
- asst_def456 → asst_uvw012 (Sales Bot)

## Failed Clones
- asst_ghi789: Rate limit exceeded
```

## Security Considerations

1. **API Keys**: Store in environment variables, never commit to git
2. **Secrets**: Use secret managers for production (AWS Secrets Manager, Azure Key Vault)
3. **Audit**: Log all operations with timestamps
4. **Permissions**: Use least-privilege API keys

## References

- [Production best practices](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization)
- [Error codes](https://platform.openai.com/docs/guides/error-codes)
- [API Reference](https://platform.openai.com/docs/api-reference/assistants)
