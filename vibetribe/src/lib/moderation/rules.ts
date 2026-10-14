import { MODERATION_CONFIG as C, extraBlocklist } from './config';

// ---------- helpers ----------
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "fuck you" -> /\bf+u+c+k+\s+y+o+u+\b/ : tolerates repeated letters and variable spacing. */
function termRegex(term: string): RegExp {
  const body = term
    .toLowerCase()
    .split(/\s+/)
    .map((word) => [...word].map((ch) => (/[a-z]/.test(ch) ? `${ch}+` : escape(ch))).join(''))
    .join('[\\s._-]*');
  return new RegExp(`\\b${body}\\b`, 'i');
}
const compile = (terms: string[]) => terms.map(termRegex);

/** Lowercase + undo simple leetspeak only when the symbol sits between letters ("b1tch", "a$$hole"). */
export function normalize(text: string): string {
  const map: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '$': 's', '@': 'a', '!': 'i' };
  return text
    .toLowerCase()
    .replace(/(?<=[a-z])[01345$@!](?=[a-z])/g, (c) => map[c] ?? c)
    // join letters spaced out to dodge filters: "f u c k" -> "fuck" (needs 3+ single letters in a row)
    .replace(/\b(?:[a-z][\s._-]+){2,}[a-z]\b/g, (run) => run.replace(/[\s._-]+/g, ''));
}

const hard = () => compile([...C.hardTerms, ...extraBlocklist()]);
const strong = compile(C.strongInsults);
const soft = compile(C.softInsults);
const hardRegexes = compile(C.hardTerms);

const secondPersonRe = new RegExp(`\\b(${C.secondPerson.map(escape).join('|')})\\b`, 'i');
const threatNearYouRe = new RegExp(
  `\\b(${C.threatWords.join('|')})\\w*\\b.{0,25}\\b(you|u|ur|your|youre)\\b|\\b(you|u|ur|your|youre)\\b.{0,25}\\b(${C.threatWords.join('|')})\\w*\\b`,
  'i'
);

// ---------- validation ----------
export type Validation = { ok: true; text: string } | { ok: false; reason: string };

export function validateMessage(raw: unknown): Validation {
  if (typeof raw !== 'string') return { ok: false, reason: 'Message must be text.' };
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!text) return { ok: false, reason: 'Type a message first.' };
  if (text.length > C.maxLength) return { ok: false, reason: `Messages can be at most ${C.maxLength} characters.` };
  if ((text.match(/\n/g) ?? []).length > 6) return { ok: false, reason: 'Please keep messages to a few lines.' };
  return { ok: true, text };
}

// ---------- personal information ----------
export type PiiKind = 'email' | 'phone' | 'id_number' | 'contact_link';

const PII_PATTERNS: Array<[PiiKind, RegExp]> = [
  ['email', /[a-z0-9._%+-]+\s?@\s?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i],
  ['email', /\b[\w.+-]+\s*(\(|\[)?\s*at\s*(\)|\])?\s*[\w-]+\s*(\(|\[)?\s*dot\s*(\)|\])?\s*(com|in|net|org|co)\b/i],
  // Indian mobiles, with or without +91 / spaces / dashes
  ['phone', /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/],
  // International numbers written with a country code
  ['phone', /\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/],
  // 10+ consecutive digits (not scores, which are short)
  ['phone', /\b\d{10,}\b/],
  ['id_number', /\b\d{4}\s\d{4}\s\d{4}\b/],
  ['contact_link', /\b(wa\.me|t\.me|chat\.whatsapp\.com|telegram\.me)\b/i],
];

/** Returns the KINDS of personal info found, never the matched text (so logs can't leak it). */
export function detectPii(text: string): PiiKind[] {
  const found = new Set<PiiKind>();
  for (const [kind, re] of PII_PATTERNS) if (re.test(text)) found.add(kind);
  return [...found];
}

export const PII_LABEL: Record<PiiKind, string> = {
  email: 'an email address',
  phone: 'a phone number',
  id_number: 'an ID-style number',
  contact_link: 'a private-chat link',
};

// ---------- abuse ----------
export type AbuseLevel = 'none' | 'hard' | 'threat' | 'targeted_strong' | 'targeted_soft';
export type AbuseCheck = { level: AbuseLevel; detail: string };

export function checkAbuse(text: string): AbuseCheck {
  const t = normalize(text);

  for (const re of C.threatPatterns) if (re.test(t)) return { level: 'threat', detail: 'clear threat pattern' };
  if (hard().some((re) => re.test(t))) return { level: 'hard', detail: 'blocked term' };

  const aimed = secondPersonRe.test(t);
  if (aimed && strong.some((re) => re.test(t))) return { level: 'targeted_strong', detail: 'insult aimed at a person' };
  if (aimed && (soft.some((re) => re.test(t)) || threatNearYouRe.test(t)))
    return { level: 'targeted_soft', detail: 'possible insult/threat aimed at a person' };
  return { level: 'none', detail: '' };
}

/** Used for room names, descriptions and display names (no LLM). Returns a problem or null. */
export function checkPublicText(text: string): string | null {
  if (detectPii(text).length) return 'Please remove personal contact details.';
  const a = checkAbuse(text);
  if (a.level === 'hard' || a.level === 'threat') return 'Please keep names and descriptions respectful.';
  if (strong.some((re) => re.test(normalize(text))) || hardRegexes.some((re) => re.test(normalize(text))))
    return 'Please keep names and descriptions respectful.';
  return null;
}
