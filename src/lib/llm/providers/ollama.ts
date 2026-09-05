import type { LLMProvider, PaymentContext, LLMRecommendation } from '../types.ts';
import { buildSystemPrompt, buildUserPrompt } from '../context.ts';
import { validateLLMOutput } from '../validator.ts';

/**
 * OLLAMA LOCAL LLM PROVIDER
 *
 * Connects to local or remote Ollama server via standard REST HTTP API.
 * Uses native JSON output enforcement (`format: "json"`).
 * Gracefully reports connection drops, model absences, and timeouts.
 */
export class OllamaLLMProvider implements LLMProvider {
  readonly providerType = 'ollama' as const;
  readonly baseUrl: string;
  readonly modelName: string;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/+$/, '');
    this.modelName = process.env.OLLAMA_MODEL || 'llama3.2';
  }

  async analyzePayment(context: PaymentContext): Promise<LLMRecommendation> {
    const endpoint = `${this.baseUrl}/api/chat`;
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    const payload = {
      model: this.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.1, // Low temperature for high determinism
      },
    };

    let response: Response;
    try {
      // 8 second timeout boundary for local LLM inference
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('aborted') || errorMsg.includes('timeout')) {
        throw new Error(`Ollama request timed out after 8s connecting to ${this.baseUrl}`);
      }
      throw new Error(`Ollama connection failed (${this.baseUrl}): ${errorMsg}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 404) {
        throw new Error(
          `Ollama model '${this.modelName}' not found on ${this.baseUrl}. Run 'ollama pull ${this.modelName}'.`
        );
      }
      throw new Error(`Ollama API error (HTTP ${response.status}): ${errorText || response.statusText}`);
    }

    const json = (await response.json()) as { message?: { content?: string } };
    const content = json.message?.content;
    if (!content) {
      throw new Error('Ollama response contained empty content body');
    }

    const validation = validateLLMOutput(content);
    if (!validation.valid || !validation.recommendation) {
      throw new Error(`Ollama response schema validation failed: ${validation.error || 'Invalid format'}`);
    }

    return validation.recommendation;
  }
}
