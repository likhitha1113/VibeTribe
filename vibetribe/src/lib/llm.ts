import 'server-only';

/**
 * Minimal provider-agnostic LLM client (server only, plain fetch, no SDK).
 * Provider chosen by LLM_PROVIDER = gemini | anthropic.
 */
export function isLlmConfigured(): boolean {
  const p = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  return p === 'anthropic' ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(process.env.GEMINI_API_KEY);
}

export class LlmError extends Error {}

export async function callLlmJson(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const { system, user, maxTokens = 1024, timeoutMs = 12000 } = opts;
  if (!isLlmConfigured()) throw new LlmError('LLM not configured');
  const provider = (process.env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    let text = '';
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
          max_tokens: maxTokens,
          temperature: 0.2,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw new LlmError(`Anthropic HTTP ${res.status}`);
      const json = await res.json();
      text = json?.content?.find((c: { type: string }) => c.type === 'text')?.text ?? '';
    } else {
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: Math.max(maxTokens, 2048), responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) throw new LlmError(`Gemini HTTP ${res.status}`);
      const json = await res.json();
      text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    }
    return parseJsonLoose(text);
  } catch (e) {
    if (e instanceof LlmError) throw e;
    throw new LlmError(e instanceof Error ? e.message : 'LLM request failed');
  } finally {
    clearTimeout(timer);
  }
}

export function parseJsonLoose(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new LlmError('LLM returned non-JSON output');
  }
}
