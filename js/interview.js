/* Adaptive interview.
 *
 * Picks the next question by expected information gain over the current
 * posterior, so the interview converges instead of marching through a fixed
 * list. Two things override pure information gain:
 *
 *   Safety.  A question whose answers can fire a red-flag rule is boosted, so
 *            "is your neck too stiff to touch your chin to your chest" gets
 *            asked early even when it is not the most discriminating question
 *            statistically. Missing meningitis is not symmetric with asking a
 *            slightly redundant question.
 *
 *   Sequence. Age and sex come first. They shift every prior in the set, so
 *            asking them last wastes the questions in between.
 */
import { score } from '../data/engine.js';

export const MIN_QUESTIONS = 8;    // before an early exit is even considered
// TYPICAL_MAX_QUESTIONS is a DISPLAY figure only ("X of ~8-15") -- it does not
// bound the interview. What actually decides when to stop is MIN_USEFUL_GAIN
// (no remaining question tells us anything new) and CONFIDENT_SHARE/RATIO
// (one candidate has pulled decisively clear). A fixed question cap used to
// cut interviews off while genuinely useful discriminating evidence still
// remained -- e.g. Refractive Error's near/far question, or a condition's
// duration pattern, sometimes only became the most informative question to
// ask AFTER 15 others. Removing the cap means the interview keeps asking for
// as long as doing so measurably sharpens the diagnosis, and stops exactly
// when it stops helping -- not at an arbitrary round number.
export const TYPICAL_MAX_QUESTIONS = 15;
// True safety backstop only, never expected to bind in practice: prevents a
// pathological bundle from working through literally every question it has.
// Pool exhaustion (`!pool.length` in nextQuestion) is the real, always-safe
// terminator -- a bundle has finitely many questions -- this just keeps a
// single interview from running past a sane bound even in an edge case.
const HARD_QUESTION_CAP = 60;
const CONFIDENT_SHARE = 0.75;      // top candidate this dominant...
const CONFIDENT_RATIO = 3.0;       // ...and this far clear of second place
const MIN_USEFUL_GAIN = 0.008;     // below this a question tells us nothing

export function createSession(bundle) {
  return {
    bundle,
    present: new Set([bundle.chiefComplaint.id]),
    absent: new Set(),
    history: [],          // [{ questionId, optionIndexes }]
    finished: false,
  };
}

/* ---------------------------------------------------------------- helpers */

const evIndex = bundle => {
  if (!bundle._evIndex) {
    bundle._evIndex = new Map(bundle.evidence.map(e => [e.id, e]));
  }
  return bundle._evIndex;
};

/* An option tagged sex:"male"/"female" (anatomically exclusive findings --
 * vaginal discharge, testicular pain, missed period, pregnancy) is hidden
 * once the OPPOSITE sex has been explicitly declared. If sex was skipped
 * rather than answered, nothing is hidden: declining to say is not the same
 * as declaring, and there is no reason to withhold a potentially relevant
 * question from someone who simply didn't answer the demographic one.
 * Untagged options (the overwhelming majority) are always visible. */
export function optionVisible(session, option) {
  if (option.sex === 'male' && session.present.has('EV_SEX_FEMALE')) return false;
  if (option.sex === 'female' && session.present.has('EV_SEX_MALE')) return false;
  return true;
}

/* Two options in the same multi-select question are mutually exclusive if
 * either one asserts a finding the other denies -- checked both ways, since
 * either side may carry the deny (e.g. "Loose and watery" denies
 * EV_CONSTIPATION; "Constipated, straining" denies EV_DIARRHEA -- either
 * relationship alone is enough to prove the two can't both be true). This
 * reads the SAME assert/deny data the scoring engine already uses -- no
 * separate exclusivity schema -- so a "None of these" whose denies cover
 * every sibling assert is automatically exclusive with all of them, and a
 * real opposite pair (constipated vs loose stools, hot vs cold intolerance)
 * is exclusive as soon as the data says so, with no per-question UI code. */
export function optionsConflict(a, b) {
  const aAsserts = a.asserts || [], bAsserts = b.asserts || [];
  const aDenies = new Set(a.denies || []), bDenies = new Set(b.denies || []);
  return aAsserts.some(e => bDenies.has(e)) || bAsserts.some(e => aDenies.has(e));
}

/* Sensitivity ships with the bundle. It used to be recovered as
 * LR+ x background, which broke the moment backgrounds became per-complaint:
 * dividing a complaint-scoped ratio by a complaint-scoped rate no longer
 * returns P(finding | condition). */
export function sensitivity(bundle, condition, evId) {
  const s = condition.sens?.[evId];
  return s === undefined ? null : s;
}

function entropy(ranked) {
  let h = 0;
  for (const r of ranked) {
    if (r.share > 1e-12) h -= r.share * Math.log(r.share);
  }
  return h;
}

