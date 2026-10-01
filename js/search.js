/* Shared, synonym-aware search matching -- used by the Check-symptoms
 * complaint picker, Conditions A-Z, Symptoms A-Z, and Investigations, so
 * "shoulder pain", "backache" and "back pain" all find the same thing
 * regardless of which tab you typed it into.
 *
 * This app is static JSON with no backend, so there's no database full-text
 * index (no Postgres ts_vector) to lean on. This is the client-side
 * equivalent: normalise words to a canonical form (fold plurals, fold a
 * short list of lay/clinical equivalents like ache<->pain), then match if
 * every word in the query appears -- in normalised form, in any order --
 * somewhere in the target's searchable text. A raw substring match is tried
 * first and always wins when it hits, so exact phrases and ICD-10 codes
 * still match exactly as before; the normalised pass is what catches
 * "backache" against a target that only says "back pain".
 *
 * Deliberately NOT a fuzzy/edit-distance matcher -- misspelling tolerance
 * trades precision for recall in a symptom checker, and a wrong-condition
 * suggestion here is a worse failure than a missed one. Stick to word-level
 * normalisation and an explicit, reviewed equivalence list. */

// word -> canonical form. Keep this list narrow and reviewed, same
// discipline as AMBIGUOUS_WORD_EXCLUDE in ui.js -- each entry should be an
// unambiguous lay/clinical synonym pair, not a loose association.
const WORD_EQUIVALENTS = {
  // ache/pain/sore family
  ache: 'pain', aches: 'pain', aching: 'pain', achy: 'pain', achey: 'pain',
  pain: 'pain', pains: 'pain', painful: 'pain',
  sore: 'pain', soreness: 'pain', sorely: 'pain',
  hurts: 'pain', hurting: 'pain', hurt: 'pain',
  // stomach/abdomen family
  tummy: 'stomach', belly: 'stomach', abdomen: 'stomach', abdominal: 'stomach',
  gut: 'stomach', gastric: 'stomach',
  // common body-region wording
  tum: 'stomach',
};

// Compound lay words that a plain tokenizer would treat as one opaque word
// (so "backache" would never match "back pain") -- split to their parts
// before normalising. Only include ones actually in everyday use here;
// "headache" and "earache" are already their own dedicated entries in the
// data and don't need splitting.
const COMPOUND_SPLITS = {
  backache: 'back ache',
  backaches: 'back ache',
  stomachache: 'stomach ache',
  stomachaches: 'stomach ache',
  toothache: 'tooth ache',
  toothaches: 'tooth ache',
};

function foldPlural(word) {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function normalizeWord(word) {
  const folded = foldPlural(word);
  return WORD_EQUIVALENTS[word] || WORD_EQUIVALENTS[folded] || folded;
}

/* Letters AND digits both become tokens (so "Type 1" vs "Type 2" diabetes
 * stay distinguishable -- an all-letters regex silently dropped the digit
 * and made those two conditions indistinguishable by search). Short
 * word-tokens (under 3 letters) are dropped entirely, not just guarded at
 * match time -- codes like "M75.0" strip down to a lone "m", and letting
 * that survive meant every other M-chapter ICD-10 code (M71.9, M79.7...)
 * exact-matched it. Short numeric tokens ("1", "2") are kept, since they
 * only ever match by exact equality (tokenFuzzyMatch's containment check
 * still requires length >= 3), so a lone digit can't spuriously
 * containment-match into an unrelated word the way a lone letter did. */
function tokenize(text) {
  const raw = (text.toLowerCase().match(/[a-z0-9]+/g) || []);
  const out = [];
  for (const w of raw) {
    if (COMPOUND_SPLITS[w]) out.push(...COMPOUND_SPLITS[w].split(' ').map(normalizeWord));
    else out.push(normalizeWord(w));
  }
  return out.filter(w => w.length >= 3 || /^[0-9]+$/.test(w));
}

/**
 * True if `query` matches the searchable text built from `fields`
 * (falsy fields are ignored). Case-insensitive. Tries an exact substring
 * match first, then falls back to "every normalised query word appears,
 * in any order, as a normalised word (or word-fragment) in the target".
 */
export function searchMatches(query, ...fields) {
  const q = (query || '').trim();
  if (!q) return true;

  const haystackRaw = fields.filter(Boolean).join(' ').toLowerCase();
  if (haystackRaw.includes(q.toLowerCase())) return true;

  const qTokens = tokenize(q);
  if (!qTokens.length) return false;
  const hTokens = tokenize(haystackRaw);
  if (!hTokens.length) return false;

  return qTokens.every(qt => hTokens.some(ht => tokenFuzzyMatch(qt, ht)));
}

/* Common function words carry no distinguishing meaning on their own and
 * must never PROVE a match purely by being a coincidental substring of a
 * longer, unrelated word -- e.g. "and" is a literal substring of "dandruff",
 * which without this list made searching "dandruff" match "pins AND
 * needles" and "changed AND stayed changed" (both contain the standalone
 * word "and") instead of the intended condition. The length>=3 guard below
 * stops single-letter/short words like "a" from this, but three- and
 * four-letter function words are exactly 3+ chars and slip straight through
 * it -- this list closes that specific gap. */
const CONTAINMENT_STOPWORDS = new Set([
  'and', 'the', 'for', 'not', 'but', 'are', 'was', 'you', 'him', 'her',
  'its', 'our', 'out', 'all', 'any', 'can', 'had', 'has', 'have', 'that',
  'this', 'with', 'from', 'they', 'will', 'been',
]);

/* Exact match is always fine regardless of length. Containment ("ankle" found
 * inside "anklebone") is only trusted once both sides are long enough that a
 * short common word (a, up, it, in, is...) can't spuriously "contain-match"
 * into an unrelated longer word -- e.g. "a" is technically a substring of
 * "back", which without this guard made every query touching a short
 * stopword match nearly everything. */
function tokenFuzzyMatch(qt, ht) {
  if (qt === ht) return true;
  if (qt.length < 3 || ht.length < 3) return false;
  if (CONTAINMENT_STOPWORDS.has(qt) || CONTAINMENT_STOPWORDS.has(ht)) return false;
  return ht.includes(qt) || qt.includes(ht);
}

/* Picking ONE best candidate out of several that could all satisfy a fuzzy
 * match -- e.g. searching "hyperthyroidism" fuzzy-matches on the shared
 * root word "thyroid" inside BOTH Hypothyroidism's and Hyperthyroidism's
 * synonym lists (opposite conditions, correctly worded, that just happen
 * to share a word). A literal, exact match against one candidate's own
 * label/synonym is a strictly stronger signal than a fuzzy token-overlap on
 * a different candidate, so it must always be tried first, before the
 * fuzzy fallback (which has no way to prefer one candidate over another)
 * ever runs. `getFields(item)` returns that item's searchable strings. */
export function bestMatch(term, items, getFields) {
  const q = (term || '').trim().toLowerCase();
  if (!q) return null;
  const exact = items.find(item => getFields(item).some(f => (f || '').trim().toLowerCase() === q));
  if (exact) return exact;
  return items.find(item => searchMatches(term, ...getFields(item))) || null;
}
