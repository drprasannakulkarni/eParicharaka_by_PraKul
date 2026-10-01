/* Yoga4U: a practice library, viewable from either direction --
 *   by condition — what yoga/pranayama is indicated for this?
 *   by practice  — which conditions is this asana/pranayama indicated for?
 *
 * Covers both this app's self-care package (14 conditions, evidence-cited)
 * and the standalone chronic-conditions guide (26 conditions, not evidence-
 * cited -- see each entry's Source badge). Independent of the diagnostic
 * flow, same as Ayurveda A-Z: a reference, not a recommendation engine. */
import { loadYoga4U } from '../data.js';
import { esc, openModal } from '../ui.js';

let mode = 'condition';

const CAUTION_CLASS = {
  'HIGH CAUTION': 'pill-crit',
  'CAUTION': 'pill-high',
  'CAUTION — fall risk': 'pill-high',
  'CAUTION — pacing': 'pill-high',
  'Standard': 'pill-low',
};

export async function render(root) {
  const raw = await loadYoga4U();
  const entries = raw.map((e, idx) => ({ ...e, idx }));

  /* Some source phrases carry a per-condition caveat after an em-dash (e.g.
   * "gentle Nadi Shodhana (Anulom Vilom) — AVOID Kapalbhati and Bhastrika")
   * or synonym alternatives split by " / " ("Diaphragmatic breathing / Nadi
   * Shodhana"). Left as raw strings, the SAME practice fragments into several
   * near-duplicate entries in "browse by practice" mode. Canonicalise to the
   * base practice name for grouping only -- the full original phrase is
   * still exactly what's shown in the condition's own chip list. */
  function canonicalName(raw) {
    return raw.split(/\s+—\s+/)[0].split(/\s*\(/)[0].trim();
  }
  function canonicalFragments(raw) {
    return raw.split(/\s+\/\s+/).map(canonicalName).filter(Boolean);
  }

  // Inverted index: canonical practice name (case-insensitive) -> conditions
  // that list a fragment matching it.
  const practiceMap = new Map();
  for (const e of entries) {
    const seenForThisCondition = new Set();
    for (const rawName of e.practiceNames) {
      for (const name of canonicalFragments(rawName)) {
        const key = name.toLowerCase();
        if (seenForThisCondition.has(key)) continue; // don't list a condition twice under one practice
        seenForThisCondition.add(key);
        if (!practiceMap.has(key)) practiceMap.set(key, { name, conditions: [] });
        practiceMap.get(key).conditions.push(e);
      }
    }
  }
  const practices = [...practiceMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  root.innerHTML = `
    <h2 class="section">Yoga4U</h2>
    <p class="lede">
      ${entries.length} conditions, ${practices.length} named asana/pranayama practices.
      A reference for what's commonly indicated, and why to be careful with it — not a
      diagnosis or a treatment plan. Look up a condition to see its practices, or an
      asana/pranayama to see which conditions it's indicated for.
    </p>
    <div class="toolbar">
      <input class="field" id="q" type="search" placeholder="Search a condition, asana or pranayama" autocomplete="off">
      <select class="field" id="mode">
        <option value="condition">Browse by condition</option>
        <option value="practice">Browse by asana / pranayama</option>
      </select>
    </div>
    <div id="list"></div>
  `;

  const list = root.querySelector('#list');
  const sel = root.querySelector('#mode');
  sel.value = mode;

  const draw = () => {
    const q = root.querySelector('#q').value.trim().toLowerCase();

    if (mode === 'condition') {
      const shown = entries
        .filter(e => !q || e.condition.toLowerCase().includes(q) ||
                     e.practiceNames.some(p => p.toLowerCase().includes(q)))
        .sort((a, b) => a.condition.localeCompare(b.condition));

      list.innerHTML = shown.length ? shown.map(e => `
        <details class="alt">
          <summary>
            ${e.cautionLevel ? `<span class="pill ${CAUTION_CLASS[e.cautionLevel] || 'pill-low'}">${esc(e.cautionLevel)}</span>` : ''}
            <span class="alt-name">${esc(e.condition)}</span>
            <span class="alt-share">${e.practiceNames.length} practice${e.practiceNames.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="alt-body">
            <p class="small muted" style="margin:0 0 10px">${esc(e.specialty)} · ${e.source === 'chronic' ? 'Chronic-condition guide' : 'Self-care package'}</p>
            <div class="chips" style="margin-bottom:10px">
              ${e.practiceNames.map(p => `<span class="pill">${esc(p)}</span>`).join('')}
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost small" data-idx="${e.idx}">Full practice detail</button>
            </div>
          </div>
        </details>`).join('')
        : '<div class="empty">Nothing matches that search.</div>';

    } else {
      const shown = practices.filter(p => !q || p.name.toLowerCase().includes(q) ||
                                          p.conditions.some(c => c.condition.toLowerCase().includes(q)));

      list.innerHTML = shown.length ? shown.map(p => `
        <details class="alt">
          <summary>
            <span class="alt-name">${esc(p.name)}</span>
            <span class="alt-share">${p.conditions.length} condition${p.conditions.length === 1 ? '' : 's'}</span>
          </summary>
          <div class="alt-body">
            <p class="small muted" style="margin:0 0 10px">Commonly indicated for:</p>
            <div class="chips">
              ${p.conditions.map(c => `
                <button class="pill" data-idx="${c.idx}" style="cursor:pointer">${esc(c.condition)}</button>`).join('')}
            </div>
          </div>
        </details>`).join('')
        : '<div class="empty">Nothing matches that search.</div>';
    }
  };

  draw();
  root.querySelector('#q').addEventListener('input', draw);
  sel.addEventListener('change', e => { mode = e.target.value; draw(); });

  list.addEventListener('click', e => {
    const btn = e.target.closest('[data-idx]');
    if (!btn) return;
    const entry = entries[Number(btn.dataset.idx)];
    if (entry) openModal(detailHTML(entry), entry.condition);
  });
}

function detailHTML(e) {
  const videoChips = (e.videos || []).filter(v => v.url).map(v =>
    `<a class="pill" href="${esc(v.url)}" target="_blank" rel="noopener">▶ ${esc(v.title)}</a>`).join('');

  return `
    <h3>${esc(e.condition)}</h3>
    <div class="chips" style="margin-bottom:14px">
      <span class="pill">${esc(e.specialty)}</span>
      ${e.cautionLevel ? `<span class="pill ${CAUTION_CLASS[e.cautionLevel] || 'pill-low'}">${esc(e.cautionLevel)}</span>` : ''}
      <span class="pill pill-info" title="${e.source === 'chronic'
        ? 'Not evidence-cited -- commonly-taught practices with a safety note, not literature-backed claims.'
        : 'Evidence-cited -- see Clinician mode on the self-care card for the source.'}">
        ${e.source === 'chronic' ? 'Chronic-condition guide' : 'Self-care package'}
      </span>
    </div>

    ${e.asanas ? `<h4>Indicated asana</h4><p>${esc(e.asanas)}</p>` : ''}
    ${e.pranayama ? `<h4>Indicated pranayama</h4><p>${esc(e.pranayama)}</p>` : ''}

    ${e.safetyNote ? `
      <h4>Safety note</h4>
      <div class="flag"><p>${esc(e.safetyNote)}</p></div>` : ''}

    ${e.practiceDetail ? `
      <h4>Per-practice detail</h4>
      <ul class="remedy-list">
        ${e.practiceDetail.map(d => `
          <li class="remedy-item">
            <p class="remedy-name">${esc(d.name)}</p>
            <p class="small muted clinician-detail-block">${esc(d.note || '')}</p>
            <div class="chips" style="margin-top:6px">
              ${d.evidenceUrl ? `<a class="pill pill-info clinician-detail" href="${esc(d.evidenceUrl)}" target="_blank" rel="noopener">Evidence source ↗</a>` : ''}
              ${d.videoUrl ? `<a class="pill" href="${esc(d.videoUrl)}" target="_blank" rel="noopener">▶ Watch: ${esc(d.video || 'video')}</a>` : ''}
            </div>
          </li>`).join('')}
      </ul>` : ''}

    ${videoChips ? `
      <h4>Practice-along videos</h4>
      <div class="chips">${videoChips}</div>` : ''}

    <p class="small muted" style="margin-top:16px">
      Not a diagnosis or a treatment plan. If this condition isn't already diagnosed and,
      where relevant, medically stable, speak to a clinician before starting.
    </p>
  `;
}
