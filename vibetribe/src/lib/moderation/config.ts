/**
 * Moderation configuration. Edit these lists to tune the rules; no code changes needed elsewhere.
 * Matching is case-insensitive, tolerant of letter repetition ("fuuuck") and simple leetspeak.
 *
 * Policy summary
 *  - HARD terms / threats  -> always blocked, counts as a strike.
 *  - TARGETED insults      -> only when aimed at another person ("you", "ur", "tum"...).
 *                             Context-sensitive, so the LLM decides. If the LLM is unavailable,
 *                             only the STRONG list is blocked (without a strike); the rest is allowed.
 *  - Sports banter ("murdered them", "this bowler is trash", "kill the game") is NOT abuse.
 */
export const MODERATION_CONFIG = {
  maxLength: 500,
  maxStrikes: 3,
  /** LLM must be at least this confident before a strike is recorded. */
  llmConfidenceThreshold: 0.85,

  /** Always blocked (slurs and severe direct abuse). Extend for your audience/languages. */
  hardTerms: [
    'motherfucker', 'fuck you', 'fuck off', 'fuck your', 'cunt', 'retard', 'retarded',
    'son of a bitch', 'piece of shit',
    'madarchod', 'bhenchod', 'behenchod', 'bhosdike', 'chutiya', 'chutiye', 'gandu', 'haramkhor',
  ],

  /** Blocked when aimed at a person, even if the LLM is down. */
  strongInsults: ['bastard', 'bitch', 'asshole', 'dickhead', 'scumbag'],

  /** Only judged by the LLM when aimed at a person. Never blocked on their own. */
  softInsults: [
    'idiot', 'stupid', 'moron', 'loser', 'clown', 'trash', 'dumb', 'useless', 'garbage',
    'pathetic', 'joker', 'shit', 'bakwas',
  ],

  /** Words that, near "you", are a possible (but maybe jokey) threat. LLM decides. */
  threatWords: ['kill', 'murder', 'hurt', 'beat', 'destroy', 'die', 'dead', 'stab', 'shoot'],

  /** Clear, unambiguous threats (always blocked). */
  threatPatterns: [
    /\b(i|we)\s*('?ll|will|am going to|'?m going to|'?m gonna|gonna)\s+(kill|murder|stab|shoot|rape|hurt|find)\s+(you|u|ur|your)\b/i,
    /\b(kill|murder|stab|shoot|hang)\s+(yourself|urself|ur family|your family)\b/i,
    /\b(i|we)\s+know\s+where\s+(you|u)\s+live\b/i,
    /\bhope\s+(you|u)\s+(die|get\s+killed|get\s+hit\s+by)\b/i,
    /\bkys\b/i,
  ],

  /** Second-person words that indicate a message is aimed at someone. */
  secondPerson: ['you', 'u', 'ur', 'your', 'youre', 'yourself', 'urself', 'tum', 'tu', 'tera', 'teri', 'tumhara', 'aap'],
};

/** Extra always-block terms from env (comma separated). */
export function extraBlocklist(): string[] {
  return (process.env.MODERATION_EXTRA_BLOCKLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
