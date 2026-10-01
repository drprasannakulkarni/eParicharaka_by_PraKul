/* Small shared helpers. */
import { SCHEMATICS, SKIN_TONES } from './imagery.js';

/* A photograph wins when one has been supplied, because a real image beats a
   drawing. Until then the drawing carries it. */
export function figureHTML(spec, { caption = null, size = 'md' } = {}) {
  if (!spec) return '';
  if (spec.photo && spec.photo.file) {
    return `
      <figure class="fig fig-${esc(size)}">
        <img src="assets/photos/${esc(spec.photo.file)}" alt="${esc(spec.alt || '')}" loading="lazy">
        <figcaption>
          ${caption || spec.caption ? `<span>${esc(caption || spec.caption)}</span>` : ''}
          <span class="fig-credit">${esc(spec.photo.credit)} · ${esc(spec.photo.licence)}</span>
        </figcaption>
      </figure>`;
  }
  const art = SCHEMATICS[spec.schematic];
  if (!art) return '';
  return `
    <figure class="fig fig-${esc(size)}" role="group" aria-label="${esc(spec.alt || art.label)}">
      ${art.svg}
      ${caption || spec.caption || art.caption
        ? `<figcaption><span>${esc(caption || spec.caption || art.caption)}</span>
             <span class="fig-note">illustration, not a photograph</span></figcaption>`
        : ''}
    </figure>`;
}

/* Skin tone is stored, not guessed. Redness, cyanosis and non-blanching rashes
   all read differently on deeper tones, and a single default tone is a known
   source of missed diagnosis. */
export function applySkinTone(id) {
  const t = SKIN_TONES.find(x => x.id === id) || SKIN_TONES[2];
  const r = document.documentElement;
  r.style.setProperty('--skin', t.skin);
  r.style.setProperty('--skin-shade', t.shade);
  r.style.setProperty('--erythema', t.erythema);
  r.style.setProperty('--scale-col', t.scale);
  localStorage.setItem('sc-skin', t.id);
  return t;
}

