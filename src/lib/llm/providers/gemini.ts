import type { LLMProvider, PaymentContext, LLMRecommendation } from '../types.ts';
import { buildSystemPrompt, buildUserPrompt } from '../context.ts';
import { validateLLMOutput } from '../validator.ts';

/**
 * GOOGLE GEMINI LLM PROVIDER
 *
 * Connects to Google Gemini REST API using structured JSON output.
 * Security: API key is isolated server-side and never returned in API responses.
 */
export class GeminiLLMProvider implements LLMProvider {
  readonly providerType = 'gemini' as const;
  readonly modelName: string;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  async analyzePayment(context: PaymentContext): Promise<LLMRecommendation> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error('Gemini API key missing. Configure GEMINI_API_KEY in server environment.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(
      this.apiKey
    )}`;

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    let response: Response;
    try {
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
        throw new Error('Gemini API request timed out after 8s');
      }
      throw new Error(`Gemini network connection failed: ${errorMsg}`);
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) {
        throw new Error('Gemini API authentication failed: invalid API key or model access');
      }
      if (response.status === 429) {
        throw new Error('Gemini rate limit or quota exceeded');
      }
      throw new Error(`Gemini API returned HTTP error ${response.status}`);
    }

    const json = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini response returned empty candidate parts');
    }

    const validation = validateLLMOutput(text);
    if (!validation.valid || !validation.recommendation) {
      throw new Error(`Gemini response schema validation failed: ${validation.error || 'Invalid format'}`);
    }

    return validation.recommendation;
  }
}
