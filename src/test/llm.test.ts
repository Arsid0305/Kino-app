import { describe, it, expect, vi } from 'vitest';
import {
  callWithFallback, callProvider, claudeText, openAIText, LlmError, MAX_TOKENS,
  type LlmRequest, type Provider,
} from '../../supabase/functions/_shared/llm';

const req: LlmRequest = { system: 's', messages: [{ role: 'user', content: 'q' }], temperature: 1, json: true };
const allKeys = (n: string) => (n.endsWith('_API_KEY') ? 'k' : undefined);

describe('claudeText', () => {
  it('берёт текст только из блоков text, пропуская thinking', () => {
    expect(claudeText({ content: [{ type: 'thinking' }, { type: 'text', text: ' ok ' }], stop_reason: 'end_turn' })).toBe('ok');
  });
  it('refusal, max_tokens и пустой текст — ошибка', () => {
    expect(() => claudeText({ content: [{ type: 'text', text: 'x' }], stop_reason: 'refusal' })).toThrow(LlmError);
    expect(() => claudeText({ content: [{ type: 'text', text: 'x' }], stop_reason: 'max_tokens' })).toThrow(LlmError);
    expect(() => claudeText({ content: [{ type: 'thinking' }], stop_reason: 'end_turn' })).toThrow(LlmError);
  });
});

describe('openAIText', () => {
  it('null content, refusal и length — ошибка', () => {
    expect(() => openAIText({ choices: [{ message: { content: null } }] })).toThrow(LlmError);
    expect(() => openAIText({ choices: [{ message: { content: 'x', refusal: 'no' } }] })).toThrow(LlmError);
    expect(() => openAIText({ choices: [{ message: { content: 'x' }, finish_reason: 'length' }] })).toThrow(LlmError);
    expect(openAIText({ choices: [{ message: { content: ' a ' }, finish_reason: 'stop' }] })).toBe('a');
  });
});

describe('callProvider: параметры запроса', () => {
  const capture = async (p: Provider) => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(
      p === 'claude' ? { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' }
        : p === 'gemini' ? { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }
        : { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] },
    )));
    await callProvider(p, req, allKeys, 1000, fetchFn as unknown as typeof fetch);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    return { url, body: JSON.parse(init.body as string), headers: init.headers as Record<string, string> };
  };
  it('Claude: новый ID, без temperature, лимит 16000', async () => {
    const { body } = await capture('claude');
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.temperature).toBeUndefined();
    expect(body.max_tokens).toBe(MAX_TOKENS);
  });
  it('OpenAI: max_completion_tokens, без temperature', async () => {
    const { body } = await capture('gpt4o');
    expect(body.model).toBe('gpt-6-luna');
    expect(body.max_completion_tokens).toBe(MAX_TOKENS);
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
  });
  it('DeepSeek и Gemini: новые ID, temperature передаётся', async () => {
    const ds = await capture('deepseek');
    expect(ds.body.model).toBe('deepseek-v4-flash');
    expect(ds.body.temperature).toBe(1);
    const g = await capture('gemini');
    expect(g.url).toContain('gemini-3.6-flash');
    expect(g.url).not.toContain('key=');
    expect(g.headers['x-goog-api-key']).toBe('k');
    expect(g.body.generationConfig.maxOutputTokens).toBe(MAX_TOKENS);
  });
});

describe('callWithFallback', () => {
  it('выбранный — две попытки, затем deepseek → gpt4o → gemini → claude', async () => {
    const order: Provider[] = [];
    const call = vi.fn(async (p: Provider) => { order.push(p); throw new LlmError('fail'); });
    await expect(callWithFallback('gemini', req, allKeys, x => x, call)).rejects.toThrow(LlmError);
    expect(order).toEqual(['gemini', 'gemini', 'deepseek', 'gpt4o', 'claude']);
  });
  it('один живой ключ достаточен; провайдер без ключа пропускается', async () => {
    const env = (n: string) => (n === 'OPENAI_API_KEY' ? 'k' : undefined);
    const call = vi.fn(async () => 'ok');
    const r = await callWithFallback('claude', req, env, x => x, call);
    expect(r.provider).toBe('gpt4o');
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('ошибка parse ведёт к следующему провайдеру', async () => {
    const call = vi.fn(async (p: Provider) => (p === 'deepseek' ? 'good' : 'bad'));
    const parse = (s: string) => { if (s !== 'good') throw new Error('json'); return s; };
    const r = await callWithFallback('gpt4o', req, allKeys, parse, call);
    expect(r).toEqual({ result: 'good', provider: 'deepseek' });
  });
  it('общий бюджет времени обрывает цепочку', async () => {
    let t = 0;
    const call = vi.fn(async () => { t += 100_000; throw new LlmError('slow'); });
    await expect(callWithFallback('gpt4o', req, allKeys, x => x, call, () => t)).rejects.toThrow(LlmError);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