export function skinToneControlHTML(activeId) {
  return `
    <div class="tone" role="group" aria-label="Skin tone for illustrations">
      <span class="tone-label">Skin tone in illustrations</span>
      <div class="tone-swatches">
        ${SKIN_TONES.map(t => `
          <button class="tone-sw${t.id === activeId ? ' is-on' : ''}" data-tone="${t.id}"
                  style="background:${t.skin}" title="${esc(t.label)}"
                  aria-label="${esc(t.label)}" aria-pressed="${t.id === activeId}"></button>`).join('')}
      </div>
    </div>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function el(tag, attrs = {}, html = '') {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (html) n.innerHTML = html;
  return n;
}

export function pillClass(acuity) {
  return {
    emergency: 'pill-crit', urgent: 'pill-high', soon: 'pill-mod',
    routine: 'pill-low', self_care: 'pill-info',
  }[acuity] || '';
}

export const ACUITY_LABEL = {
  emergency: 'Emergency', urgent: 'Urgent', soon: 'See a doctor soon',
  routine: 'Routine', self_care: 'Self-care',
};

/* Shared "pick 2-N items and compare them" behaviour -- used by Conditions
 * A-Z and Ayurveda A-Z so both browse-and-compare tools work identically
 * rather than each view growing its own slightly-different version. A
 * plain object of mutable state (not a class) to keep it easy to close over
 * from each view's own render(), same style as everything else here.
 *
 * `max` defaults to 4: a comparison starts meaningful at 2, and stays
 * readable up to about 4 columns in the modal -- beyond that a table stops
 * being something you can actually read at a glance. */
export function createCompareState(max = 4) {
  return {
    max,
    selection: [],
    toggle(id) {
      if (this.selection.includes(id)) {
        this.selection = this.selection.filter(x => x !== id);
      } else if (this.selection.length < this.max) {
        this.selection = [...this.selection, id];
      } else {
        // At the cap -- swap out the oldest pick rather than silently
        // ignoring the tap, so the control never feels stuck.
        this.selection = [...this.selection.slice(1), id];
      }
    },
    clear() { this.selection = []; },
  };
}

/* Renders the chip row + action buttons for a createCompareState() -- one
 * chip per current selection (with its own ✕ to deselect) plus a trailing
 * "+ Add another" chip while under the cap, so it's visually obvious you
 * can keep going past the first 2. `labelOf(id)` supplies each chip's text. */
export function compareBarHTML(state, labelOf) {
  if (!state.selection.length) {
    return `<p class="small muted" style="margin:0">Tap up to ${state.max} below to compare them.</p>`;
  }
  return `
    <div class="compare-chips">
      ${state.selection.map(id => `
        <span class="compare-chip">
          ${esc(labelOf(id))}
          <button type="button" class="compare-chip-x" data-remove="${esc(id)}" aria-label="Remove ${esc(labelOf(id))}">✕</button>
        </span>`).join('')}
      ${state.selection.length < state.max
        ? `<button type="button" class="compare-chip compare-chip-add" id="compare-add">+ Add another</button>`
        : ''}
    </div>
    <div class="compare-actions">
      ${state.selection.length >= 2 ? `<button type="button" class="btn" id="do-compare">Compare selected (${state.selection.length})</button>` : ''}
      <button type="button" class="btn btn-ghost" id="clear-compare">Clear</button>
    </div>`;
}

/* Wires the chip-remove buttons, the clear button, and "+ Add another"
 * (focuses `searchInput` so the next pick is a type-and-tap away rather than
 * scrolling the whole A-Z list) inside `container`. `onChange` re-draws
 * both the bar and the underlying row list after any change -- the caller's
 * job, since only it knows how its own rows should reflect selection state. */
export function wireCompareBar(container, state, onChange, searchInput) {
  container.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
    state.toggle(b.dataset.remove);
    onChange();
  }));
  container.querySelector('#clear-compare')?.addEventListener('click', () => {
    state.clear();
    onChange();
  });
  container.querySelector('#compare-add')?.addEventListener('click', () => {
    searchInput?.focus();
    searchInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

/* A single modal, reused by every view that needs a detail panel. It also carries
 * a small back-stack so content that links to *another* detail (see linkifyBio
 * below) can drill in with pushModal() and the reader can always find their way
 * back to where they started, not just close the whole thing. */
let modal;
let backStack = [];       // [{ html, label }] -- what to restore, and what to call it
let currentHTML = null;
let currentLabel = null;

function ensureModal() {
  if (modal) return;
  modal = el('div', { class: 'modal', hidden: '' });
  modal.innerHTML = '<div class="modal-panel"></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('.modal-close')) { closeModal(); return; }
    if (e.target.closest('.modal-back')) { goBack(); return; }
    const bioLink = e.target.closest('.bio-link');
    if (bioLink) {
      e.preventDefault();
      openConditionModal(bioLink.dataset.cnd);
      return;
    }
    const symLink = e.target.closest('.sym-link');
    if (symLink) {
      e.preventDefault();
      openSymptomModal(symLink.dataset.ev);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

function renderPanel(html, backLabel) {
  const panel = modal.querySelector('.modal-panel');
  panel.innerHTML = `
    <button class="modal-close" aria-label="Close">✕</button>
    ${backLabel ? `<button class="modal-back">← Back to ${esc(backLabel)}</button>` : ''}
    ${html}`;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal-close').focus();
  hydrateVideos(modal);
}

/* Opens a fresh detail panel and clears any drill-down history -- the normal
 * entry point every A-Z list already uses. */
export function openModal(html, label = null) {
  ensureModal();
  backStack = [];
  currentHTML = html;
  currentLabel = label;
  renderPanel(html, null);
}

/* Drills into a second detail panel from within the first, remembering how to
 * get back. `label` names what's being shown now (e.g. "Rheumatoid arthritis"),
 * so the *next* push (or the initial openModal's label) becomes the ""¹ Back to
 * ..." text once the reader drills further. */
export function pushModal(html, label) {
  ensureModal();
  if (currentHTML != null) backStack.push({ html: currentHTML, label: currentLabel });
  currentHTML = html;
  currentLabel = label;
  renderPanel(html, backStack.length ? backStack[backStack.length - 1].label : null);
}

function goBack() {
  if (!backStack.length) return;
  const prev = backStack.pop();
  currentHTML = prev.html;
  currentLabel = prev.label;
  renderPanel(prev.html, backStack.length ? backStack[backStack.length - 1].label : null);
}

/* Loads a condition's own detail panel (the same one Conditions A-Z opens) and
 * drills into it. Dynamic-imported, same lazy-cross-view pattern as
 * hydrateVideos below, so ui.js never statically depends on a view module. */
async function openConditionModal(cndId) {
  try {
    const [{ loadConditions, loadEvidence }, { detailHTML, ensureSelfCareLoaded, ensureNutritionLoaded }] = await Promise.all([
      import('./data.js'), import('./views/conditions.js'),
    ]);
    const [conditions, evidence] = await Promise.all([loadConditions(), loadEvidence(), ensureSelfCareLoaded(), ensureNutritionLoaded()]);
    const c = conditions.find(x => x.id === cndId);
    if (!c) return;
    const evMap = new Map(evidence.map(e => [e.id, e]));
    pushModal(detailHTML(c, evMap), c.name);
  } catch (err) { console.error(err); }
}

/* A handful of single-word aliases are ordinary English words with an unrelated
 * everyday sense, so auto-linking the bare word is more often wrong than right --
 * caught by auditing the actual matches this produced against the Ayurveda
 * glossary: "Consumption" (TB's archaic name) fired 7 times on "over consumption
 * of [taste]" dietary-excess terms against 3 real hits; "Ectopic" fired on
 * "ectopic eruption" (a skin-lesion term, nothing to do with ectopic pregnancy);
 * "Stroke" fired on "heat stroke" (a different condition from ischaemic stroke).
 * The full condition name/phrase (e.g. "Pulmonary tuberculosis", "Ectopic
 * pregnancy") is unaffected -- only these specific bare words are excluded.
 * Add to this list only after checking it produces more wrong hits than right
 * ones, the same way these three were confirmed. */
const AMBIGUOUS_WORD_EXCLUDE = new Set(['consumption', 'ectopic', 'stroke']);

/* Builds a lookup of every condition's name + aliases, longest phrase first, for
 * turning a mention of a modern diagnosis inside classical-term text (e.g.
 * Amavata's meaning, "rheumatism due to ama") into a link to that condition's
 * own biomedical detail panel. Phrases of 4 chars or fewer are skipped -- short
 * acronyms like "RA" or "TB" are too collision-prone to auto-link in free text. */
export function buildBioLinkIndex(conditions) {
  const seen = new Set();
  const entries = [];
  for (const c of conditions) {
    for (const raw of [c.name, ...(c.aka || [])]) {
      const phrase = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      const key = phrase.toLowerCase();
      if (phrase.length <= 4 || seen.has(key) || AMBIGUOUS_WORD_EXCLUDE.has(key)) continue;
      seen.add(key);
      entries.push({ phrase, id: c.id });
    }
  }
  entries.sort((a, b) => b.phrase.length - a.phrase.length);
  return entries;
}

/* Loads a symptom's own detail panel from Symptoms A-Z (a Sanskrit symptom's
 * English meaning, e.g. "fever", clicking through to the biomedical write-up
 * of Fever -- which conditions it's most sensitive/specific for) and drills
 * into it. Mirrors openConditionModal above. */
async function openSymptomModal(evId) {
  try {
    const [{ loadConditions, loadEvidence }, { findSymptomHTML }] = await Promise.all([
      import('./data.js'), import('./views/symptoms.js'),
    ]);
    const [conditions, evidence] = await Promise.all([loadConditions(), loadEvidence()]);
    const html = findSymptomHTML(evId, conditions, evidence);
    if (!html) return;
    const ev = evidence.find(e => e.id === evId);
    pushModal(html, ev ? ev.label : 'symptom');
  } catch (err) { console.error(err); }
}

/* Builds a lookup of every catalogued symptom's label + synonyms, longest
 * phrase first, for turning a mention inside a Sanskrit term's own symptom
 * list (e.g. Amavata's symptom "jwara" = "fever") into a link to that
 * symptom's own biomedical write-up in Symptoms A-Z. Same length/collision
 * discipline as buildBioLinkIndex. */
export function buildSymptomLinkIndex(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    for (const raw of [e.label, ...(e.synonyms || [])]) {
      const phrase = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      const key = phrase.toLowerCase();
      if (phrase.length <= 4 || seen.has(key) || AMBIGUOUS_WORD_EXCLUDE.has(key)) continue;
      seen.add(key);
      out.push({ phrase, id: e.id });
    }
  }
  out.sort((a, b) => b.phrase.length - a.phrase.length);
  return out;
}

/* Escapes `text`, then wraps any run matching a phrase in `index` with a
 * clickable link (`cls`/`attr`/`attrVal` pick the class and data-attribute, so
 * this serves both the disease-link and symptom-link cases). Matching runs on
 * already-escaped text so nothing in a phrase can inject markup, and
 * alternatives are tried longest-first so "Rheumatoid arthritis" wins over a
 * shorter overlapping alias before "Rheumatism" gets a chance to. Compiled
 * patterns are cached per index (WeakMap, keyed by the index array itself) so
 * repeated calls across many glossary entries don't recompile the same regex. */
const patternCache = new WeakMap();
function linkifyWithIndex(text, index, cls, attr) {
  const safe = esc(text);
  if (!text || !index || !index.length) return safe;
  let pattern = patternCache.get(index);
  if (!pattern) {
    const alt = index.map(e => e.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    pattern = new RegExp(`\\b(${alt})\\b`, 'gi');
    patternCache.set(index, pattern);
  }
  return safe.replace(pattern, m => {
    const hit = index.find(e => e.phrase.toLowerCase() === m.toLowerCase());
    return hit ? `<a href="#" class="${cls}" data-${attr}="${hit.id}">${m}</a>` : m;
  });
}

export function linkifyBio(text, index) {
  return linkifyWithIndex(text, index, 'bio-link', 'cnd');
}

export function linkifySymptom(text, index) {
  return linkifyWithIndex(text, index, 'sym-link', 'ev');
}

/* Same phrase index as linkifySymptom above, but returns WHICH evidence ids
 * a piece of classical-symptom text matches, instead of building a link --
 * used to check "did the app actually track this classical symptom as
 * something the user could have reported" (the Ayurveda card's symptom-
 * overlap count), where a set of ids is what's needed, not markup. */
export function matchedEvidenceIds(text, index) {
  const ids = new Set();
  if (!text || !index || !index.length) return ids;
  for (const e of index) {
    const re = new RegExp(`\\b${e.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) ids.add(e.id);
  }
  return ids;
}

