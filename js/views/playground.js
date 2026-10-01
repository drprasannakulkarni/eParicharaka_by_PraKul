/* Playground: a diagnosis as a tree, and the hinges that break it.
 *
 * The root is the diagnosis the current case produces. Under it hang the
 * findings that produce it, in four colour-coded lanes -- what the patient
 * reports, what the examination shows, what the investigations say, and the
 * background they bring with them.
 *
 * Every node has three states: present, absent, or unknown. Absent is not the
 * same as unknown -- a confirmed-negative troponin argues against a heart
 * attack, while an unmeasured one says nothing at all, and the tree keeps those
 * apart because a physician has to.
 *
 * The point of the thing is the DEVIATIONS. For every node the engine tries the
 * other states and records which single change would give a different diagnosis.
 * Those nodes are marked as hinges, and each alternative diagnosis appears as a
 * branch directly under the root, labelled with the one finding that gets you
 * there. That is the differential made mechanical: not "these are the other
 * possibilities" but "this exact finding is what separates them".
 */
import { loadConditions, loadBundle, loadEvidence } from '../data.js';
import { score } from '../../data/engine.js';
import { esc, pillClass, ACUITY_LABEL, openModal } from '../ui.js';
import { detailHTML } from './conditions.js';

const SEED_N = 7;          // findings the case opens with
const MAX_DEVIATIONS = 6;  // branches under the root

const LANES = [
  { id: 'symptom', cls: 'ln-sym',  label: 'Reported symptoms',  icon: '🗣',
    kinds: ['symptom', 'modifier'] },
  { id: 'sign',    cls: 'ln-exam', label: 'Examination',        icon: '🩺',
    kinds: ['sign'] },
  { id: 'lab',     cls: 'ln-lab',  label: 'Investigations',     icon: '🧪',
    kinds: ['lab'] },
  { id: 'bg',      cls: 'ln-bg',   label: 'Patient background', icon: '👤',
    kinds: ['risk', 'history', 'demographic'] },
];

const NEXT_STATE = { present: 'absent', absent: 'unknown', unknown: 'present' };
const STATE_MARK = { present: '✓', absent: '✕', unknown: '?' };

let state = null;
let bound = false;

export function reset() { state = null; }

export async function render(root) {
  const [conditions, evidence] = await Promise.all([loadConditions(), loadEvidence()]);
  const evMap = new Map(evidence.map(e => [e.id, e]));
  if (!state) return renderPicker(root, conditions, evMap);
  return renderTree(root, conditions);
}

/* ------------------------------------------------------------- picker */
function renderPicker(root, conditions, evMap) {
  const specialties = [...new Set(conditions.map(c => c.specialty))].sort();
  root.innerHTML = `
    <h2 class="section">Playground</h2>
    <p class="lede">
      Open a condition as a decision tree. Flip any symptom, examination finding or
      test result and the tree shows which single change turns the diagnosis into
      something else — and what that something else is.
    </p>
    <div class="toolbar">
      <input class="field" id="pg-q" type="search" placeholder="Search a condition to open" autocomplete="off">
      <select class="field" id="pg-spec">
        <option value="">All specialties</option>
        ${specialties.map(s => `<option>${esc(s)}</option>`).join('')}
      </select>
    </div>
    <div id="pg-list"></div>
  `;

  const list = root.querySelector('#pg-list');
  const draw = () => {
    const q = root.querySelector('#pg-q').value.trim().toLowerCase();
    const sp = root.querySelector('#pg-spec').value;
    const shown = conditions
      .filter(c => c.chiefComplaints.length)
      .filter(c => (!sp || c.specialty === sp) &&
                   (!q || c.name.toLowerCase().includes(q) ||
                          c.aka.some(a => a.toLowerCase().includes(q))))
      .sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = shown.length ? shown.map(c => {
      const labs = Object.keys(c.sens || {}).filter(k => evMap.get(k)?.kind === 'lab').length;
      return `
        <button class="row" data-open="${esc(c.id)}">
          <span class="row-main">
            <strong>${esc(c.name)}</strong>
            <span>${esc(c.specialty)} · ${labs} modelled test result${labs === 1 ? '' : 's'}</span>
          </span>
          <span class="pill ${pillClass(c.acuity)}">${esc(ACUITY_LABEL[c.acuity])}</span>
        </button>`;
    }).join('') : '<div class="empty">No condition matches.</div>';
  };

  draw();
  root.querySelector('#pg-q').addEventListener('input', draw);
  root.querySelector('#pg-spec').addEventListener('change', draw);

  list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-open]');
    if (!btn) return;
    btn.disabled = true;
    const cond = conditions.find(c => c.id === btn.dataset.open);
    const cc = cond.chiefComplaints
      .map(id => ({ id, s: cond.sens?.[id] ?? 0 }))
      .sort((a, b) => b.s - a.s)[0].id;
    state = seed(cond, await loadBundle(cc), evMap);
    render(root);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* The case opens on the common presentation. Investigations start UNKNOWN --
 * nothing has been sent yet, which is where a consultation actually begins. */
