# PRD + ADR - Assistants Replicator

## Important Context

⚠️ The **Assistants API v2** is on a **deprecation path** with sunset targeted for **Q2 2026**. OpenAI recommends the **Responses API** as the new approach.

It's still possible to clone via Assistants v2 today and design the project with an "adapter" for future migration.

**Reference:**
- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)

---

# PRD — Assistants Replicator Between Organizations/Projects

## 1. Objective

Build an application (CLI and/or service) that:

- Reads all (or a subset) of **Assistants** from a **source project**
- Creates (or updates) equivalent Assistants in a **destination project** in **another Organization**
- Fully replicates Assistant configurations:
  - **name, description, instructions**
  - **model**
  - **temperature, top_p**
  - **response_format**
  - **tools**, including **Functions** (tool `type:function`) with `name`, `description`, and `parameters` (JSON Schema)
- (Optional) Also replicates hosted tool resources:
  - **File Search** (vector stores + files)
  - **Code Interpreter** (attached files)

## 2. Motivation / Problem

- Playground has "Clone" but it works **within the same context** (same org/project)
- Need **cross-org clone** with automation and repeatability (CI/CD / IaC)
- Typical scenario: migrate/mirror environments (dev → prod), or duplicate Assistants between units (org A → org B)

## 3. Stakeholders

- Developer/owner
- Automation team
- Operations

## 4. Scope

### In-scope

- ✅ Clone Assistants via API
- ✅ Clone **Function catalog** linked to Assistant
- ✅ **Dry-run** mode
- ✅ Export/import snapshots (JSON)
- ✅ Idempotency via metadata
- ✅ (Optional) Clone File Search resources
- ✅ (Optional) Clone Code Interpreter files
- ✅ Progress reporting
- ✅ Error handling with retries

### Out-of-scope

- ❌ Thread cloning (conversation history)
- ❌ Function execution implementation
- ❌ Real-time sync
- ❌ GUI (CLI only)

## 5. Requirements

### Functional

**FR-1: Clone Basic Assistant**
- Read assistant from source
- Create equivalent in destination
- Preserve all configuration fields

**FR-2: Clone Functions**
- Include all function tool definitions
- Preserve schemas and descriptions

**FR-3: Clone Modes**
- `all`: Clone all assistants
- `by_id`: Clone specific IDs
- `by_name`: Clone by name pattern

**FR-4: Dry Run**
- Preview what would be cloned
- No actual API writes

**FR-5: Idempotency**
- Use `metadata.cloned_from` to track
- Avoid duplicate clones

**FR-6: Export/Import**
- Export assistants to JSON
- Import from JSON snapshots

### Non-Functional

**NFR-1: Performance**
- Handle rate limits with backoff
- Support concurrent operations (configurable)

**NFR-2: Reliability**
- Retry on transient errors (429, 5xx)
- Generate detailed error logs

**NFR-3: Security**
- API keys in environment variables
- Never log sensitive data

**NFR-4: Observability**
- Structured logging
- Progress indicators
- Final summary report

## 6. Technical Design

### Architecture

```
┌─────────────┐
│     CLI     │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Config    │ ← .env
│   Loader    │
└──────┬──────┘
       │
       v
┌─────────────┐
│   Cloner    │
│   Service   │
└──────┬──────┘
       │
       ├──> [Source OpenAI API]
       ├──> [Dest OpenAI API]
       │
       v
┌─────────────┐
│  Reporter   │ → mapping.json
└─────────────┘   report.md
```

### Key Components

**1. Config Loader**
- Loads `.env` configuration
- Validates required fields
- Provides defaults

**2. Cloner Service**
- Implements cloning logic
- Handles API calls with retry
- Manages concurrency

**3. Reporter**
- Generates mapping file
- Creates summary report
- Logs progress

### API Endpoints Used

- `GET /v1/assistants` - List assistants
- `GET /v1/assistants/{id}` - Get assistant details
- `POST /v1/assistants` - Create assistant
- `POST /v1/assistants/{id}` - Update assistant
- `GET /v1/files/{id}/content` - Download file
- `POST /v1/files` - Upload file
- `POST /v1/vector_stores` - Create vector store
- `GET /v1/vector_stores/{id}/files` - List VS files

## 7. ADRs (Architecture Decision Records)

### ADR-1: Use TypeScript + Node.js

**Decision:** Implement in TypeScript with Node.js runtime

**Rationale:**
- OpenAI SDK available for TypeScript
- Async/await for API calls
- Type safety reduces errors
- Easy deployment

**Alternatives considered:**
- Python: Good SDK but less type safety
- Go: Fast but less familiar ecosystem

### ADR-2: CLI-first, No GUI

**Decision:** Build as CLI tool only

**Rationale:**
- Simpler to implement
- CI/CD friendly
- Automation-first approach
- GUI can be added later if needed

### ADR-3: Use Metadata for Idempotency

**Decision:** Track clones via `metadata.cloned_from`

**Rationale:**
- Built into API
- Survives updates
- No external database needed

**Trade-offs:**
- Metadata is mutable
- Not foolproof but good enough

### ADR-4: Optional File Cloning

**Decision:** Make File Search/Code Interpreter cloning optional via flags

**Rationale:**
- Can be expensive (time + $$$)
- Not always needed
- User can opt-in

### ADR-5: Fail Fast on Critical Errors

**Decision:** Stop on authentication failures, continue on assistant-level errors

**Rationale:**
- Auth errors = misconfiguration
- Individual assistant failures shouldn't stop batch

## 8. Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Rate limits (429) | High | Exponential backoff, configurable concurrency |
| File download failures | Medium | Retry logic, skip on persistent failure |
| API deprecation | High | Design adapter layer for future Responses API |
| Large file costs | Medium | Make optional, warn user |
| Metadata collisions | Low | Use UUID in metadata if needed |

## 9. Delivery Checklist

- [x] Config loader with .env support
- [x] Basic assistant cloning
- [x] Function definitions cloning
- [x] Dry-run mode
- [x] Idempotency via metadata
- [x] Export/import JSON
- [x] File Search cloning (optional)
- [x] Code Interpreter cloning (optional)
- [x] Error handling and retries
- [x] Progress reporting
- [x] Documentation (README, QUICKSTART, docs/)
- [x] Example .env file

## 10. Future Enhancements

- Thread cloning (Phase 2)
- Real-time sync mode
- Web UI dashboard
- Webhook notifications
- Migration to Responses API adapter

## References

- [OpenAI Assistants API](https://platform.openai.com/docs/api-reference/assistants)
- [Managing Projects](https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)
- [Production Best Practices](https://platform.openai.com/docs/guides/production-best-practices)