/* A detail panel can ask for examination resources by leaving a placeholder
 * with the systems it needs. Loaded after the panel is on screen so opening
 * never waits on a second fetch. */
async function hydrateVideos(scope) {
  const slot = scope.querySelector('#modal-videos');
  if (!slot || !slot.dataset.systems) return;
  try {
    const [{ loadExamVideos }, { renderVideoSystem }] = await Promise.all([
      import('./data.js'), import('./views/check.js'),
    ]);
    const all = await loadExamVideos();
    const wanted = slot.dataset.systems.split(',').filter(s => all[s]);
    if (!wanted.length) return;
    slot.innerHTML = `<h4>Examination technique — video guides</h4>` +
                     wanted.map(s => renderVideoSystem(all[s])).join('');
  } catch { /* resources are a bonus; never break the panel over them */ }
}

export function closeModal() {
  if (modal) modal.hidden = true;
  document.body.style.overflow = '';
  backStack = [];
  currentHTML = null;
  currentLabel = null;
}

/* Self-care section (conventional + Ayurveda + Yoga remedies): shared by the
 * Check-symptoms result card and every condition-detail modal (Conditions
 * A-Z, and anywhere that reuses that same detail -- Symptoms A-Z,
 * Investigations, cross-links from Ayurveda A-Z) so a reader finds the same
 * home-care guidance whether they arrived by diagnosis or by browsing/
 * searching directly. `entry` is one value from data/selfcare_remedies.json,
 * or falsy if the condition has none. `heading` lets each caller phrase its
 * own intro (the live Check-symptoms result vs. a reference-browsing modal
 * read differently) while the remedy lists themselves stay identical. */
