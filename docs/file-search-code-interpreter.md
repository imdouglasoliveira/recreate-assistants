# File Search and Code Interpreter

## Overview

When an Assistant uses **File Search** or **Code Interpreter**, you must recreate resources in the destination project because file IDs and vector store IDs are not transferable between projects.

## Cloning File Search

### Limitations

- Cannot reuse `file_id` or `vector_store_id` from source project
- Must recreate all resources in destination
- Max 1 vector store per assistant
- Max 10,000 files per vector store
- Size and storage limits apply

### Cloning Process

#### A) Download File Content from Source

```bash
curl "https://api.openai.com/v1/files/$FILE_ID/content" \
  -H "Authorization: Bearer $SRC_KEY" \
  --output "file.bin"
```

#### B) Upload File to Destination

Generates a **NEW file_id**:

```bash
curl "https://api.openai.com/v1/files" \
  -H "Authorization: Bearer $DST_KEY" \
  -F "purpose=assistants" \
  -F "file=@file.bin"
```

#### C) Create Vector Store in Destination

Create a vector store and attach the new file_ids:

```bash
curl "https://api.openai.com/v1/vector_stores" \
  -H "Authorization: Bearer $DST_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloned Vector Store",
    "file_ids": ["file_xxx", "file_yyy"]
  }'
```

#### D) Update Destination Assistant

Point to the new vector store:

```bash
curl "https://api.openai.com/v1/assistants/$ASST_ID" \
  -H "Authorization: Bearer $DST_KEY" \
  -H "OpenAI-Beta: assistants=v2" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{
    "tool_resources": {
      "file_search": {
        "vector_store_ids": ["vs_xxx"]
      }
    }
  }'
```

### Complete Flow for File Search

```javascript
async function cloneFileSearch(srcKey, dstKey, srcAssistantId, dstAssistantId) {
  // 1. Get vector stores from source assistant
  const srcAssistant = await getAssistant(srcKey, srcAssistantId);
  const vsIds = srcAssistant.tool_resources?.file_search?.vector_store_ids || [];

  const newVectorStoreIds = [];

  for (const vsId of vsIds) {
    // 2. List vector store files
    const files = await listVectorStoreFiles(srcKey, vsId);

    const newFileIds = [];

    for (const file of files) {
      // 3. Download file content
      const content = await downloadFile(srcKey, file.id);

      // 4. Upload to destination
      const newFile = await uploadFile(dstKey, content, file.filename);
      newFileIds.push(newFile.id);
    }

    // 5. Create vector store in destination
    const newVs = await createVectorStore(dstKey, {
      name: `Clone of ${vsId}`,
      file_ids: newFileIds
    });

    newVectorStoreIds.push(newVs.id);
  }

  // 6. Update destination assistant
  await updateAssistant(dstKey, dstAssistantId, {
    tool_resources: {
      file_search: {
        vector_store_ids: newVectorStoreIds
      }
    }
  });
}
```

## Cloning Code Interpreter

### Process

#### A) List Files Attached to Assistant

```bash
curl "https://api.openai.com/v1/assistants/$ASST_ID" \
  -H "Authorization: Bearer $SRC_KEY" \
  -H "OpenAI-Beta: assistants=v2"
```

Check `tool_resources.code_interpreter.file_ids`

#### B) Download and Re-upload Files

Similar to File Search:

```javascript
async function cloneCodeInterpreter(srcKey, dstKey, srcAssistantId, dstAssistantId) {
  // 1. Get file IDs from source
  const srcAssistant = await getAssistant(srcKey, srcAssistantId);
  const fileIds = srcAssistant.tool_resources?.code_interpreter?.file_ids || [];

  const newFileIds = [];

  for (const fileId of fileIds) {
    // 2. Download file
    const content = await downloadFile(srcKey, fileId);
    const metadata = await getFileMetadata(srcKey, fileId);

    // 3. Upload to destination
    const newFile = await uploadFile(dstKey, content, metadata.filename);
    newFileIds.push(newFile.id);
  }

  // 4. Update destination assistant
  await updateAssistant(dstKey, dstAssistantId, {
    tool_resources: {
      code_interpreter: {
        file_ids: newFileIds
      }
    }
  });
}
```

## Feature Flags

### When to Enable

**INCLUDE_FILE_SEARCH="true"**
- Enable if assistants use File Search
- Warning: Can be expensive (time + cost)
- Consider file sizes and count

**INCLUDE_CODE_INTERPRETER="true"**
- Enable if assistants have attached files
- Warning: Can be expensive (time + cost)
- Files are downloaded and re-uploaded

### Performance Considerations

**File Search cloning is expensive because:**
- Each file must be downloaded from source
- Each file must be uploaded to destination
- Vector store creation takes time
- API rate limits may slow the process

**Recommendations:**
1. Start with `false` for both flags
2. Clone assistants first
3. Enable flags only if needed
4. Use `DRY_RUN=true` to preview
5. Consider running during off-peak hours

## Limitations and Considerations

1. **File IDs are not portable** - Must download/upload
2. **Storage costs** - Duplicated files consume storage
3. **Processing time** - Vector store creation is async
4. **Rate limits** - May hit 429 errors with many files
5. **File size limits** - Check OpenAI limits per file type

## References

- [Assistants File Search](https://platform.openai.com/docs/assistants/tools/file-search)
- [Vector Stores API](https://platform.openai.com/docs/api-reference/vector-stores)
- [Files API](https://platform.openai.com/docs/api-reference/files)
- [Code Interpreter](https://platform.openai.com/docs/assistants/tools/code-interpreter)
