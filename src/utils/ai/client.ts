import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export class MissingApiKeyError extends Error {
  constructor() {
    super('Anthropic API key not configured');
    this.name = 'MissingApiKeyError';
  }
}

export function getClient(apiKey: string): Anthropic {
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
}

// Extracts a JSON object/array from a Claude response. Claude sometimes wraps
// JSON in markdown fences even when asked not to; strip those before parsing.
export function extractJson<T = unknown>(text: string): T {
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return JSON.parse(trimmed) as T;
}

// Extracts plain text from a Messages API response.
export function responseText(response: Anthropic.Message): string {
  return response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('');
}