export function selfCareSectionHTML(entry, { intro } = {}) {
  if (!entry) return '';
  const cited = entry.evidenceCited !== false;

  const remedyRow = (r, { showVideo = false, segment = '' } = {}) => `
    <li class="remedy-item${segment ? ` remedy-item-${segment}` : ''}">
      <p class="remedy-name">${esc(r.remedy || r.name)}</p>
      <p class="small muted clinician-detail-block">${esc(r.note || '')}</p>
      <div class="chips" style="margin-top:6px">
        ${r.url || r.evidenceUrl ? `<a class="pill pill-info clinician-detail" href="${esc(r.url || r.evidenceUrl)}" target="_blank" rel="noopener">Evidence source ↗</a>` : ''}
        ${showVideo && r.videoUrl ? `<a class="pill" href="${esc(r.videoUrl)}" target="_blank" rel="noopener">▶ Watch: ${esc(r.video || 'video')}</a>` : ''}
      </div>
    </li>`;

  const courseLabel = cited ? 'Typically resolves' : 'Course';
  const seekHeading = cited ? 'See a doctor instead if...' : 'Seek medical attention if...';

  return `
    ${intro ? `<p class="small muted" style="margin:0 0 10px">${intro}</p>` : ''}
    <div class="chips" style="margin-bottom:6px">
      <span class="pill pill-low">${esc(courseLabel)}: ${esc(entry.evidence.recovery)}</span>
      <span class="pill ${cited ? 'pill-info' : ''}" title="${cited
          ? 'Cochrane-review-backed — see Clinician mode for the citation.'
          : 'Commonly-taught, practical guidance — not independently cited. See Clinician mode for detail per remedy below.'}">
        ${cited ? '✓ Evidence-reviewed' : 'Not independently cited'}
      </span>
    </div>
    ${cited ? `
      <p class="small muted clinician-detail-block" style="margin:0 0 10px; font-style:italic">
        ${esc(entry.evidence.quote)} — <a href="${esc(entry.evidence.url)}" target="_blank" rel="noopener">${esc(entry.evidence.source)} ↗</a>
      </p>` : ''}
    <div class="flag" style="margin-bottom:16px">
      <h4>${esc(seekHeading)}</h4>
      <p>${esc(entry.evidence.seekCareIf)}</p>
    </div>

    <h4 class="eyebrow remedy-heading-conventional" style="margin:18px 0 8px">Conventional self-care</h4>
    <ul class="remedy-list">${entry.conventional.map(r => remedyRow(r, { segment: 'conventional' })).join('')}</ul>

    <h4 class="eyebrow remedy-heading-ayurveda" style="margin:20px 0 8px">Ayurveda home remedies</h4>
    <ul class="remedy-list">${entry.ayurveda.map(r => remedyRow(r, { segment: 'ayurveda' })).join('')}</ul>

    <h4 class="eyebrow remedy-heading-yoga" style="margin:20px 0 8px">Yoga &amp; pranayama</h4>
    <ul class="remedy-list">${entry.yoga.map(r => remedyRow(r, { showVideo: true, segment: 'yoga' })).join('')}</ul>
    ${entry.bonusShorts?.length ? `
      <p class="small muted" style="margin:10px 0 6px">More short practice videos:</p>
      <div class="chips">
        ${entry.bonusShorts.map(s => s.url ? `<a class="pill" href="${esc(s.url)}" target="_blank" rel="noopener">▶ ${esc(s.title)}</a>` : '').join('')}
      </div>` : ''}

    <p class="small muted" style="margin-top:16px">
      See the <a href="#yoga4u">Yoga4U</a> tab for more practices and other conditions.
    </p>`;
}

