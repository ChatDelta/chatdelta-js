#!/usr/bin/env node

import { Command } from 'commander';
import { 
  createClient, 
  executeParallel, 
  generateSummary, 
  ClientConfigBuilder, 
  ClientError, 
  AiClient 
} from './index';

interface CliOptions {
  only?: string[];
  exclude?: string[];
  noSummary?: boolean;
  format?: 'text' | 'json' | 'markdown';
  timeout?: number;
  retries?: number;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemMessage?: string;
  test?: boolean;
  gptModel?: string;
  claudeModel?: string;
  geminiModel?: string;
}

const defaultModels = {
  openai: 'gpt-4o',
  claude: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-pro-latest'
};

async function testConnection(provider: string, apiKey: string, model: string): Promise<boolean> {
  try {
    const config = ClientConfigBuilder.builder()
      .timeout(10000)
      .maxTokens(10)
      .build();
    
    const client = createClient(provider, apiKey, model, config);
    await client.sendPrompt('Hello');
    return true;
  } catch (error) {
    return false;
  }
}

async function testAllConnections(): Promise<void> {
  const tests = [
    { provider: 'openai', envVar: 'OPENAI_API_KEY', model: defaultModels.openai },
    { provider: 'claude', envVar: 'ANTHROPIC_API_KEY', model: defaultModels.claude },
    { provider: 'gemini', envVar: 'GEMINI_API_KEY', model: defaultModels.gemini }
  ];

  console.log('Testing API connections...\n');

  for (const { provider, envVar, model } of tests) {
    const apiKey = process.env[envVar];
    if (!apiKey) {
      console.log(`❌ ${provider}: No API key found (${envVar})`);
      continue;
    }

    const isConnected = await testConnection(provider, apiKey, model);
    console.log(`${isConnected ? '✅' : '❌'} ${provider}: ${isConnected ? 'Connected' : 'Failed'}`);
  }
}

function getAvailableClients(options: CliOptions): AiClient[] {
  const clients: AiClient[] = [];
  const configBuilder = ClientConfigBuilder.builder();

  if (options.timeout) configBuilder.timeout(options.timeout);
  if (options.retries) configBuilder.retries(options.retries);
  if (options.temperature) configBuilder.temperature(options.temperature);
  if (options.maxTokens) configBuilder.maxTokens(options.maxTokens);
  if (options.topP) configBuilder.topP(options.topP);
  if (options.frequencyPenalty) configBuilder.frequencyPenalty(options.frequencyPenalty);
  if (options.presencePenalty) configBuilder.presencePenalty(options.presencePenalty);
  if (options.systemMessage) configBuilder.systemMessage(options.systemMessage);

  const config = configBuilder.build();

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && !options.exclude?.includes('openai') && !options.exclude?.includes('gpt')) {
    if (!options.only || options.only.includes('openai') || options.only.includes('gpt')) {
      const model = options.gptModel || defaultModels.openai;
      clients.push(createClient('openai', openaiKey, model, config));
    }
  }

  // Claude
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  if (claudeKey && !options.exclude?.includes('claude') && !options.exclude?.includes('anthropic')) {
    if (!options.only || options.only.includes('claude') || options.only.includes('anthropic')) {
      const model = options.claudeModel || defaultModels.claude;
      clients.push(createClient('claude', claudeKey, model, config));
    }
  }

  // Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && !options.exclude?.includes('gemini') && !options.exclude?.includes('google')) {
    if (!options.only || options.only.includes('gemini') || options.only.includes('google')) {
      const model = options.geminiModel || defaultModels.gemini;
      clients.push(createClient('gemini', geminiKey, model, config));
    }
  }

  return clients;
}

function formatResults(results: Array<{ name: string; result: string | ClientError }>, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(results.map(r => ({
        provider: r.name,
        success: !(r.result instanceof ClientError),
        response: r.result instanceof ClientError ? r.result.message : r.result,
        error: r.result instanceof ClientError ? r.result.type : undefined
      })), null, 2);

    case 'markdown':
      let md = '# AI Model Responses\n\n';
      for (const { name, result } of results) {
        md += `## ${name}\n\n`;
        if (result instanceof ClientError) {
          md += `**Error:** ${result.message}\n\n`;
        } else {
          md += `${result}\n\n`;
        }
      }
      return md;

    default: // text
      let output = '';
      for (const { name, result } of results) {
        output += `=== ${name} ===\n`;
        if (result instanceof ClientError) {
          output += `Error: ${result.message}\n`;
        } else {
          output += `${result}\n`;
        }
        output += '\n';
      }
      return output;
  }
}

async function main() {
  const program = new Command();

  program
    .name('chatdelta')
    .description('Query multiple AI APIs and compare responses')
    .version('0.2.0')
    .argument('[prompt]', 'The prompt to send to AI models')
    .option('--only <providers...>', 'Only query specific providers (openai, claude, gemini)')
    .option('--exclude <providers...>', 'Exclude specific providers')
    .option('--no-summary', 'Skip generating summary of responses')
    .option('--format <format>', 'Output format (text, json, markdown)', 'text')
    .option('--timeout <ms>', 'Request timeout in milliseconds', parseInt)
    .option('--retries <count>', 'Number of retry attempts', parseInt)
    .option('--temperature <temp>', 'AI model temperature (0.0-2.0)', parseFloat)
    .option('--max-tokens <tokens>', 'Maximum tokens to generate', parseInt)
    .option('--top-p <p>', 'Top-p sampling parameter', parseFloat)
    .option('--frequency-penalty <penalty>', 'Frequency penalty', parseFloat)
    .option('--presence-penalty <penalty>', 'Presence penalty', parseFloat)
    .option('--system-message <message>', 'System message for AI models')
    .option('--test', 'Test API connections and exit')
    .option('--gpt-model <model>', 'Specific GPT model to use')
    .option('--claude-model <model>', 'Specific Claude model to use')
    .option('--gemini-model <model>', 'Specific Gemini model to use');

  program.parse();

  const options = program.opts<CliOptions>();
  const prompt = program.args[0];

  if (options.test) {
    await testAllConnections();
    return;
  }

  if (!prompt) {
    console.error('Error: Please provide a prompt');
    process.exit(1);
  }

  const clients = getAvailableClients(options);

  if (clients.length === 0) {
    console.error('Error: No AI clients available. Please set API keys in environment variables:');
    console.error('  OPENAI_API_KEY for OpenAI/ChatGPT');
    console.error('  ANTHROPIC_API_KEY for Claude');
    console.error('  GEMINI_API_KEY for Google Gemini');
    process.exit(1);
  }

  try {
    console.error(`Querying ${clients.length} AI provider${clients.length > 1 ? 's' : ''}...`);
    
    const results = await executeParallel(clients, prompt);
    const successfulResults = results.filter(r => !(r.result instanceof ClientError));

    console.log(formatResults(results, options.format || 'text'));

    if (!options.noSummary && successfulResults.length > 1) {
      console.log(options.format === 'markdown' ? '## Summary\n' : '=== Summary ===\n');
      
      const summaryClient = clients[0]; // Use first available client for summary
      const summary = await generateSummary(
        summaryClient,
        successfulResults.map(r => ({ name: r.name, response: r.result as string }))
      );
      
      console.log(summary);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };