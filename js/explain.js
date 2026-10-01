/* Turning likelihood ratios into reasons.
 *
 * The ranking is only useful if a clinician can argue with it, so every claim
 * below is traceable to one number in the dataset. Two directions matter:
 *
 *   Confirmation  what the answers contributed toward the leading condition.
 *   Exclusion     why each near neighbour fell behind. This is the half most
 *                 symptom checkers omit, and the half that carries the
 *                 clinical reasoning: "pneumonia is present in 90% of cases
 *                 with purulent sputum, and you do not have it".
 */
import { sensitivity } from './interview.js';

const evOf = (bundle, id) => bundle.evidence.find(e => e.id === id);

export function strengthOf(lr) {
  const x = lr >= 1 ? lr : 1 / lr;
  if (x >= 10) return { label: 'strong', weight: 3 };
  if (x >= 3)  return { label: 'moderate', weight: 2 };
  if (x >= 1.5) return { label: 'mild', weight: 1 };
  return { label: 'minimal', weight: 0 };
}

const pct = x => `${Math.round(x * 100)}%`;

/* Reasons the leading condition fits. */
export function explainSupport(bundle, condition, ranked, limit = 6) {
  const out = [];

  for (const { ev, lr, direction } of ranked.supporting) {
    const e = evOf(bundle, ev);
    if (!e) continue;
    const s = sensitivity(bundle, condition, ev);
    const strength = strengthOf(lr);
    if (strength.weight === 0) continue;

    out.push({
      evidence: ev,
      label: e.label,
      layman: e.layman,
      direction,
      lr,
      strength: strength.label,
      weight: strength.weight,
      text: direction === 'present'
        ? `You reported ${e.layman.toLowerCase()}, seen in about ${pct(s)} of people with this condition.`
        : `You do not have ${e.layman.toLowerCase()}, which is uncommon in this condition and fits the picture.`,
    });
  }

  out.sort((a, b) => b.lr - a.lr);
  return out.slice(0, limit);
}

/* Reasons a near neighbour was ruled down, strongest objection first. */
export function explainExclusion(bundle, condition, ranked, limit = 4) {
  const out = [];

  for (const { ev, lr, direction } of ranked.opposing) {
    const e = evOf(bundle, ev);
    if (!e) continue;
    const s = sensitivity(bundle, condition, ev);
    const strength = strengthOf(lr);
    if (strength.weight === 0) continue;

    out.push({
      evidence: ev,
      label: e.label,
      layman: e.layman,
      direction,
      lr,
      strength: strength.label,
      // A confirmed-absent finding with a low LR- means the finding is common
      // in this condition and the patient does not have it. That is the
      // classic exclusion argument, so state the frequency explicitly.
      text: direction === 'absent'
        ? `${cap(e.layman)} is present in about ${pct(s)} of cases, and you do not have it.`
        : `You reported ${e.layman.toLowerCase()}, which is unusual in this condition (about ${pct(s)} of cases).`,
    });
  }

  out.sort((a, b) => a.lr - b.lr);
  return out.slice(0, limit);
}

/* What would have to be true for a ruled-out condition to come back into play.
 * Useful as safety-netting advice: "come back if this changes". */
export function whatWouldChangeIt(bundle, condition, session, limit = 3) {
  const missing = [];
  for (const [ev, lr] of Object.entries(condition.lr)) {
    if (session.present.has(ev) || session.absent.has(ev)) continue;
    const e = evOf(bundle, ev);
    if (!e || e.kind === 'demographic') continue;
    if (lr[0] < 4) continue;
    missing.push({ evidence: ev, label: e.label, layman: e.layman, lr: lr[0] });
  }
  missing.sort((a, b) => b.lr - a.lr);
  return missing.slice(0, limit);
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* A compact record of the consultation, for the printable summary. */
export function transcript(session) {
  return session.history.map(h => ({
    question: h.text,
    answer: h.skipped ? 'Skipped'
          : h.labels.length ? h.labels.join(', ')
          : 'None of these',
    skipped: !!h.skipped,
  }));
}