const NUTRIENT_ROLE_PILL = {
  'Primary': 'pill-low',
  'Adjunctive': 'pill-info',
  'Supportive': '',
  'Limited evidence': 'pill-mod',
};

/* Nutrition section: shared by the Check-symptoms result card and every
 * condition-detail modal (Conditions A-Z, Symptoms A-Z, Investigations,
 * Ayurveda A-Z cross-links) -- same pattern as selfCareSectionHTML above, so
 * a reader finds the same nutrient guidance whether they arrived by
 * diagnosis or by browsing directly. `entry` is one value from
 * data/nutrition.json, or falsy if the condition has none (most don't --
 * only 49 of 136 conditions have a genuine, evidence-based nutrient role;
 * see Coverage_Note in Nutrition_Disease_Database.xlsx for why the rest
 * don't). Evidence tier/source/URL sit behind Clinician mode, same as the
 * self-care remedy list; the nutrient name, role, dosage and food sources
 * are always visible since that's the actionable part. */
export function nutritionSectionHTML(entry, { intro } = {}) {
  if (!entry || !entry.nutrients?.length) return '';

  const row = n => `
    <li class="remedy-item remedy-item-nutrition">
      <p class="remedy-name">
        ${esc(n.nutrient)}
        <span class="pill ${NUTRIENT_ROLE_PILL[n.role] || ''}" style="margin-left:6px">${esc(n.role)}</span>
      </p>
      <p class="small muted">${esc(n.mechanism)}</p>
      <p class="small" style="margin:6px 0 0"><b>Recommended intake:</b> ${esc(n.dosage)}</p>
      <p class="small muted" style="margin:4px 0 0"><b>Food sources:</b> ${esc(n.foodSources)}</p>
      ${n.caution ? `<p class="small muted" style="margin:4px 0 0">âš  ${esc(n.caution)}</p>` : ''}
      <div class="chips clinician-detail-block" style="margin-top:6px">
        <span class="pill pill-info">${esc(n.evidenceTier)}</span>
        ${n.url ? `<a class="pill" href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.source)} ↗</a>` : `<span class="pill">${esc(n.source)}</span>`}
      </div>
    </li>`;

  return `
    ${intro ? `<p class="small muted" style="margin:0 0 10px">${intro}</p>` : ''}
    <ul class="remedy-list">${entry.nutrients.map(row).join('')}</ul>
    <p class="small muted" style="margin-top:16px">
      Adjuncts to, never replacements for, standard medical treatment. See the
      <a href="#nutrition4u">Nutrition4U</a> tab for the full nutrient-by-nutrient reference.
    </p>`;
}