function posteriorAfter(bundle, present, absent, asserts, denies) {
  const p = new Set(present), a = new Set(absent);
  asserts.forEach(e => { p.add(e); a.delete(e); });
  denies.forEach(e => { a.add(e); p.delete(e); });
  return score(bundle, { present: p, absent: a });
}

/* P(this option | this condition), from the sensitivities of what it asserts
 * and denies. Findings the condition says nothing about contribute nothing. */
function optionLikelihood(bundle, condition, option) {
  let l = 1, seen = 0;
  for (const ev of option.asserts) {
    const s = sensitivity(bundle, condition, ev);
    if (s !== null) { l *= s; seen++; }
  }
  for (const ev of option.denies) {
    const s = sensitivity(bundle, condition, ev);
    if (s !== null) { l *= (1 - s); seen++; }
  }
  return seen ? l : 0.25;   // uninformative option: flat, not zero
}

/* Questions that can fire a red flag are worth asking even when they are not
 * the sharpest discriminator. */
function safetyMultiplier(bundle, q) {
  if (!bundle._flagEvidence) {
    const s = new Set();
    for (const r of bundle.redFlags) {
      r.allOf.forEach(e => s.add(e));
      r.anyOf.forEach(e => s.add(e));
    }
    bundle._flagEvidence = s;
  }
  const flags = bundle._flagEvidence;
  const touches = q.options.some(o => o.asserts.some(e => flags.has(e)));
  return touches ? 2.5 : 1.0;
}

/* --------------------------------------------------------- question choice */