function seed(condition, bundle, evMap) {
  const inBundle = bundle.conditions.find(c => c.id === condition.id) || condition;
  const sensOf = id => inBundle.sens?.[id] ?? 0;
  const AGES = ['EV_AGE_LT18', 'EV_AGE_18_39', 'EV_AGE_40_64', 'EV_AGE_GE65'];
  const SEXES = ['EV_SEX_MALE', 'EV_SEX_FEMALE'];
  const demo = new Set([...AGES, ...SEXES]);
  const complaint = bundle.chiefComplaint.id;

  const all = Object.keys(inBundle.lr).filter(id => evMap.has(id));
  const clinical = all
    .filter(id => !demo.has(id) && id !== complaint && evMap.get(id).kind !== 'lab')
    .sort((a, b) => sensOf(b) - sensOf(a));

  const states = new Map();
  all.forEach(id => states.set(id, 'unknown'));
  states.set(complaint, 'present');
  clinical.slice(0, SEED_N).forEach(id => states.set(id, 'present'));
  states.set(AGES.reduce((a, b) => sensOf(a) >= sensOf(b) ? a : b), 'present');
  states.set(SEXES.reduce((a, b) => sensOf(a) >= sensOf(b) ? a : b), 'present');

  const st = { condition, bundle, evMap, inBundle, sensOf, complaint, states,
               lastChange: null };
  st.baseline = topOf(st);
  return st;
}

function partition(states) {
  const present = [], absent = [];
  for (const [id, s] of states) {
    if (s === 'present') present.push(id);
    else if (s === 'absent') absent.push(id);
  }
  return { present, absent };
}

function rank(st, states = st.states) {
  const { present, absent } = partition(states);
  return score(st.bundle, { present, absent }).ranked;
}
const topOf = st => rank(st)[0];

/* Where does the diagnosis actually change?
 *
 * A single-node search is not enough. A textbook case sits at 100% and no one
 * finding will move it, so the tree comes back empty and says nothing -- which
 * is exactly the dead end the old playground had.
 *
 * So for each rival diagnosis we search for the SMALLEST set of changes that
 * would make it the leading answer, greedily picking whichever single change
 * moves the odds furthest toward that rival. The result is the honest answer to
 * "what would change my mind": not one magic finding, but "these two together".
 * Every node on any winning path is marked as a hinge.
 */
/* Incremental scorer, used only by the path search.
 *
 * A full rescore walks every finding of every candidate. The search probes
 * hundreds of single flips, and a flip changes exactly one term, so recomputing
 * the rest is waste -- it cost three seconds to open a tree. Here the base
 * log-posterior is computed once and a probe just adjusts one term per
 * candidate: O(conditions) instead of O(conditions x findings).
 *
 * The displayed numbers still come from the shared engine, so this can never
 * drift into being a second opinion; it only decides which flips are worth
 * showing.
 */
