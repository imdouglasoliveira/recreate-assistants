# Assistant Cloning Guide

## Overview

This document explains how to clone/replicate Assistants between OpenAI Organizations/Projects.

## Cloning Process

To clone an Assistant, follow these steps:

1. **Read** the Assistant definition from the source org/project (API: list + retrieve)
2. **Create** a new Assistant in the destination org/project with the same fields
3. If using **File Search / Code Interpreter**, **recreate resources** (re-upload files and recreate vector stores) and reassign to the new assistant

## API Endpoints

### 1. List Assistants in Source

```bash
curl "https://api.openai.com/v1/assistants?limit=100" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

### 2. Retrieve Specific Assistant

```bash
curl "https://api.openai.com/v1/assistants/$ASST_ID" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

### 3. Create Assistant in Destination

```bash
curl "https://api.openai.com/v1/assistants" \
  -H "Authorization: Bearer $DST_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloned Assistant",
    "model": "gpt-4.1-mini",
    "instructions": "Same instructions...",
    "tools": [{"type":"file_search"}],
    "metadata": {"cloned_from":"'"$ASST_ID"'"}
  }'
```

## Node.js Cloning Script

This script copies **name/instructions/model/tools/metadata**:

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
  if (!SRC_KEY || !DST_KEY) throw new Error("Define SRC_KEY and DST_KEY environment variables.");

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
      // DO NOT copy tool_resources directly: IDs don't exist in destination
    };

    const created = await createAssistant(DST_KEY, payload);
    console.log(`OK: ${full.id} -> ${created.id}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

## Cloned Fields

The script above clones the following fields:

- ✅ `name`
- ✅ `description`
- ✅ `model`
- ✅ `instructions`
- ✅ `tools` (including Functions with schemas)
- ✅ `response_format`
- ✅ `temperature`
- ✅ `top_p`
- ✅ `metadata` (with `cloned_from` added)

## What is NOT Automatically Cloned

- ❌ `tool_resources` - IDs don't exist in destination
- ❌ File Search files
- ❌ Vector Stores
- ❌ Code Interpreter files

**To clone these resources, see:** [File Search and Code Interpreter](./file-search-code-interpreter.md)

## Idempotency

To avoid duplications, use `metadata.cloned_from`:
- Add the original assistant ID to `metadata.cloned_from`
- Check if an assistant with that metadata already exists before creating a new one
- If exists, perform **update** instead of create

## References

- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants)
- [Assistants File Search](https://platform.openai.com/docs/assistants/tools/file-search)
- [Assistants Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling)
