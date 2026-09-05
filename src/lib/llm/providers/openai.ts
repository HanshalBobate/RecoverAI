import type { LLMProvider, PaymentContext, LLMRecommendation } from '../types.ts';
import { buildSystemPrompt, buildUserPrompt } from '../context.ts';
import { validateLLMOutput } from '../validator.ts';

/**
 * OPENAI LLM PROVIDER
 *
 * Connects to OpenAI Chat Completions API with native JSON object formatting.
 * Security: API key is strictly evaluated server-side and never exposed.
 */
export class OpenAILLMProvider implements LLMProvider {
  readonly providerType = 'openai' as const;
  readonly modelName: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async analyzePayment(context: PaymentContext): Promise<LLMRecommendation> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('OpenAI API key missing. Configure OPENAI_API_KEY in server environment.');
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    const payload = {
      model: this.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('aborted') || errorMsg.includes('timeout')) {
        throw new Error('OpenAI API request timed out after 8s');
      }
      throw new Error(`OpenAI network connection failed: ${errorMsg}`);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('OpenAI authorization failed: invalid or expired API key');
      }
      if (response.status === 429) {
        throw new Error('OpenAI rate limit or quota exceeded');
      }
      throw new Error(`OpenAI API request returned HTTP error ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response returned empty choice content');
    }

    const validation = validateLLMOutput(content);
    if (!validation.valid || !validation.recommendation) {
      throw new Error(`OpenAI output validation error: ${validation.error || 'Invalid format'}`);
    }

    return validation.recommendation;
  }
}
