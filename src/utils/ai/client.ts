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

// Extracts a JSON object/array from a Claude response. First tries the whole
// trimmed text (the common case when the model cleanly emits JSON), strips
// markdown fences if present, then falls back to grabbing the first {...} or
// [...] block anywhere in the text — which handles the case where the model
// prefixes a short preamble despite the system prompt.
export function extractJson<T = unknown>(text: string): T {
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!match) throw new Error('No JSON object or array found in response');
    return JSON.parse(match[0]) as T;
  }
}

// Extracts plain text from a Messages API response.
export function responseText(response: Anthropic.Message): string {
  return response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('');
}