function fastScorer(st) {
  const conds = st.bundle.conditions;
  const term = (c, id, s) => {
    const lr = c.lr[id];
    if (!lr) return 0;
    return s === 'present' ? Math.log(lr[0]) : s === 'absent' ? Math.log(lr[1]) : 0;
  };

  const base = conds.map(c => {
    let lp = Math.log(c.prior);
    for (const [id, s] of st.states) lp += term(c, id, s);
    return lp;
  });

  const softmaxTop = adjust => {
    let bi = 0, bv = -Infinity, second = -Infinity;
    const lps = new Array(conds.length);
    for (let i = 0; i < conds.length; i++) {
      const v = base[i] + (adjust ? adjust(conds[i], i) : 0);
      lps[i] = v;
      if (v > bv) { second = bv; bv = v; bi = i; }
      else if (v > second) second = v;
    }
    let sum = 0;
    for (let i = 0; i < conds.length; i++) sum += Math.exp(lps[i] - bv);
    return { lps, topIndex: bi, hi: bv, sum };
  };

  return { conds, term, base, softmaxTop,
           shareOf: (r, i) => Math.exp(r.lps[i] - r.hi) / r.sum };
}

const FLIP_BUDGET = 3;      // most changes we will chain together
const RIVALS = 5;           // alternative diagnoses to search paths toward

function searchPaths(st) {
  const current = rank(st);
  const topId = current[0]?.id;
  const hinges = new Map();
  const deviations = [];

  const F = fastScorer(st);
  const idxOf = new Map(F.conds.map((c, i) => [c.id, i]));
  const flippable = [...st.states.keys()].filter(id => id !== st.complaint);
  const STATES = ['present', 'absent', 'unknown'];

  for (const rival of current.slice(1, 1 + RIVALS)) {
    const ri = idxOf.get(rival.id);
    if (ri === undefined) continue;

    const trial = new Map(st.states);
    const delta = new Float64Array(F.conds.length);   // running offset from base
    const path = [];
    let leaderId = topId;

    for (let step = 0; step < FLIP_BUDGET && leaderId !== rival.id; step++) {
      let best = null;
      for (const id of flippable) {
        if (path.some(p => p.evId === id)) continue;
        const from = trial.get(id);
        for (const alt of STATES) {
          if (alt === from) continue;
          const r = F.softmaxTop((c, i) =>
            delta[i] + F.term(c, id, alt) - F.term(c, id, from));
          const gap = r.lps[ri] - r.lps[r.topIndex];
          if (!best || gap > best.gap) {
            best = { evId: id, toState: alt, from, gap,
                     topId: F.conds[r.topIndex].id };
          }
        }
      }
      if (!best) break;
      for (let i = 0; i < F.conds.length; i++) {
        delta[i] += F.term(F.conds[i], best.evId, best.toState)
                  - F.term(F.conds[i], best.evId, best.from);
      }
      trial.set(best.evId, best.toState);
      path.push({ evId: best.evId, toState: best.toState });
      leaderId = best.topId;
    }

    if (leaderId === rival.id && path.length) {
      // confirm with the real engine before showing it
      const confirmed = rank(st, trial);
      if (confirmed[0]?.id !== rival.id) continue;
      const share = confirmed[0].share;
      deviations.push({ cond: rival, path, share });
      for (const step of path) {
        const prev = hinges.get(step.evId);
        if (!prev || path.length < prev.pathLength) {
          hinges.set(step.evId, { toState: step.toState, becomes: rival,
                                  share, pathLength: path.length });
        }
      }
    }
  }

  deviations.sort((a, b) => a.path.length - b.path.length || b.share - a.share);
  return { current, hinges, deviations: deviations.slice(0, MAX_DEVIATIONS) };
}

