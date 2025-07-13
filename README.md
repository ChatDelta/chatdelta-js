# ChatDelta JS

**ChatDelta JS** is a lightweight TypeScript/JavaScript SDK that provides a unified interface for sending prompts to multiple AI providers such as OpenAI, Google Gemini and Anthropic Claude. It exposes a common client abstraction so your application code can swap providers without rewriting business logic.

## Features

- Consistent `AiClient` interface across providers
- Built‑in error handling with descriptive error types
- Optional parallel execution and response summarisation helpers
- TypeScript definitions out of the box

## Installation

```bash
npm install chatdelta
```

The library targets modern Node runtimes (ES2020). Type declarations are bundled so it works in both JavaScript and TypeScript projects.

## Usage

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

## Configuration

`createClient` accepts an optional `ClientConfig` allowing control over timeouts, retries, temperature and token limits. See `src/types.ts` for the full interface.

## Contributing

Bug reports and pull requests are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our process.

## License

This project is released under the [MIT License](LICENSE).
