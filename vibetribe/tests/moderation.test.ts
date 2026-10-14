import { describe, it, expect } from 'vitest';
import { moderateMessage } from '@/lib/moderation/pipeline';
import { detectPii, checkAbuse, validateMessage, checkPublicText } from '@/lib/moderation/rules';
import { fallbackSummary, pseudonymise } from '@/lib/catchup';

describe('validation', () => {
  it('rejects empty and too long', () => {
    expect(validateMessage('   ').ok).toBe(false);
    expect(validateMessage('a'.repeat(501)).ok).toBe(false);
    expect(validateMessage(42 as unknown).ok).toBe(false);
    expect(validateMessage('What a six!').ok).toBe(true);
  });
});

describe('personal information', () => {
  it.each([
    ['mail me at fan123@gmail.com', 'email'],
    ['fan123 at gmail dot com', 'email'],
    ['call 9876543210 now', 'phone'],
    ['+91 98765 43210', 'phone'],
    ['my number is 98765-43210', 'phone'],
    ['wa.me/919876543210', 'contact_link'],
  ])('flags %s', (msg, kind) => {
    expect(detectPii(msg)).toContain(kind);
  });
  it.each(['Score is 287/4 after 45.2 overs', 'Kohli 100 off 52, SR 192.3', 'Over 19.4: 2024 vs 2011 final?', 'India need 30 off 16'])(
    'does not flag cricket stats: %s',
    (msg) => expect(detectPii(msg)).toEqual([])
  );
  it('never echoes the matched value', async () => {
    const r = await moderateMessage('email me fan123@gmail.com');
    expect(r.decision).toBe('block');
    expect(r.category).toBe('pii');
    expect(JSON.stringify(r)).not.toContain('fan123');
    expect(r.countsAsStrike).toBe(false);
  });
});

describe('abuse rules', () => {
  it('blocks hard terms and clear threats with a strike', async () => {
    for (const m of ['fuck you all', 'f u c k you', 'fuuuck off', 'I will kill you', 'kys', 'you chutiya']) {
      const r = await moderateMessage(m);
      expect(r.decision, m).toBe('block');
      expect(r.countsAsStrike, m).toBe(true);
    }
  });
  it('catches leetspeak', () => {
    expect(checkAbuse('you b1tch').level).not.toBe('none');
  });
  it('allows ordinary sports banter', async () => {
    for (const m of [
      'India murdered them today 🔥',
      'This bowler is trash tonight',
      'Ref is blind, that was never a foul',
      'Captain made a stupid call, should have used the spinner',
      'What a kill of a catch!',
      'Absolute shit decision by the umpire',
      'Class performance from the keeper',
    ]) {
      const r = await moderateMessage(m);
      expect(r.decision, m).toBe('allow');
    }
  });
});

describe('LLM-assisted ambiguity', () => {
  const abusive = async () => ({ verdict: 'abusive' as const, confidence: 0.95 });
  const unsure = async () => ({ verdict: 'abusive' as const, confidence: 0.6 });
  const banter = async () => ({ verdict: 'banter' as const, confidence: 0.9 });
  const boom = async () => { throw new Error('down'); };

  it('does not call the LLM for clean messages', async () => {
    let calls = 0;
    await moderateMessage('great innings', async () => { calls++; return null; });
    expect(calls).toBe(0);
  });
  it('blocks + strikes on confident abusive verdict', async () => {
    const r = await moderateMessage('you are a clown and a loser', abusive);
    expect(r.decision).toBe('block');
    expect(r.countsAsStrike).toBe(true);
    expect(r.source).toBe('llm');
  });
  it('allows low-confidence verdicts', async () => {
    expect((await moderateMessage('you are a clown', unsure)).decision).toBe('allow');
  });
  it('allows banter verdicts', async () => {
    expect((await moderateMessage('I will destroy you in fantasy this week', banter)).decision).toBe('allow');
  });
  it('falls back conservatively when the LLM fails', async () => {
    const soft = await moderateMessage('you clown', boom);
    expect(soft.decision).toBe('allow');
    const strong = await moderateMessage('you bastard', boom);
    expect(strong.decision).toBe('block');
    expect(strong.countsAsStrike).toBe(false);
    expect(strong.source).toBe('fallback');
  });
  it('works with no classifier at all', async () => {
    expect((await moderateMessage('you clown')).decision).toBe('allow');
  });
});

describe('public text (room names, display names)', () => {
  it('rejects PII and abuse, accepts normal names', () => {
    expect(checkPublicText('call 9876543210')).not.toBeNull();
    expect(checkPublicText('fuck you refs')).not.toBeNull();
    expect(checkPublicText('Matchday banter')).toBeNull();
  });
});

describe('catch-up helpers', () => {
  it('pseudonymises senders consistently', () => {
    const out = pseudonymise([{ key: 'u1', body: 'a' }, { key: 'u2', body: 'b' }, { key: 'u1', body: 'c' }]);
    expect(out.map((m) => m.who)).toEqual(['Fan A', 'Fan B', 'Fan A']);
  });
  it('fallback summary is grounded in the messages', () => {
    const s = fallbackSummary([
      { who: 'Fan A', body: 'Great six 🔥' },
      { who: 'Fan B', body: 'Who bowls the last over?' },
    ]);
    expect(s.open_questions[0]).toContain('last over');
    expect(s.reactions[0]).toContain('🔥');
  });
});