/* ------------------------------------------------------------- the tree */
function renderTree(root, conditions) {
  const st = state;
  const { current, hinges, deviations } = searchPaths(st);
  const top = current[0];
  const dirty = st.lastChange !== null;

  const lanes = LANES.map(l => ({
    ...l,
    items: [...st.states.keys()]
      .filter(id => l.kinds.includes(st.evMap.get(id)?.kind))
      .map(id => ({ id, ev: st.evMap.get(id), sens: st.sensOf(id),
                    st: st.states.get(id), hinge: hinges.get(id) }))
      .sort((a, b) => {
        const rankOf = x => x.st === 'present' ? 0 : x.st === 'absent' ? 1 : 2;
        return rankOf(a) - rankOf(b) || (b.hinge ? 1 : 0) - (a.hinge ? 1 : 0) || b.sens - a.sens;
      }),
  })).filter(l => l.items.length);

  root.innerHTML = `
    <div class="btn-row" style="margin-bottom:14px">
      <button class="btn btn-ghost" id="pg-back">← Choose another condition</button>
      ${dirty ? '<button class="btn btn-ghost" id="pg-reset">Reset the case</button>' : ''}
      <span class="small muted">Click a node to cycle it: present → absent → unknown</span>
    </div>

    <div class="tree">
      <div class="tree-root ${pillClass(top.acuity).replace('pill-', 'root-')}">
        <span class="root-eyebrow">Current diagnosis</span>
        <strong class="root-name">${esc(top.name)}</strong>
        <span class="root-share">${fmtPct(top.share)}%</span>
        <span class="pill ${pillClass(top.acuity)}">${esc(top.triage.label)}</span>
      </div>

      ${deviations.length ? `
        <div class="tree-stem"></div>
        <div class="dev-label">Change one finding and it becomes…</div>
        <div class="dev-row">
          ${deviations.map(d => renderDeviation(d, st)).join('')}
        </div>` : `
        <div class="tree-stem"></div>
        <div class="dev-none">No single change flips this diagnosis — the case is
          over-determined. Set some findings to unknown to loosen it.</div>`}

      ${st.lastChange ? renderChange(st.lastChange) : ''}

      <div class="tree-stem"></div>
      <div class="lanes">
        ${lanes.map(l => renderLane(l, st)).join('')}
      </div>
    </div>
  `;

  root.querySelector('#pg-back').addEventListener('click', () => { reset(); render(root); });
  root.querySelector('#pg-reset')?.addEventListener('click', () => {
    state = seed(st.condition, st.bundle, st.evMap);
    render(root);
  });
  bindTree(root, conditions);
}

function renderDeviation(d, st) {
  const verb = t => t === 'present' ? 'present' : t === 'absent' ? 'ruled out' : 'unknown';
  const steps = d.path.map(p => {
    const ev = st.evMap.get(p.evId);
    return `<li><b>${esc(ev?.label || p.evId)}</b> ${esc(verb(p.toState))}</li>`;
  }).join('');
  return `
    <div class="dev">
      <div class="dev-branch"></div>
      <div class="dev-card ${pillClass(d.cond.acuity)}" data-apply-path='${esc(JSON.stringify(d.path))}'>
        <span class="dev-name">${esc(d.cond.name)}</span>
        <span class="dev-share">${fmtPct(d.share)}%</span>
        <span class="dev-count">${d.path.length} change${d.path.length > 1 ? 's' : ''} away</span>
        <ol class="dev-steps">${steps}</ol>
        <span class="dev-apply">Apply this path →</span>
      </div>
    </div>`;
}

function renderLane(lane, st) {
  const n = lane.items.filter(i => i.st === 'present').length;
  const hinges = lane.items.filter(i => i.hinge).length;
  return `
    <section class="lane ${lane.cls}">
      <header class="lane-head">
        <span class="lane-icon" aria-hidden="true">${lane.icon}</span>
        <span class="lane-title">${esc(lane.label)}</span>
        <span class="lane-count">${n}/${lane.items.length}${hinges ? ` · ${hinges} hinge${hinges > 1 ? 's' : ''}` : ''}</span>
      </header>
      <div class="lane-nodes">
        ${lane.items.map(i => renderNode(i, st)).join('')}
      </div>
    </section>`;
}

