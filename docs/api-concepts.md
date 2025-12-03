# OpenAI API Concepts

## Transfer Limitations Between Organizations/Projects

**Resources cannot be directly transferred between projects/organizations:**
- Assistants, threads, files, and vector stores are project-scoped resources
- Cannot be moved between projects/organizations
- Solution: Recreate resources in the destination

**Reference:**
- [OpenAI Help Center - Managing projects](https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)

## Assistants API Status

⚠️ **IMPORTANT**: The Assistants API is **deprecated** with a published sunset date:
- **Sunset**: Q2 2026
- **Recommendation**: Migrate to **Responses API**
- If starting a new project, consider using the new model

**References:**
- [Assistants migration guide](https://platform.openai.com/docs/assistants/migration)
- [Assistants API (v2) FAQ](https://help.openai.com/en/articles/8550641-assistants-api-v2-faq)

## Authentication and Organization

### API Keys

You need **two API keys** to clone between organizations:
1. **Source project API key**
2. **Destination project API key**

### Required Headers

For all Assistants API v2 calls:
```bash
OpenAI-Beta: assistants=v2
```

### Optional Headers for Multi-org

When you belong to multiple organizations:
- `OpenAI-Organization: org_...`
- `OpenAI-Project: proj_...`

**Tip**: Project-scoped keys are usually the simplest way to separate source and destination.

**References:**
- [API Reference - Assistants](https://platform.openai.com/docs/api-reference/assistants)
- [Production best practices - Setting up organization](https://platform.openai.com/docs/guides/production-best-practices/setting-up-your-organization)

## Function Calling

**Functions** defined in the Assistant are only **definitions** (schemas):
- OpenAI does **not execute** your functions
- It only **suggests calls** based on context
- **You** are responsible for implementing the backend that executes the calls

**Reference:**
- [Assistants Function Calling](https://platform.openai.com/docs/assistants/tools/function-calling)

## Rate Limiting and Quotas

### Known Limits

**Vector Stores:**
- 1 vector store per assistant
- 10,000 files per vector store
- Size and storage limits apply

**Rate Limits:**
- Respect standard RPM (Requests Per Minute)
- GET/POST/DELETE have specific limits
- Implement retries with backoff for 429/5xx errors

**Reference:**
- [Error codes](https://platform.openai.com/docs/guides/error-codes)
