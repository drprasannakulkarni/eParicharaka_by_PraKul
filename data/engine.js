/* Symptom checker reference engine, dataset v2.
 *
 * Pure function over a bundle plus the user's answers. No DOM, no globals, no
 * network. Swap the UI freely; the arithmetic below is the contract that
 * validate.py enforces on the data.
 *
 *   answers: { present: Set<evidenceId>, absent: Set<evidenceId> }
 *
 * Scoring is naive Bayes in log space. Independence between findings is
 * assumed and is not strictly true (breathlessness and fast breathing travel
 * together), so LRs are clamped at source and the output is deliberately
 * presented as a ranked shortlist, never as a probability to act on.
 */
export function score(bundle, answers) {
  const present = answers.present instanceof Set ? answers.present : new Set(answers.present || []);
  const absent  = answers.absent  instanceof Set ? answers.absent  : new Set(answers.absent  || []);

  const ranked = bundle.conditions.map(c => {
    let logp = Math.log(c.prior);
    const supporting = [], opposing = [];

    for (const ev of present) {
      const lr = c.lr[ev];
      if (!lr) continue;
      logp += Math.log(lr[0]);
      (lr[0] >= 1 ? supporting : opposing).push({ ev, lr: lr[0], direction: 'present' });
    }
    for (const ev of absent) {
      const lr = c.lr[ev];
      if (!lr) continue;
      logp += Math.log(lr[1]);
      (lr[1] >= 1 ? supporting : opposing).push({ ev, lr: lr[1], direction: 'absent' });
    }

    return {
      id: c.id, name: c.name, acuity: c.acuity, triage: c.triage,
      specialty: c.specialty, icd10: c.icd10, summary: c.summary,
      workup: c.workup, logp,
      supporting: supporting.sort((a, b) => b.lr - a.lr).slice(0, 6),
      opposing:   opposing.sort((a, b) => a.lr - b.lr).slice(0, 6),
    };
  });

  // Softmax over log-posteriors. Do NOT convert each condition to a
  // probability and then normalise: strong evidence drives several candidates
  // to odds >> 1, they all saturate near 1.0, and normalising afterwards hands
  // them near-identical shares however different their evidence actually was.
  const hi = Math.max(...ranked.map(r => r.logp));
  const total = ranked.reduce((s, r) => s + Math.exp(r.logp - hi), 0) || 1;
  ranked.forEach(r => { r.share = Math.exp(r.logp - hi) / total; });
  ranked.sort((a, b) => b.share - a.share);

  return {
    ranked,
    redFlags: firedRedFlags(bundle, present),
    triage: overallTriage(bundle, ranked, present),
    answered: present.size + absent.size,
  };
}

export function firedRedFlags(bundle, present) {
  const has = ev => present.has(ev);
  return bundle.redFlags.filter(r =>
    r.allOf.every(has) &&
    (r.anyOf.length === 0 || r.anyOf.some(has)) &&
    !r.noneOf.some(has)
  );
}

/* A fired red flag always wins: it is deterministic and must never be
 * suppressed by a low ranking.
 *
 * Otherwise take the most severe acuity among candidates genuinely in
 * contention, judged RELATIVE to the leader. A fixed threshold gets this wrong
 * in both directions: it over-escalates (a 10%-share emergency drags up an
 * otherwise benign picture) and under-escalates (nothing clears the bar, so it
 * silently falls through to self-care). */
export function overallTriage(bundle, ranked, present) {
  const fired = firedRedFlags(bundle, present);
  if (fired.some(r => r.level === 'EMERGENCY')) return { ...RANKS.emergency, reason: 'red-flag' };
  if (fired.some(r => r.level === 'URGENT'))    return { ...RANKS.urgent,    reason: 'red-flag' };

  const top = ranked[0];
  if (!top) return { ...RANKS.self_care, reason: 'differential' };
  let contenders = ranked.slice(0, 5).filter(r => r.share >= 0.5 * top.share);
  if (contenders.length === 0) contenders = [top];

  let best = contenders[0].acuity;
  for (const r of contenders) {
    if (RANKS[r.acuity].rank < RANKS[best].rank) best = r.acuity;
  }
  return { ...RANKS[best], reason: 'differential' };
}

export const RANKS = {
  "emergency": {
    "rank": 1,
    "label": "Emergency",
    "action": "Call emergency services or go to an emergency department now",
    "window": "Immediately",
    "tone": "critical"
  },
  "urgent": {
    "rank": 2,
    "label": "Urgent",
    "action": "Seek medical assessment today",
    "window": "Within hours",
    "tone": "high"
  },
  "soon": {
    "rank": 3,
    "label": "See a doctor soon",
    "action": "Book an appointment in the next few days",
    "window": "Within days",
    "tone": "moderate"
  },
  "routine": {
    "rank": 4,
    "label": "Routine",
    "action": "Discuss with your doctor at a routine appointment",
    "window": "Within weeks",
    "tone": "low"
  },
  "self_care": {
    "rank": 5,
    "label": "Self-care",
    "action": "This can usually be managed at home",
    "window": "Monitor",
    "tone": "info"
  }
};

/* Pick the question that best separates the current candidates: the one whose
 * answer most reduces expected entropy. This is what stops the app asking
 * twenty irrelevant questions in a fixed order. */
export function nextQuestion(bundle, answers, askedIds) {
  const asked = new Set(askedIds || []);
  const { ranked } = score(bundle, answers);
  const top = ranked.slice(0, 12);

  let best = null, bestGain = -1;
  for (const q of bundle.questions) {
    if (asked.has(q.id)) continue;
    let gain = 0;
    for (const o of q.options) {
      for (const ev of o.asserts) {
        const ps = top.map(r => {
          const c = bundle.conditions.find(x => x.id === r.id);
          return c && c.lr[ev] ? c.lr[ev][0] : 1;
        });
        const spread = Math.max(...ps) - Math.min(...ps);
        gain += spread * (1 / q.options.length);
      }
    }
    gain /= (q.priority || 1);
    if (gain > bestGain) { bestGain = gain; best = q; }
  }
  return best;
}
