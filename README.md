# ChatDelta JS

**ChatDelta JS** is a lightweight TypeScript/JavaScript SDK that provides a unified interface for sending prompts to multiple AI providers such as OpenAI, Google Gemini and Anthropic Claude. It exposes a common client abstraction so your application code can swap providers without rewriting business logic.

## Features

- Consistent `AiClient` interface across providers
- Built‑in error handling with descriptive error types
- Optional parallel execution and response summarisation helpers
- TypeScript definitions out of the box
- **NEW in v0.3.0**: Response metadata with token counts and latency tracking
- **NEW in v0.3.0**: ChatSession for high-level conversation management
- **NEW in v0.3.0**: Advanced retry strategies (Fixed, Linear, Exponential, ExponentialWithJitter)
- **NEW in v0.3.0**: Performance metrics tracking system
- **NEW in v0.3.0**: Custom base URL support for Azure OpenAI and local models

## Installation

```bash
npm install chatdelta
```

The library targets modern Node runtimes (ES2020). Type declarations are bundled so it works in both JavaScript and TypeScript projects.

## Usage

### Basic Usage
```ts
import { createClient, executeParallel, generateSummary } from 'chatdelta';

const openai = createClient('openai', process.env.OPENAI_KEY!, 'gpt-4');
const gemini = createClient('gemini', process.env.GEMINI_KEY!, 'gemini-pro');

async function run() {
  const results = await executeParallel([openai, gemini], 'Explain quantum entanglement');
  console.log(results);

  const summary = await generateSummary(openai, results.map(r => ({ name: r.name, response: String(r.result) })));
  console.log('Summary:', summary);
}
```

### Chat Sessions (NEW in v0.3.0)
```ts
import { createClient, ChatSession } from 'chatdelta';

const client = createClient('openai', process.env.OPENAI_KEY!, 'gpt-4');
const session = ChatSession.withSystemMessage(client, 'You are a helpful assistant.');

// Send messages with automatic history management
const response1 = await session.send('What is TypeScript?');
const response2 = await session.send('What are its main benefits?'); // Remembers context

// Get response with metadata
const responseWithMeta = await session.sendWithMetadata('How does it compare to JavaScript?');
console.log('Tokens used:', responseWithMeta.metadata.totalTokens);
console.log('Latency:', responseWithMeta.metadata.latencyMs, 'ms');
```

### Response Metadata (NEW in v0.3.0)
```ts
const client = createClient('openai', process.env.OPENAI_KEY!, 'gpt-4');

// Get detailed metadata with responses
const response = await client.sendPromptWithMetadata('Explain recursion');
console.log('Content:', response.content);
console.log('Model used:', response.metadata.modelUsed);
console.log('Prompt tokens:', response.metadata.promptTokens);
console.log('Completion tokens:', response.metadata.completionTokens);
console.log('Total tokens:', response.metadata.totalTokens);
console.log('Latency:', response.metadata.latencyMs, 'ms');
```

### Advanced Retry Strategies (NEW in v0.3.0)
```ts
import { createClient, RetryStrategy } from 'chatdelta';

const config = {
  retries: 5,
  retryStrategy: RetryStrategy.ExponentialWithJitter,
  baseUrl: 'https://your-azure-instance.openai.azure.com' // Custom endpoint support
};

const client = createClient('openai', process.env.OPENAI_KEY!, 'gpt-4', config);
```

### Performance Metrics (NEW in v0.3.0)
```ts
import { ClientMetrics } from 'chatdelta';

const metrics = new ClientMetrics();

// Track requests
metrics.recordSuccess(150, 100, 50); // latency, prompt tokens, completion tokens
metrics.recordFailure();

// Get statistics
const snapshot = metrics.getSnapshot();
console.log('Success rate:', snapshot.successRate, '%');
console.log('Average latency:', snapshot.averageLatencyMs, 'ms');
console.log('P95 latency:', snapshot.p95LatencyMs, 'ms');
console.log('Total tokens:', snapshot.totalTokens);
```

## Configuration

`createClient` accepts an optional `ClientConfig` allowing control over timeouts, retries, temperature and token limits. See `src/types.ts` for the full interface.

## Contributing

Bug reports and pull requests are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our process.

## License

This project is released under the [MIT License](LICENSE).
