# AI Model Configuration Guide

## Overview

The application uses a centralized AI model configuration system that allows you to easily switch between different AI providers (Gemini and Ollama) across the entire application or for specific use cases.

## Environment Variables

### Primary Configuration

```bash
# Main AI Provider (applies to all services unless overridden)
# Options: 'gemini' or 'ollama'
AI_PROVIDER=gemini
```

### Use-Case Specific Overrides (Optional)

You can override the provider for specific use cases:

```bash
# Chatbot conversations
AI_CHAT_PROVIDER=gemini

# JSON generation (email parsing, data extraction)
AI_JSON_PROVIDER=gemini

# Data analysis (Excel analysis, etc.)
AI_ANALYSIS_PROVIDER=gemini
```

### Provider-Specific Configuration

#### Gemini Configuration
```bash
AI_CHAT_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp
```

#### Ollama Configuration
```bash
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:latest
```

## Usage in Code

### Basic Usage

```typescript
import { getModelForUseCase, getActiveProvider } from '@/core/services/aiModelService';

// Get model for specific use case
const { provider, model } = getModelForUseCase('json');

// Get active provider
const activeProvider = getActiveProvider();
```

### Example: Switching Providers Dynamically

```typescript
import { getModelForUseCase } from '@/core/services/aiModelService';
import { generateJsonContent as generateJsonGemini } from './geminiJsonService';
import { generateJsonContent as generateJsonOllama } from './ollamaService';

async function extractData(prompt: string) {
  const { provider } = getModelForUseCase('json');
  
  const response = provider === 'gemini'
    ? await generateJsonGemini(prompt, systemPrompt)
    : await generateJsonOllama(prompt, systemPrompt);
  
  return response;
}
```

## Use Cases

The system supports three main use cases:

1. **`chat`** - Chatbot conversations and general text generation
2. **`json`** - Structured data extraction (email parsing, form data)
3. **`analysis`** - Data analysis and categorization (Excel analysis)

## Configuration Examples

### Example 1: Use Gemini for Everything
```bash
AI_PROVIDER=gemini
AI_CHAT_API_KEY=your_key
GEMINI_MODEL=gemini-2.0-flash-exp
```

### Example 2: Use Ollama for Everything
```bash
AI_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3:latest
```

### Example 3: Mixed Configuration
```bash
# Default to Gemini
AI_PROVIDER=gemini

# But use Ollama for analysis
AI_ANALYSIS_PROVIDER=ollama

# Keep Gemini for chat and JSON
AI_CHAT_PROVIDER=gemini
AI_JSON_PROVIDER=gemini
```

## API Reference

### `getActiveProvider()`
Returns the currently active AI provider.

```typescript
const provider = getActiveProvider(); // 'gemini' | 'ollama'
```

### `getActiveModel()`
Returns the model name for the active provider.

```typescript
const model = getActiveModel(); // e.g., 'gemini-2.0-flash-exp'
```

### `getModelForUseCase(useCase: 'chat' | 'json' | 'analysis')`
Returns the provider and model for a specific use case, respecting overrides.

```typescript
const { provider, model } = getModelForUseCase('json');
```

### `isProviderEnabled(provider: 'gemini' | 'ollama')`
Checks if a provider is properly configured and enabled.

```typescript
if (isProviderEnabled('gemini')) {
  // Use Gemini
}
```

### `getAvailableProviders()`
Returns status of all available providers.

```typescript
const providers = getAvailableProviders();
// {
//   gemini: { enabled: true, model: 'gemini-2.0-flash-exp' },
//   ollama: { enabled: true, model: 'llama3:latest' }
// }
```

## Current Implementation

The following services use the centralized AI model configuration:

- **Email Parser** (`emailParserService.ts`) - Uses `AI_JSON_PROVIDER` or `AI_PROVIDER`
- **Chatbot** (`geminiService.ts`) - Can be updated to use `AI_CHAT_PROVIDER`
- **Excel Analyzer** (`excelAnalyzerService.ts`) - Can be updated to use `AI_ANALYSIS_PROVIDER`

## Migration Guide

To migrate a service to use the centralized configuration:

1. Import the AI model service:
```typescript
import { getModelForUseCase } from '@/core/services/aiModelService';
```

2. Get the provider for your use case:
```typescript
const { provider } = getModelForUseCase('json'); // or 'chat' or 'analysis'
```

3. Use the appropriate service based on provider:
```typescript
const response = provider === 'gemini'
  ? await generateJsonGemini(prompt, systemPrompt)
  : await generateJsonOllama(prompt, systemPrompt);
```

## Benefits

- **Centralized Configuration**: One place to manage AI model selection
- **Flexible**: Override per use case if needed
- **Easy Switching**: Change provider via environment variable
- **Type Safe**: Full TypeScript support
- **Fallback Support**: Automatic fallback if provider not available

