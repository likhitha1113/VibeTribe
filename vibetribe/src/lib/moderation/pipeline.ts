import { MODERATION_CONFIG as C } from './config';
import { PII_LABEL, checkAbuse, detectPii, validateMessage } from './rules';

export type ModerationCategory = 'ok' | 'invalid' | 'pii' | 'abuse' | 'threat';
export type ModerationSource = 'validation' | 'rules' | 'llm' | 'fallback';

export type ModerationResult = {
  decision: 'allow' | 'block';
  category: ModerationCategory;
  source: ModerationSource;
  /** Machine-readable reason, safe to store (never contains message text or PII). */
  reason: string;
  /** Friendly explanation shown to the sender. */
  userMessage: string;
  countsAsStrike: boolean;
  /** Cleaned text to publish when decision === 'allow'. */
  text: string;
};

export type LlmVerdict = { verdict: 'abusive' | 'threat' | 'banter' | 'ok'; confidence: number } | null;
export type Classifier = (text: string) => Promise<LlmVerdict>;

const allow = (text: string, source: ModerationSource, reason: string): ModerationResult => ({
  decision: 'allow', category: 'ok', source, reason, userMessage: '', countsAsStrike: false, text,
});

/**
 * Moderation pipeline (runs on the server before anything is stored):
 *  1. validate  2. personal info  3. deterministic abuse rules  4. LLM only for ambiguous cases.
 * The classifier is injected so the pipeline works (and is testable) with no LLM at all.
 */
export async function moderateMessage(raw: unknown, classify?: Classifier): Promise<ModerationResult> {
  // 1. validation
  const v = validateMessage(raw);
  if (!v.ok)
    return { decision: 'block', category: 'invalid', source: 'validation', reason: 'invalid_input', userMessage: v.reason, countsAsStrike: false, text: '' };
  const text = v.text;

  // 2. personal information (no strike: sharing details is usually a mistake, not malice)
  const pii = detectPii(text);
  if (pii.length) {
    const what = pii.map((k) => PII_LABEL[k]).join(' and ');
    return {
      decision: 'block', category: 'pii', source: 'rules', reason: `pii:${pii.join(',')}`,
      userMessage: `This message looks like it contains ${what}. Remove it to keep everyone in the room safe, then send again.`,
      countsAsStrike: false, text: '',
    };
  }

  // 3. deterministic abuse rules
  const abuse = checkAbuse(text);
  if (abuse.level === 'threat' || abuse.level === 'hard') {
    return {
      decision: 'block', category: abuse.level === 'threat' ? 'threat' : 'abuse', source: 'rules',
      reason: `rule:${abuse.level}`,
      userMessage: abuse.level === 'threat'
        ? 'Threats are not allowed in VibeTribe rooms.'
        : 'That message breaks the community guidelines. Debate the play, not the person.',
      countsAsStrike: true, text: '',
    };
  }
  if (abuse.level === 'none') return allow(text, 'rules', 'clean');

  // 4. ambiguous: ask the LLM, fall back conservatively
  let verdict: LlmVerdict = null;
  if (classify) {
    try { verdict = await classify(text); } catch { verdict = null; }
  }

  if (verdict) {
    if ((verdict.verdict === 'abusive' || verdict.verdict === 'threat') && verdict.confidence >= C.llmConfidenceThreshold) {
      return {
        decision: 'block', category: verdict.verdict === 'threat' ? 'threat' : 'abuse', source: 'llm',
        reason: `llm:${verdict.verdict}:${verdict.confidence.toFixed(2)}`,
        userMessage: 'That reads as a personal attack. Keep the banter about the match, not the person.',
        countsAsStrike: true, text: '',
      };
    }
    // banter / ok / low confidence => allow (conservative: never punish on an unsure AI call)
    return allow(text, 'llm', `llm:${verdict.verdict}:${verdict.confidence.toFixed(2)}`);
  }

  // LLM unavailable: only block the strong-insult list, and never with a strike
  if (abuse.level === 'targeted_strong') {
    return {
      decision: 'block', category: 'abuse', source: 'fallback', reason: 'fallback:targeted_strong',
      userMessage: 'This might come across as a personal insult. Please rephrase and send again (no strike added).',
      countsAsStrike: false, text: '',
    };
  }
  return allow(text, 'fallback', 'fallback:allowed_uncertain');
}