export function expectedInfoGain(bundle, session, q) {
  const now = score(bundle, { present: session.present, absent: session.absent });
  const h0 = entropy(now.ranked);
  const byId = new Map(bundle.conditions.map(c => [c.id, c]));

  if (q.kind === 'single') {
    // options are mutually exclusive: one full distribution over them
    const weights = q.options.map(o => {
      let p = 0;
      for (const r of now.ranked) {
        const c = byId.get(r.id);
        if (c) p += r.share * optionLikelihood(bundle, c, o);
      }
      return p;
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let expected = 0;
    q.options.forEach((o, i) => {
      const p = weights[i] / total;
      if (p < 1e-6) return;
      const post = posteriorAfter(bundle, session.present, session.absent,
                                  o.asserts, o.denies);
      expected += p * entropy(post.ranked);
    });
    return Math.max(0, h0 - expected);
  }

  // multi-select and boolean: treat each option as an independent yes/no and
  // take the best single option's gain, which is what the answer hinges on
  let best = 0;
  for (const o of q.options) {
    if (!o.asserts.length) continue;
    let pYes = 0;
    for (const r of now.ranked) {
      const c = byId.get(r.id);
      if (c) pYes += r.share * optionLikelihood(bundle, c, o);
    }
    pYes = Math.min(0.99, Math.max(0.01, pYes));
    const yes = posteriorAfter(bundle, session.present, session.absent, o.asserts, []);
    const no  = posteriorAfter(bundle, session.present, session.absent, [], o.asserts);
    const expected = pYes * entropy(yes.ranked) + (1 - pYes) * entropy(no.ranked);
    best = Math.max(best, h0 - expected);
  }
  return Math.max(0, best);
}

export function nextQuestion(session) {
  const { bundle } = session;
  const asked = new Set(session.history.map(h => h.questionId));
  const pool = bundle.questions.filter(q => !asked.has(q.id));
  if (!pool.length) return null;

  // age and sex first: they move every prior in the set
  const demographics = pool
    .filter(q => q.category === 'demographics')
    .sort((a, b) => a.priority - b.priority);
  if (demographics.length) return demographics[0];

  const clinicalAsked = session.history.filter(h => h.category !== 'demographics').length;
  if (clinicalAsked >= HARD_QUESTION_CAP) return null;

  let best = null, bestScore = -1, bestGain = 0;
  for (const q of pool) {
    if (q.optional && clinicalAsked < MIN_QUESTIONS) continue;
    const gain = expectedInfoGain(bundle, session, q);
    const s = gain * safetyMultiplier(bundle, q);
    if (s > bestScore || (Math.abs(s - bestScore) < 1e-9 && best && q.priority < best.priority)) {
      best = q; bestScore = s; bestGain = gain;
    }
  }

  if (!best) return null;
  if (clinicalAsked >= MIN_QUESTIONS && bestGain < MIN_USEFUL_GAIN) return null;
  return best;
}

export function shouldStop(session) {
  const clinicalAsked = session.history.filter(h => h.category !== 'demographics').length;
  if (clinicalAsked >= HARD_QUESTION_CAP) return true;
  if (clinicalAsked < MIN_QUESTIONS) return false;

  const { ranked } = score(session.bundle,
    { present: session.present, absent: session.absent });
  if (ranked.length < 2) return true;
  const [top, second] = ranked;
  return top.share >= CONFIDENT_SHARE &&
         (second.share < 1e-9 || top.share / second.share >= CONFIDENT_RATIO);
}

/* ------------------------------------------------------------ answer/undo */

export function answer(session, question, optionIndexes) {
  const asserts = [], denies = [];
  const vpk = [];
  for (const i of optionIndexes) {
    const o = question.options[i];
    if (!o) continue;
    asserts.push(...o.asserts);
    denies.push(...o.denies);
    // Vata/Pitta/Kapha doshic weight for this option, if it carries one --
    // options with no doshic quality of their own (negations, catch-alls,
    // pure risk-factor flags, biological sex -- see the VPK-mapping
    // project's README) have vpk: null and simply don't contribute.
    if (Array.isArray(o.vpk)) vpk.push(o.vpk);
  }
  // An option that asserts nothing and denies nothing is a "none of these"
  // for a multi-select: everything the question could have offered is absent.
  if (question.kind === 'multi' && optionIndexes.length) {
    const chosen = new Set(asserts);
    for (const o of question.options) {
      for (const ev of o.asserts) {
        if (!chosen.has(ev)) denies.push(ev);
      }
    }
  }

  asserts.forEach(e => { session.present.add(e); session.absent.delete(e); });
  denies.forEach(e => { if (!session.present.has(e)) session.absent.add(e); });

  session.history.push({
    questionId: question.id,
    category: question.category,
    text: question.text,
    optionIndexes: [...optionIndexes],
    labels: optionIndexes.map(i => question.options[i]?.label).filter(Boolean),
    asserts, denies,
    vpk,
  });
  return session;
}

/* Skipping is not the same as answering "no".
 *
 * A "none of these" denies every finding the question offered, which is real
 * evidence and shifts the odds. A skip asserts and denies nothing: the engine
 * learns that the question was put and left unanswered, so it is not asked
 * again, and no likelihood ratio is applied either way. Silence stays silence.
 */
export function skip(session, question) {
  session.history.push({
    questionId: question.id,
    category: question.category,
    text: question.text,
    optionIndexes: [],
    labels: [],
    asserts: [], denies: [],
    skipped: true,
  });
  return session;
}

export function undo(session) {
  const last = session.history.pop();
  if (!last) return session;
  // rebuild from scratch: cheaper to be correct than to track deltas
  const replay = [...session.history];
  session.present = new Set([session.bundle.chiefComplaint.id]);
  session.absent = new Set();
  session.history = [];
  const byId = new Map(session.bundle.questions.map(q => [q.id, q]));
  for (const h of replay) {
    const q = byId.get(h.questionId);
    if (!q) continue;
    if (h.skipped) skip(session, q);
    else answer(session, q, h.optionIndexes);
  }
  session.finished = false;
  return session;
}

/* Live Vata/Pitta/Kapha reading for the sidebar: a simple, equally-weighted
 * average of every answered option's own V/P/K% (per the e-Paricharaka_VPK
 * project's confirmed design) -- NOT a per-question average, so a multi-
 * select answer with three ticked boxes contributes three items, same as
 * three separate single-select answers would. Options with no doshic
 * quality of their own (vpk: null -- negations, catch-alls, risk-factor
 * flags, biological sex) simply don't contribute; age answers DO contribute
 * (their own confirmed design choice), skipped questions never do. Derived
 * fresh from session.history every time, the same "cheaper to be correct
 * than to track deltas" philosophy undo() already uses elsewhere in this
 * file -- so undo/skip/re-answer all stay correct for free.
 * Returns null until at least one doshically-tagged option has been
 * answered (nothing to average yet). Each triple already sums to 100 (see
 * the VPK-mapping project's Methodology sheet), so the mean of any number
 * of them sums to 100 too -- no renormalisation needed. */
export function computeVPK(session) {
  const contributions = session.history.flatMap(h => h.vpk || []);
  if (!contributions.length) return null;
  const sum = contributions.reduce((acc, [v, p, k]) => {
    acc.v += v; acc.p += p; acc.k += k;
    return acc;
  }, { v: 0, p: 0, k: 0 });
  const n = contributions.length;
  return {
    vata: Math.round((sum.v / n) * 10) / 10,
    pitta: Math.round((sum.p / n) * 10) / 10,
    kapha: Math.round((sum.k / n) * 10) / 10,
    n,
  };
}

export function progress(session) {
  const clinical = session.history.filter(h => h.category !== 'demographics').length;
  return {
    asked: clinical,
    min: MIN_QUESTIONS,
    max: TYPICAL_MAX_QUESTIONS,      // display range only -- see the constant's own comment
    pastTypical: clinical > TYPICAL_MAX_QUESTIONS,
    pct: Math.min(100, Math.round((clinical / MIN_QUESTIONS) * 100)),
    vpk: computeVPK(session),
  };
}

export function result(session) {
  return score(session.bundle, { present: session.present, absent: session.absent });
}