function renderNode(item, st) {
  const { id, ev, sens, st: s, hinge } = item;
  const locked = id === st.complaint;
  const becomes = hinge ? hinge.becomes.name : null;
  return `
    <div class="node n-${s}${hinge ? ' is-hinge' : ''}${locked ? ' is-locked' : ''}"
         ${locked ? '' : `data-node="${esc(id)}"`} role="${locked ? 'note' : 'button'}"
         ${locked ? '' : 'tabindex="0"'}
         title="${locked ? 'The presenting complaint defines the case' : 'Click to cycle present / absent / unknown'}">
      <span class="node-mark">${STATE_MARK[s]}</span>
      <span class="node-label">${esc(ev.label)}</span>
      ${sens > 0 ? `<span class="node-freq">${Math.round(sens * 100)}%</span>` : ''}
      ${hinge ? `<span class="node-hinge">→ ${esc(becomes)}</span>` : ''}
    </div>`;
}

function renderChange(ch) {
  return `
    <div class="tree-change">
      <span class="tc-act">${esc(ch.verb)}</span>
      <span class="tc-name">${esc(ch.label)}</span>
      ${ch.effects.length ? `<span class="tc-fx">${ch.effects.map(f =>
        `<span class="pg-fx ${f.factor >= 1 ? 'pg-up' : 'pg-down'}">${esc(f.name)} ${fmtFactor(f.factor)}</span>`
      ).join('')}</span>`
        : '<span class="small muted">barely moved the odds</span>'}
    </div>`;
}

/* A collapse to one four-hundredth reads as "x0.00" if you just round it, which
   loses the whole point. Below 1 the division is the legible direction. */
function fmtFactor(f) {
  if (f >= 10) return '×' + Math.round(f);
  if (f >= 1) return '×' + f.toFixed(2);
  const inv = 1 / f;
  return '÷' + (inv >= 10 ? Math.round(inv) : inv.toFixed(1));
}

function fmtPct(x) {
  const v = x * 100;
  if (v < 0.1) return '<0.1';
  if (v < 10) return v.toFixed(1);
  return String(Math.round(v));
}

/* ----------------------------------------------------------- interaction */
function bindTree(root, conditions) {
  if (bound) return;
  bound = true;

  const apply = (evId, next) => {
    const st = state;
    const before = rank(st);
    const ev = st.evMap.get(evId);
    st.states.set(evId, next);
    st.lastChange = {
      verb: next === 'present' ? 'Marked present'
          : next === 'absent' ? 'Marked absent' : 'Set to unknown',
      label: ev?.label || evId,
      effects: effectsOf(before, rank(st)),
    };
    render(root);
  };

  root.addEventListener('click', e => {
    if (!state) return;
    const devPath = e.target.closest('[data-apply-path]');
    if (devPath) {
      const st = state;
      const before = rank(st);
      const path = JSON.parse(devPath.dataset.applyPath);
      path.forEach(p => st.states.set(p.evId, p.toState));
      st.lastChange = {
        verb: `Applied ${path.length} change${path.length > 1 ? 's' : ''}`,
        label: path.map(p => st.evMap.get(p.evId)?.label || p.evId).join(', '),
        effects: effectsOf(before, rank(st)),
      };
      return render(root);
    }
    const node = e.target.closest('[data-node]');
    if (node) return apply(node.dataset.node, NEXT_STATE[state.states.get(node.dataset.node)]);
    const rootCard = e.target.closest('.tree-root');
    if (rootCard) {
      const c = conditions.find(x => x.id === rank(state)[0].id);
      if (c) openModal(detailHTML(c, state.evMap));
    }
  });

  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const node = e.target.closest('[data-node]');
    if (!node) return;
    e.preventDefault();
    apply(node.dataset.node, NEXT_STATE[state.states.get(node.dataset.node)]);
  });
}

function effectsOf(before, after) {
  const b = new Map(before.map(r => [r.id, r.share]));
  return after.slice(0, 3).map(r => {
    const prev = b.get(r.id);
    const oa = r.share / Math.max(1e-9, 1 - r.share);
    const ob = prev === undefined ? null : prev / Math.max(1e-9, 1 - prev);
    return { name: r.name, factor: ob ? oa / ob : 1 };
  }).filter(f => Number.isFinite(f.factor) && Math.abs(Math.log(f.factor)) > 0.05);
}
