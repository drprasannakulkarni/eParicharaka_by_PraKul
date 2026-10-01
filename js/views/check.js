/* The symptom interview: pick a complaint, answer an adaptive series of
 * questions, then a result that shows its working. */
import { loadIndex, loadBundle, loadExamVideos, loadImagery, loadAyurvedaMap, loadAyurvedaExamLibrary, loadSelfCareRemedies, loadNutrition, loadSymptomRedirects, loadClassicalVpk, loadBodyMap, loadEvidence, loadConditions, loadAyurvedaSymptomsLite, groupBySystem } from '../data.js';
import * as iv from '../interview.js';
import { warmDuringInterview } from '../prefetch.js';
import { explainSupport, explainExclusion, whatWouldChangeIt, transcript } from '../explain.js';
import { el, esc, pillClass, figureHTML, skinToneControlHTML, applySkinTone, selfCareSectionHTML, nutritionSectionHTML, buildSymptomLinkIndex, matchedEvidenceIds } from '../ui.js';
import { searchMatches, bestMatch } from '../search.js';
import { groupCcsByZone, subCcs, bodySilhouetteSVG, faceCloseupSVG, armCloseupSVG, legCloseupSVG } from '../bodymap.js';
import { symptomLinkEntries } from './symptoms.js';

const CLOSEUP_SVG = { face: faceCloseupSVG, arm: armCloseupSVG, leg: legCloseupSVG };

let session = null;
let currentQuestion = null;
let stage = 'pick';
let imagery = null;      // loaded once, alongside the first bundle
let pickMode = 'search'; // 'search' | 'bodymap' -- how stage 1 is shown
let bodyMapZone = null;  // selected top-level zone id once tapped, or null (whole-body diagram)
let bodyMapSub = null;   // selected sub-zone id within a drill-down zone (face/arm/leg), or null

export async function render(root) {
  if (stage === 'pick')      return renderPick(root);
  if (stage === 'interview') return renderQuestion(root);
  return renderResult(root);
}

export function reset() {
  session = null; currentQuestion = null; stage = 'pick'; bodyMapZone = null; bodyMapSub = null;
}

/* ------------------------------------------------------------- stage 1 */
async function renderPick(root) {
  const [index, redirects, bodyMap] = await Promise.all([
    loadIndex(), loadSymptomRedirects().catch(() => []), loadBodyMap().catch(() => null),
  ]);
  const ccById = new Map(index.chiefComplaints.map(cc => [cc.id, cc]));
  root.innerHTML = `
    <p class="eyebrow">Step 1 of 3</p>
    <h2 class="section">What is troubling you most?</h2>
    <p class="lede">
      Choose the single symptom that bothers you most. You will be asked about the
      others as we go — usually eight to fifteen questions, fewer when the picture
      becomes clear early.
    </p>
    ${bodyMap ? `
      <div class="pick-mode-toggle" role="tablist" aria-label="How to find your symptom">
        <button type="button" class="tool-btn${pickMode === 'search' ? ' is-on' : ''}" data-mode="search" role="tab" aria-selected="${pickMode === 'search'}">🔍 Search by name</button>
        <button type="button" class="tool-btn${pickMode === 'bodymap' ? ' is-on' : ''}" data-mode="bodymap" role="tab" aria-selected="${pickMode === 'bodymap'}">🩺 Tap on a body map</button>
      </div>` : ''}
    <div id="pick-area"></div>
  `;

  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    pickMode = b.dataset.mode;
    bodyMapZone = null;
    bodyMapSub = null;
    drawPickArea();
  }));

  const pickArea = root.querySelector('#pick-area');

  function drawPickArea() {
    if (pickMode === 'bodymap' && bodyMap) return drawBodyMap();
    return drawSearch();
  }

  /* -------------------------------------------------- body-map sub-mode */
  // Wires click + keyboard (Enter/Space) on every `.bodymap-zone` hotspot in
  // whatever SVG was just inserted -- shared by all three drawing levels
  // below, since a bare SVG <g> carries no native button behaviour of its
  // own. `onSelect(zoneId)` is called with that hotspot's data-zone id.
  function wireHotspots(container, onSelect) {
    container.querySelectorAll('.bodymap-zone').forEach(g => {
      g.addEventListener('click', () => onSelect(g.dataset.zone));
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(g.dataset.zone); }
      });
    });
  }

  function ccGridHTML(ccs) {
    return ccs.length ? `
      <div class="cc-grid">
        ${ccs.map(cc => `
          <button class="cc-btn" data-cc="${esc(cc.id)}">
            <strong>${esc(cc.label)}</strong>
            <span>${esc(cc.layman)}</span>
          </button>`).join('')}
      </div>` : `<p class="small muted">Nothing filed under this area yet.</p>`;
  }

  function drawBodyMap() {
    const byZone = groupCcsByZone(index.chiefComplaints, bodyMap);
    const counts = Object.fromEntries([...byZone].map(([id, ccs]) => [id, ccs.length]));
    const sideButtons = bodyMap.zones.filter(z => !z.hotspot);
    const zone = bodyMapZone ? bodyMap.zones.find(z => z.id === bodyMapZone) : null;

    // Level 1: the whole-body silhouette.
    if (!zone) {
      pickArea.innerHTML = `
        <div class="bodymap-layout">
          <div class="bodymap-figure">${bodySilhouetteSVG(counts)}</div>
          <div class="bodymap-side">
            <p class="small muted" style="margin:0 0 10px">Tap where it's affecting you, or pick one of these if it's not in one place:</p>
            ${sideButtons.map(z => `
              <button type="button" class="btn btn-ghost bodymap-side-btn" data-zone="${z.id}">
                ${esc(z.label)} <span class="muted">(${counts[z.id] || 0})</span>
              </button>`).join('')}
          </div>
        </div>`;
      wireHotspots(pickArea, zoneId => { bodyMapZone = zoneId; bodyMapSub = null; drawPickArea(); });
      pickArea.querySelectorAll('.bodymap-side-btn').forEach(b =>
        b.addEventListener('click', () => { bodyMapZone = b.dataset.zone; drawPickArea(); }));
      return;
    }

    // Level 2: a zone with its own closeup (head/arm/leg) and no sub picked
    // yet -- show the zoomed-in diagram with that area's own hotspots.
    if (zone.drilldown && !bodyMapSub) {
      const subCounts = Object.fromEntries(
        zone.sub.map(s => [s.id, subCcs(zone, s.id, index.chiefComplaints).length]));
      pickArea.innerHTML = `
        <button type="button" class="btn btn-ghost" id="bodymap-back" style="margin-bottom:14px">← Back</button>
        <p class="eyebrow" style="margin:0 0 10px">${esc(zone.label)} — tap the specific area</p>
        <div class="bodymap-layout">
          <div class="bodymap-figure bodymap-figure-closeup">${CLOSEUP_SVG[zone.drilldown](subCounts)}</div>
          <div class="bodymap-side">
            ${zone.sub.map(s => `
              <button type="button" class="btn btn-ghost bodymap-side-btn" data-sub="${s.id}">
                ${esc(s.label)} <span class="muted">(${subCounts[s.id] || 0})</span>
              </button>`).join('')}
          </div>
        </div>`;
      const selectSub = subId => { bodyMapSub = subId; drawPickArea(); };
      wireHotspots(pickArea, selectSub);
      pickArea.querySelectorAll('.bodymap-side-btn').forEach(b =>
        b.addEventListener('click', () => selectSub(b.dataset.sub)));
      pickArea.querySelector('#bodymap-back').addEventListener('click', () => { bodyMapZone = null; drawPickArea(); });
      return;
    }

    // Level 3: the actual complaint list -- either a zone with no
    // closeup (chest/torso), a side button (skin/general), or a chosen
    // sub-area (eyes, wrist, knee...) within a drill-down zone.
    const ccs = bodyMapSub ? subCcs(zone, bodyMapSub, index.chiefComplaints) : (byZone.get(bodyMapZone) || []);
    const label = bodyMapSub ? zone.sub.find(s => s.id === bodyMapSub)?.label : zone.label;
    const backTarget = zone.drilldown && bodyMapSub ? 'sub' : 'zone';
    pickArea.innerHTML = `
      <button type="button" class="btn btn-ghost" id="bodymap-back" style="margin-bottom:14px">← Back</button>
      <p class="eyebrow" style="margin:0 0 10px">${esc(label || '')}</p>
      ${ccs.some(cc => bodyMapSub && ['EV_JOINT_PAIN', 'EV_MUSCLE_ACHES'].includes(cc.id)) ? `
        <p class="small muted" style="margin:0 0 12px">
          These are generalised interview trees that ask which joint or site once you're in them --
          picking one here just gets you there faster, it doesn't skip that question.
        </p>` : ''}
      ${ccGridHTML(ccs)}
    `;
    pickArea.querySelector('#bodymap-back').addEventListener('click', () => {
      if (backTarget === 'sub') bodyMapSub = null; else { bodyMapZone = null; bodyMapSub = null; }
      drawPickArea();
    });
  }

  /* ------------------------------------------------------ search sub-mode */
  function drawSearch() {
    pickArea.innerHTML = `
      <input class="field pick-search" id="cc-search" type="search"
             placeholder="Search symptoms, e.g. chest pain, dizzy, rash" autocomplete="off">
      <div id="cc-list"></div>
    `;
    const list = pickArea.querySelector('#cc-list');
    const search = pickArea.querySelector('#cc-search');
    search.addEventListener('input', e => draw(e.target.value));

    function draw(term = '') {
    const matches = index.chiefComplaints.filter(cc =>
      searchMatches(term, cc.label, cc.layman, ...cc.synonyms));

    if (!matches.length) {
      // The 64 chief complaints are full interview trees; a lot of real,
      // commonly-searched symptoms (sneezing, night sweats, testicular
      // pain...) are genuinely tracked as findings INSIDE those trees but
      // deliberately don't get one of their own -- building a whole new
      // differential for "sneezing" alone would just duplicate what "Runny
      // nose" already covers. This redirect catches that gap: if the typed
      // term matches one of those tracked-but-not-an-entry-point findings,
      // point at the interview(s) that already ask about it, rather than
      // leaving the user at a dead end.
      const hit = term.trim()
        ? bestMatch(term, redirects, r => [r.label, ...r.synonyms])
        : null;
      const targets = hit ? hit.targets.map(id => ccById.get(id)).filter(Boolean) : [];

      list.innerHTML = `<div class="empty" style="text-align:left">
        <p style="text-align:center">No symptom matches "${esc(term)}".</p>
        ${hit ? `
          ${hit.safetyNote ? `
            <div class="flag flag-urgent">
              <h4>${esc(hit.label)}</h4>
              <p class="act">${esc(hit.safetyNote)}</p>
            </div>` : ''}
          <p class="small" style="margin:10px 0 6px;text-align:center">
            "${esc(hit.label)}" isn't its own topic here, but it's covered as part of:
          </p>
          <div class="cc-grid">
            ${targets.map(cc => `
              <button class="cc-btn" data-cc="${esc(cc.id)}">
                <strong>${esc(cc.label)}</strong>
                <span>${esc(cc.layman)}</span>
              </button>`).join('')}
          </div>` : `
          <p class="small" style="text-align:center">This tool covers ${index.chiefComplaints.length} common presenting
          complaints. If yours is not here, please speak to a clinician directly.</p>`}
      </div>`;
      return;
    }

    list.innerHTML = groupBySystem(matches).map(g => `
      <section class="cc-group">
        <h3>${esc(g.name)}</h3>
        <div class="cc-grid">
          ${g.items.map(cc => `
            <button class="cc-btn" data-cc="${esc(cc.id)}">
              <strong>${esc(cc.label)}</strong>
              <span>${esc(cc.layman)}</span>
            </button>`).join('')}
        </div>
      </section>`).join('');
    }

    draw(search.value);
  }

  // Shared by both sub-modes -- a [data-cc] button anywhere in #pick-area
  // (the search grid, a redirect's target list, or a body-map zone's list)
  // starts the interview the same way.
  async function selectCc(e) {
    const btn = e.target.closest('[data-cc]');
    if (!btn) return;
    btn.disabled = true;
    const [bundle, imgs] = await Promise.all([loadBundle(btn.dataset.cc), loadImagery()]);
    imagery = imgs;
    session = iv.createSession(bundle);
    currentQuestion = iv.nextQuestion(session);
    stage = 'interview';
    render(root);
    document.getElementById('main')?.focus();
  }
  pickArea.addEventListener('click', selectCc);

  drawPickArea();
}

/* ------------------------------------------------------------- stage 2 */
function renderQuestion(root) {
  if (!currentQuestion) { stage = 'result'; return render(root); }

  const q = currentQuestion;
  const p = iv.progress(session);
  const multi = q.kind === 'multi';
  const hint = multi ? 'Select all that apply, or "none of these".'
                     : 'Select one answer.';
  const shots = imagery?.questions?.[q.id] || {};
  const illustrated = Object.keys(shots).length > 0;

  root.innerHTML = `
    <div class="interview-grid">
      <aside class="interview-sidebar">${renderSelectedSoFar(session)}</aside>
      <div class="card">
        <div class="qhead">
          <p class="eyebrow" style="margin:0">${esc(session.bundle.chiefComplaint.label)}</p>
          <span class="qcount">${p.pastTypical
            ? `${p.asked + 1} — a closer case, still narrowing it down`
            : `${p.asked >= p.min ? p.asked : p.asked + 1} of ~${p.min}–${p.max}`}</span>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${Math.max(6, p.pct)}%"></div></div>

        <h2 class="qtext">${esc(q.text)}</h2>
        <p class="qhint">${hint}${q.optional ? ' This one is optional.' : ''}</p>

        <form id="qform" class="opts${illustrated ? ' opts-visual' : ''}">
          ${q.options.map((o, i) => {
            // Anatomically sex-exclusive options (vaginal discharge,
            // testicular pain, missed period, pregnancy) are skipped, not
            // spliced out -- the index i must stay the true index into
            // q.options, since answer() below reads chosen options back by
            // that same index.
            if (!iv.optionVisible(session, o)) return '';
            const pic = shots[o.label];
            return `
            <label class="opt${pic ? ' opt-visual' : ''}">
              <input type="${multi ? 'checkbox' : 'radio'}" name="opt" value="${i}">
              ${pic ? figureHTML(pic, { size: 'sm' }) : ''}
              <span class="opt-label">${esc(o.label)}</span>
            </label>`;
          }).join('')}
        </form>
        ${illustrated ? skinToneControlHTML(localStorage.getItem('sc-skin') || 't3') : ''}

        <div class="btn-row">
          <button class="btn" id="next" ${multi ? '' : 'disabled'}>Continue</button>
          ${session.history.length ? '<button class="btn btn-ghost" id="back">Back</button>' : ''}
          <button class="btn btn-ghost" id="skip">I prefer to skip this</button>
          <button class="btn btn-ghost" id="restart">Start over</button>
        </div>
        <p class="small muted" style="margin:10px 0 0">
          Skipping leaves the question unanswered rather than answering "no", so it
          counts neither for nor against anything.
        </p>
      </div>
      <aside class="interview-sidebar interview-vpk-sidebar">${renderVpkPanel(p.vpk)}</aside>
    </div>
  `;

  // The user is reading a question, not waiting on us. Pull what the results
  // page and the other tabs will need.
  warmDuringInterview();

  const form = root.querySelector('#qform');
  const next = root.querySelector('#next');

  form.addEventListener('change', e => {
    if (multi && e.target.checked) {
      // Checking a box clears any other CHECKED box it conflicts with --
      // "None of these" against everything (its denies cover every sibling
      // assert), and genuine opposites (constipated vs loose stools, hot vs
      // cold intolerance) against each other. Reads the same assert/deny
      // data the scoring engine uses; see iv.optionsConflict.
      const justChecked = q.options[+e.target.value];
      form.querySelectorAll('input[type="checkbox"]:checked').forEach(box => {
        if (box === e.target) return;
        const other = q.options[+box.value];
        if (iv.optionsConflict(justChecked, other)) box.checked = false;
      });
    }
    if (!multi) {
      next.disabled = false;
      // Single-choice advances on its own: fewer taps, the way a real triage
      // form works. The pause is long enough to see the selection register,
      // short enough not to feel like waiting.
      setTimeout(() => next.click(), 240);
    }
  });

  next.addEventListener('click', () => {
    const chosen = [...form.querySelectorAll('input:checked')].map(i => +i.value);
    if (!multi && !chosen.length) return;
    iv.answer(session, q, chosen);
    currentQuestion = iv.shouldStop(session) ? null : iv.nextQuestion(session);
    stage = currentQuestion ? 'interview' : 'result';
    render(root);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  root.querySelectorAll('[data-tone]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    applySkinTone(b.dataset.tone);
    render(root);
  }));

  root.querySelector('#skip').addEventListener('click', () => {
    iv.skip(session, q);
    currentQuestion = iv.shouldStop(session) ? null : iv.nextQuestion(session);
    stage = currentQuestion ? 'interview' : 'result';
    render(root);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  root.querySelector('#back')?.addEventListener('click', () => {
    iv.undo(session);
    currentQuestion = iv.nextQuestion(session);
    render(root);
  });
  root.querySelector('#restart')?.addEventListener('click', () => {
    reset(); render(root);
  });
}

/* Running list of what's been selected so far during the interview -- a left
 * sidebar on a wide screen, demoted to a block after the question on a narrow
 * one (see .interview-grid / .interview-sidebar in components.css). Skipped
 * questions are left out: this shows selections, not the full Q&A log (that
 * already exists as the transcript card on the result page). */
function renderSelectedSoFar(session) {
  const answered = transcript(session).filter(t => !t.skipped);
  return `
    <div class="card">
      <p class="eyebrow" style="margin:0 0 10px">Selected so far</p>
      ${answered.length ? `
        <ul class="transcript">
          ${answered.map(t => `<li><q>${esc(t.question)}</q><b>${esc(t.answer)}</b></li>`).join('')}
        </ul>` : `
        <p class="small muted" style="margin:0">Your answers will build up here as you go.</p>`}
    </div>`;
}

/* Right sidebar during the interview: a live Vata/Pitta/Kapha reading built
 * from iv.progress(session).vpk (itself iv.computeVPK -- a simple average of
 * every doshically-tagged option answered so far, see interview.js). Framed
 * as the doshic pattern BEHIND THE CURRENT SYMPTOMS (vikriti), not as a
 * constitutional/prakriti assessment -- this app has no separate prakriti
 * questionnaire, and reading one from symptom answers alone would overclaim.
 * `vpk` is null until at least one doshically-tagged option has been
 * answered (age counts; sex, "none of these" and pure risk-factor answers
 * never carry a doshic weight -- see e-Paricharak_VPK_DiagnosticWeight_
 * Mapping.xlsx's README for the full list of what's excluded and why). */
function renderVpkPanel(vpk) {
  const card = inner => `
    <div class="card">
      <p class="eyebrow" style="margin:0 0 4px">Doshic pattern</p>
      <p class="small muted" style="margin:0 0 12px">Vata / Pitta / Kapha reading of your symptoms so far</p>
      ${inner}
    </div>`;

  if (!vpk) {
    return card(`<p class="small muted" style="margin:0">Answer a couple more questions and a reading will build up here.</p>`);
  }

  const rows = [
    { key: 'vata', label: 'Vata', pct: vpk.vata },
    { key: 'pitta', label: 'Pitta', pct: vpk.pitta },
    { key: 'kapha', label: 'Kapha', pct: vpk.kapha },
  ];
  const top = Math.max(vpk.vata, vpk.pitta, vpk.kapha);
  const leaders = rows.filter(r => r.pct === top);
  const dominantClass = leaders.length > 1 ? 'is-mixed' : `is-${leaders[0].key}`;
  const dominantText = leaders.length > 1
    ? `No single dosha dominates yet (${leaders.map(l => l.label).join(' / ')} tied)`
    : `${leaders[0].label}-predominant pattern so far`;

  return card(`
    ${rows.map(r => `
      <div class="vpk-row is-${r.key}">
        <div class="vpk-row-head">
          <span class="vpk-name">${r.label}</span>
          <span class="vpk-pct">${r.pct}%</span>
        </div>
        <div class="vpk-track"><div class="vpk-fill" style="width:${Math.max(2, r.pct)}%"></div></div>
      </div>`).join('')}
    <p class="vpk-dominant ${dominantClass}">${esc(dominantText)}</p>
    <p class="small muted" style="margin:10px 0 0">Based on ${vpk.n} answered finding${vpk.n === 1 ? '' : 's'} so far -- a classical-physiology reading, not a diagnosis.</p>
  `);
}

/* ------------------------------------------------------------- stage 3 */
async function renderResult(root) {
  const res = iv.result(session);
  const bundle = session.bundle;
  const [lead, ...rest] = res.ranked;
  const alternatives = rest.slice(0, 4);
  const t = lead.triage;

  // score() returns a projection; exam, labs and systems live on the full
  // condition record in the bundle.
  const leadCond = findCond(bundle, lead.id);
  const support = explainSupport(bundle, leadCond, lead);
  const flags = res.redFlags;

  // Integrative (Ayurveda) panel: gated on triage, never shown for anything
  // Emergency/Urgent or flagged infectious -- biomedical triage advice only there.
  const ayurvedaMap = await loadAyurvedaMap().catch(() => null);
  const ayurvedaEntry = ayurvedaMap?.[lead.id];
  const ayurvedaExamLib = ayurvedaEntry?.eligible ? await loadAyurvedaExamLibrary().catch(() => null) : null;

  // VPK score for the diagnosis: prefer the CLASSICAL entity's own doshic
  // profile (eParicharak_VPK_Mapping's automated read of
  // Cl_Decision_Tree_Symptom_Dataset_Integrative.xlsx) wherever that
  // condition has a matched Ayurveda entity; otherwise fall back to this
  // session's own live reading from the answered symptoms (iv.computeVPK --
  // the same number the interview sidebar showed). Computed for every
  // ranked condition shown on this page, not just the lead.
  const classicalVpk = await loadClassicalVpk().catch(() => null);
  const sessionVpk = iv.computeVPK(session);
  const leadVpk = vpkForCondition(lead.id, ayurvedaMap, classicalVpk, sessionVpk);

  // Only fetched when the Ayurveda card can actually show something --
  // symptomsLite backs the "N of M classical symptoms matched" overlap
  // count, symIndex is the phrase index that finds them inside the
  // classical symptom text (same mechanism Ayurveda A-Z already uses to
  // link a symptom mention to its biomedical write-up, just reused here to
  // COUNT matches instead of linking them).
  let symptomsLite = null, symIndex = null;
  if (ayurvedaEntry?.entities?.length) {
    // symptomLinkEntries needs the REAL conditions array, not a stand-in --
    // it only keeps an evidence id if some condition's own sens map
    // actually uses it (buildIndex's final .filter(s => s.conditions.length)
    // in symptoms.js), so passing [] silently produced an empty index here
    // during testing (caught live: every overlap count came back 0/N).
    const [lite, evidence, allConditions] = await Promise.all([
      loadAyurvedaSymptomsLite().catch(() => ({})), loadEvidence().catch(() => []), loadConditions().catch(() => []),
    ]);
    symptomsLite = lite;
    symIndex = buildSymptomLinkIndex(symptomLinkEntries(allConditions, evidence));
  }

  // Self-care package (biomedicine + Ayurveda + Yoga): gated on Emergency/
  // Urgent only -- deliberately NOT on the infectious flag the Ayurveda card
  // above also excludes. That flag exists to keep classical Ayurveda theory
  // away from infections; this card is plain practical self-care (rest,
  // fluids, honey, gargling), which is standard advice for exactly the
  // self-limiting viral illnesses (colds, viral pharyngitis, sinusitis...)
  // that flag would otherwise hide it from.
  //
  // 'urgent' alone is a genuine chronic-condition trap: it drives the SAME
  // triage banner ("see a doctor today") whether this is a brand-new,
  // undiagnosed presentation (where that urgency is correct and must not be
  // softened) or a flare of an already-diagnosed chronic condition (RA, IBD,
  // AFib, stable angina...) that also has a real, ongoing self-management
  // phase. conditions.json's chronicSelfCareEligible flag decouples the two:
  // it never changes the triage banner above, it only additionally unlocks
  // this card for the specific conditions where that's been deliberately
  // reviewed and confirmed appropriate.
  const selfCareEligible = lead.acuity !== 'emergency' &&
    (lead.acuity !== 'urgent' || leadCond.chronicSelfCareEligible === true);
  const selfCareMap = selfCareEligible ? await loadSelfCareRemedies().catch(() => null) : null;
  const selfCareEntry = selfCareMap?.[lead.id];

  // Nutrition panel: same eligibility gate as the self-care card above (not
  // Emergency/Urgent) -- only 49 of 136 conditions have a genuine, evidence-
  // based nutrient recommendation at all (data/nutrition.json), so most leads
  // simply won't have an entry and the card silently doesn't render.
  const nutritionMap = selfCareEligible ? await loadNutrition().catch(() => null) : null;
  const nutritionEntry = nutritionMap?.[lead.id];

  root.innerHTML = `
    <div class="print-header">
      <h2>e-Paricharaka VPK — Symptom Assessment Summary</h2>
      <p>${esc(session.bundle.chiefComplaint.label)} · ${esc(new Date().toLocaleString())}</p>
      <p>Not a diagnosis. Generated by an automated symptom assessment; findings and doshic readings are
      model estimates pending clinical sign-off. An AI Initiative from Dr.Prasanna Kulkarni.</p>
    </div>

    <div class="triage t-${res.triage.tone}">
      <span class="triage-icon" aria-hidden="true">${triageIcon(res.triage.tone)}</span>
      <div>
        <h2>${esc(res.triage.label)} — ${esc(res.triage.window)}</h2>
        <p>${esc(res.triage.action)}</p>
      </div>
    </div>

    ${flags.length ? `
      <div style="margin-bottom:18px">
        <p class="eyebrow">Warning signs you reported</p>
        ${flags.map(f => `
          <div class="flag ${f.level === 'URGENT' ? 'flag-urgent' : ''}">
            <h4>${esc(f.label)}</h4>
            <p>${esc(f.message)}</p>
            <p class="act">${esc(f.action)}</p>
          </div>`).join('')}
      </div>` : ''}

    <div class="card lead-card">
      <p class="eyebrow">Most likely explanation</p>
      <div class="lead-head">
        <div>
          <h2 class="lead-name">${esc(lead.name)}</h2>
          <div class="lead-meta">
            <span class="pill ${pillClass(lead.acuity)}">${esc(t.label)}</span>
            <span class="pill">${esc(lead.specialty)}</span>
            <span class="pill">ICD-10 ${esc(lead.icd10)}</span>
          </div>
        </div>
        <div class="confidence">
          <b>${Math.round(lead.share * 100)}%</b>
          <span>of shortlist</span>
        </div>
      </div>

      ${renderVpkBadge(leadVpk)}

      <p class="small muted" style="margin:14px 0 0">${esc(lead.summary)}</p>

      <h4 class="eyebrow" style="margin:20px 0 8px">Why this fits your answers</h4>
      <ul class="reasons">
        ${support.length ? support.map(s => `
          <li>
            <span class="tick tick-yes" aria-hidden="true">${s.direction === 'present' ? '✓' : 'â—‹'}</span>
            <span>${esc(s.text)}</span>
            <span class="lr-tag" title="Likelihood ratio">×${s.lr.toFixed(1)}</span>
          </li>`).join('')
        : '<li><span class="muted">Too few answers to give specific reasons.</span></li>'}
      </ul>
    </div>

    <div class="card">
      <p class="eyebrow">What else was considered, and why it fits less well</p>
      <p class="small muted" style="margin:0 0 14px">
        These are the closest alternatives. Each one lists the findings that argue against it.
      </p>
      ${alternatives.map(a => renderAlternative(bundle, a, vpkForCondition(a.id, ayurvedaMap, classicalVpk, sessionVpk))).join('')}
    </div>

    <div class="card">
      <p class="eyebrow">Clinical examination to confirm</p>
      <p class="small muted" style="margin:0 0 14px">
        Bedside manoeuvres that would settle ${esc(lead.name)}, and what a positive
        result looks like.
      </p>
      <ul class="exam-list">
        ${leadCond.exam.map(e => `
          <li>
            <span class="exam-step">${esc(e.step)}</span>
            <span class="exam-pos">${esc(e.positive)}</span>
          </li>`).join('')}
      </ul>
    </div>

    <div class="card">
      <p class="eyebrow">Definitive investigations</p>
      <p class="small muted" style="margin:0 0 14px">
        Grouped by who can order them, so the in-clinic steps come first.
      </p>
      ${renderLabs(leadCond.labs)}
    </div>

    ${renderSelfCareCard(selfCareEntry, leadVpk)}

    ${renderNutritionCard(nutritionEntry)}

    ${renderAyurvedaCard(ayurvedaEntry, leadCond, ayurvedaExamLib, { classicalVpk, sessionVpk, symptomsLite, symIndex })}

    <div class="card" id="video-card">
      <p class="eyebrow">Examination technique — video guides</p>
      <p class="small muted" style="margin:0 0 14px">
        System-specific refreshers for the examination above. Search links are filtered
        to videos under four minutes.
      </p>
      <div id="video-slots"><span class="muted small">Loading resources...</span></div>
    </div>

    ${renderNextBest(session)}

    <div class="card">
      <p class="eyebrow">Your answers</p>
      <ul class="transcript">
        ${transcript(session).map(t2 => `
          <li><q>${esc(t2.question)}</q><b${t2.skipped ? ' class="muted"' : ''}>${esc(t2.answer)}</b></li>`).join('')}
      </ul>
    </div>

    <div class="btn-row" style="margin-top:18px">
      <button class="btn" id="again">Check another symptom</button>
      <button class="btn btn-ghost" id="copy">Copy case summary</button>
      <button class="btn btn-ghost" id="download">Download as text</button>
      <button class="btn btn-ghost" id="print">Print or save as PDF</button>
      <span class="small muted" id="copy-note" role="status"></span>
    </div>
  `;

  root.querySelector('#again').addEventListener('click', () => { reset(); render(root); });
  root.querySelector('#print').addEventListener('click', () => window.print());

  root.querySelector('#resume')?.addEventListener('click', () => {
    currentQuestion = iv.nextQuestion(session);
    if (currentQuestion) { stage = 'interview'; render(root); window.scrollTo({ top: 0 }); }
  });

  const note = root.querySelector('#copy-note');
  root.querySelector('#copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(caseSummary(session, res, leadCond, bundle, ayurvedaMap, classicalVpk, sessionVpk));
      note.textContent = 'Copied to clipboard.';
    } catch {
      note.textContent = 'Clipboard blocked — use Download instead.';
    }
    setTimeout(() => { note.textContent = ''; }, 4000);
  });

  root.querySelector('#download').addEventListener('click', () => {
    const blob = new Blob([caseSummary(session, res, leadCond, bundle, ayurvedaMap, classicalVpk, sessionVpk)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `symptom-check-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // videos load after the clinical content is on screen: they are a reference,
  // not part of the decision, and should never delay it
  loadExamVideos().then(all => {
    const slots = root.querySelector('#video-slots');
    if (!slots) return;
    const systems = (leadCond.systems || []).filter(s => all[s]);
    if (!systems.length) { root.querySelector('#video-card')?.remove(); return; }
    slots.innerHTML = systems.map(s => renderVideoSystem(all[s])).join('');
  }).catch(() => root.querySelector('#video-card')?.remove());
}

/* Self-care package: conventional, Ayurveda and Yoga home remedies, each
 * independently sourced (see e-Paricharak_SelfCare_Conditions.xlsx). Plain
 * remedy + description + link by default; Clinician mode additionally shows
 * the evidence tier/source and citation URL via the existing .clinician-detail
 * pattern -- same toggle the Ayurveda card below already uses, so a lay
 * reader sees "what to do", and Clinician mode adds "why, and how well-
 * evidenced". `entry` is null whenever the condition has no self-care package
 * (not one of the 14 covered) or was gated out (Emergency/Urgent lead). */
/* General Vata/Pitta/Kapha pacification principles -- classical, textbook-
 * level guidance (opposite-quality pacification, "like increases like"),
 * not specific to any one condition. Deliberately generic: this is a small
 * ADD-ON note above the existing self-care content, not a re-tagging of the
 * ~166 individual remedies with their own dosha, which would be a much
 * bigger authoring project than what was asked for here. */
const DOSHA_PACIFYING_NOTE = {
  vata: 'Ayurveda generally favours warm, moist, grounding approaches for a Vata-dominant picture -- regular routine, cooked and warming food, avoiding cold, dry or irregular habits.',
  pitta: 'Ayurveda generally favours cooling, calming approaches for a Pitta-dominant picture -- less spicy/sour/salty food, avoiding excess heat and overexertion.',
  kapha: 'Ayurveda generally favours light, warming, stimulating approaches for a Kapha-dominant picture -- lighter meals, regular activity, avoiding heavy, oily or cold food and excess sleep.',
};

function doshaSelfCareNote(vpk) {
  if (!vpk) return '';
  const rows = [['vata', vpk.v], ['pitta', vpk.p], ['kapha', vpk.k]].sort((a, b) => b[1] - a[1]);
  const [topKey, topPct] = rows[0];
  const [, secondPct] = rows[1];
  // Only worth naming a "dominant" dosha when there's a real gap -- a near-
  // even split (e.g. the 34/33/33 tridosha default) isn't a dominant
  // anything, and saying so would overclaim precision the reading doesn't have.
  if (topPct < 40 || topPct - secondPct < 10) return '';
  return `<p class="small muted" style="margin:0 0 14px">
    <strong>${esc(topKey[0].toUpperCase() + topKey.slice(1))}-dominant reading (${topPct}%):</strong>
    ${esc(DOSHA_PACIFYING_NOTE[topKey])}
  </p>`;
}

function renderSelfCareCard(entry, vpk) {
  if (!entry) return '';
  const cited = entry.evidenceCited !== false;
  const intro = cited
    ? `${esc(entry.condition)} can usually be managed at home. What helps, from three angles —
       conventional, Ayurveda, and Yoga — and when to see a doctor instead.`
    : `${esc(entry.condition)} is a long-term condition. These are commonly-practised self-care
       measures alongside your ongoing medical treatment — not a replacement for it — from three
       angles: conventional, Ayurveda, and Yoga.`;
  return `
    <div class="card">
      <p class="eyebrow">Self-care guide</p>
      ${doshaSelfCareNote(vpk)}
      ${selfCareSectionHTML(entry, { intro })}
    </div>`;
}

/* Nutrition panel: which nutrients have a genuine, evidence-based management
 * role for the lead condition, at what dose, from what food sources, and how
 * strong the evidence actually is. Gated the same way as the self-care card
 * above (not Emergency/Urgent) -- `entry` is null whenever the condition has
 * no nutrition database row (87 of 136 don't) or was gated out. */
function renderNutritionCard(entry) {
  if (!entry) return '';
  const intro = `Nutrients with a genuine, evidence-based role in managing ${esc(entry.condition)} —
    adjuncts to your ongoing medical treatment, not a replacement for it.`;
  return `
    <div class="card card-nutrition">
      <p class="eyebrow remedy-heading-nutrition">Nutrition</p>
      ${nutritionSectionHTML(entry, { intro })}
    </div>`;
}

/* Charaka Samhita, Sutrasthana 18/44 -- shown wherever the Ayurveda card
 * ends up with NO single classical name to offer (no correlate found, or
 * only reference-only material). Placed there deliberately: it's the exact
 * scenario the verse addresses, and it reframes "no name" as classically
 * legitimate rather than a gap in this app -- paired with a pointer back to
 * the Vata/Pitta/Kapha reading already shown above, which stands on its own
 * whether or not a name was ever settled on. */
const CHARAKA_SUTRA_18_44 = {
  devanagari: 'à¤µà¤¿à¤•à¤¾à¤°à¤¨à¤¾à¤®à¤¾à¤•à¥à¤¶à¤²à¥‹ à¤¨ à¤œà¤¿à¤¹à¥à¤°à¥€à¤¯à¤¾à¤¤à¥ à¤•à¤¦à¤¾à¤šà¤¨ |\nà¤¨ à¤¹à¤¿ à¤¸à¤°à¥à¤µà¤µà¤¿à¤•à¤¾à¤°à¤¾à¤£à¤¾à¤‚ à¤¨à¤¾à¤®à¤¤à¥‹à¤½à¤¸à¥à¤¤à¤¿ à¤¸à¥à¤¥à¤¿à¤¤à¤¿à¤°à¥à¤§à¥à¤°à¥à¤µà¤¾ ||',
  translation: 'A physician should never feel ashamed or embarrassed at being unable to name a disease exactly -- there is no fixed rule that every manifestation of disease must have a definite name.',
  reference: 'Charaka Samhita, Sutrasthana 18/44',
};

function charakaNoNameNoteHTML() {
  return `
    <blockquote class="small clinician-detail-block" style="margin:10px 0 0;padding:10px 14px;
                background:var(--ayur-bg);border-left:3px solid var(--ayur);
                border-radius:var(--r-sm)">
      <p style="margin:0 0 6px;font-family:var(--serif);white-space:pre-wrap">${esc(CHARAKA_SUTRA_18_44.devanagari)}</p>
      <p class="small muted" style="margin:0 0 4px">${esc(CHARAKA_SUTRA_18_44.translation)}</p>
      <p class="small muted" style="margin:0;font-weight:600">— ${esc(CHARAKA_SUTRA_18_44.reference)}</p>
    </blockquote>
    <p class="small muted" style="margin:8px 0 0">
      The Vata/Pitta/Kapha reading above still stands on its own, name or no name.
    </p>`;
}

/* Ranks a condition's matched Ayurveda entities (usually 1, sometimes
 * several dosha-subtyped variants of the same disease -- see e.g. Peptic
 * Ulcer's "parinama shula"/"vatika parinama shula"/"paittika parinama
 * shula") against what this SESSION actually reported, instead of just
 * listing them in whatever order the entity-matching project originally
 * found them. Each entity gets its own classical VPK (where one exists)
 * and its own symptom-overlap count against session.present; sorted by
 * VPK-closeness to the session reading, so the subtype that best fits THIS
 * presentation surfaces first -- a genuinely symptom-driven refinement of a
 * match that was previously a static, condition-level lookup. Falls back to
 * the original order when there's nothing to rank by (single entity, or no
 * VPK data on any of them). */
function rankAyurvedaEntities(entities, { classicalVpk, sessionVpk, symptomsLite, symIndex, session }) {
  const enriched = entities.map(e => {
    const key = e.name.trim().toLowerCase();
    const vpk = classicalVpk?.[key] || null;
    const symptoms = symptomsLite?.[key] || [];
    let matched = 0;
    if (symIndex && symptoms.length) {
      for (const s of symptoms) {
        const ids = matchedEvidenceIds(s.meaning || '', symIndex);
        if ([...ids].some(id => session.present.has(id))) matched++;
      }
    }
    const dist = vpk && sessionVpk ? vpkDistance(vpk, { v: sessionVpk.vata, p: sessionVpk.pitta, k: sessionVpk.kapha }) : null;
    return { ...e, vpk, symptomTotal: symptoms.length, symptomMatched: matched, dist };
  });

  const rankable = enriched.filter(e => e.dist !== null);
  const ranked = rankable.length > 1
    ? [...enriched].sort((a, b) => (a.dist ?? 999) - (b.dist ?? 999))
    : enriched;
  return { ranked, wasRanked: rankable.length > 1 };
}

/* The integrative panel. Deliberately name-and-examination only -- no nidana,
 * dosha-dushya or samprapti theory. Gated entirely on ayurvedaEntry.eligible,
 * which the dataset build already set to false for anything Emergency, Urgent
 * or flagged infectious: for those, this card simply doesn't render, and the
 * triage banner above is the only advice given. */
function renderAyurvedaCard(entry, leadCond, examLib, vpkCtx = {}) {
  if (!entry?.eligible) return '';

  const entities = entry.entities || [];
  const systems = leadCond.systems || [];
  const { ranked, wasRanked } = rankAyurvedaEntities(entities, { session, ...vpkCtx });

  const entityBlock = ranked.length
    ? `<p class="small muted" style="margin:0 0 10px">
         Nearest Ayurveda clinical entity, for context alongside the biomedical picture above.
         ${wasRanked ? ' Where more than one classical subtype has been matched, the one closest to your own Vata/Pitta/Kapha reading is shown first.' : ''}
       </p>
       <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start">
         ${ranked.map((e, i) => `
           <span style="width:100%">
             <span class="pill pill-info" title="${esc(e.detail || '')}">${esc(e.name)}</span>
             ${wasRanked && i === 0 ? `<span class="pill" style="margin-left:6px">Best fit for your symptoms</span>` : ''}
             ${e.vpk ? `
               <span class="vpk-badge vpk-badge-compact" style="margin:6px 0 0">
                 <span class="vpk-chip is-vata">Vata ${e.vpk.v}%</span>
                 <span class="vpk-chip is-pitta">Pitta ${e.vpk.p}%</span>
                 <span class="vpk-chip is-kapha">Kapha ${e.vpk.k}%</span>
               </span>` : ''}
             ${e.symptomTotal ? `
               <p class="small muted" style="margin:4px 0 0">
                 ${e.symptomMatched} of ${e.symptomTotal} classical symptoms for this entity match what you reported this session.
               </p>` : ''}
             <span class="small muted clinician-detail" style="display:block;margin-top:2px">
               ${esc(e.source)} — ${esc(e.detail || '')}. Clinically reviewed by Dr. Prasanna Kulkarni.
             </span>
             ${e.sloka ? `
               <blockquote class="small clinician-detail-block" style="margin:6px 0 0;padding:8px 12px;
                           background:var(--ayur-bg);border-left:3px solid var(--ayur);
                           border-radius:var(--r-sm);font-family:var(--serif);white-space:pre-wrap">
                 ${esc(e.sloka)}
               </blockquote>` : ''}
           </span>`).join('')}
       </div>`
    : entry.hasAuditedReference
      ? `<p class="small muted">
           No single classical term corresponds cleanly, but citation-backed classical
           clinical material exists for this presentation.
         </p>
         ${charakaNoNameNoteHTML()}`
      : `<p class="small muted">No established Ayurveda correlate identified for this condition yet.</p>
         ${charakaNoNameNoteHTML()}`;

  const examBlock = (examLib && systems.length)
    ? systems.filter(s => examLib[s]).map(s => renderAyurvedaExamSystem(examLib[s])).join('')
    : '';

  return `
    <div class="card card-ayurveda">
      <p class="eyebrow remedy-heading-ayurveda">Ayurveda perspective</p>
      <p class="small muted clinician-detail-block" style="margin:0 0 10px;font-style:italic">
        Clinician mode — source and confidence detail shown inline below.
      </p>
      ${entityBlock}
      ${examBlock ? `
        <h4 class="eyebrow" style="margin:18px 0 8px">Darshana &amp; Sparshana pareeksha</h4>
        <p class="small muted" style="margin:0 0 12px">
          Physical examination of the involved area, for the physician to perform alongside
          the biomedical examination above.
        </p>
        ${examBlock}` : ''}
    </div>`;
}

function renderAyurvedaExamSystem(sys) {
  return `
    <div style="margin-bottom:14px">
      <p style="font-weight:600;margin:0 0 8px">${esc(sys.srotas)}</p>
      <p class="small muted" style="margin:0 0 6px">Darshana (inspection)</p>
      <ul class="exam-list" style="margin-bottom:10px">
        ${sys.darshana.map(d => `<li><span class="exam-step">${esc(d)}</span></li>`).join('')}
      </ul>
      <p class="small muted" style="margin:0 0 6px">Sparshana (palpation)</p>
      <ul class="exam-list">
        ${sys.sparshana.map(d => `<li><span class="exam-step">${esc(d)}</span></li>`).join('')}
      </ul>
      ${sys.notes ? `<p class="small muted" style="margin-top:8px">${esc(sys.notes)}</p>` : ''}
    </div>`;
}

/* The engine already knows which unasked question would separate the current
 * candidates best. Naming it turns a finished result into a next step, which is
 * the question a clinician asks anyway: what else would I need to know? */
function renderNextBest(session) {
  const q = iv.nextQuestion(session);
  if (!q) return '';
  const gain = iv.expectedInfoGain(session.bundle, session, q);
  if (gain < 0.01) return '';

  return `
    <div class="card" style="border-left:3px solid var(--info)">
      <p class="eyebrow">What would sharpen this most</p>
      <p class="small muted" style="margin:0 0 10px">
        Of everything still unasked, this question separates the remaining
        possibilities best.
      </p>
      <p style="font-family:var(--serif);font-size:1.08rem;font-weight:600;margin:0 0 12px">
        ${esc(q.text)}
      </p>
      <button class="btn" id="resume">Answer this and continue</button>
    </div>`;
}

/* A plain-text record for pasting into a consultation note. Deliberately not a
 * PDF or a branded form: it has to survive being dropped into any EMR field. */
function vpkSummaryLine(vpk) {
  if (!vpk) return '';
  const src = vpk.source === 'classical'
    ? `classical profile of "${vpk.entityName}", ${vpk.confidence} confidence`
    : `from the symptoms you reported this session`;
  return ` — VPK Vata ${vpk.v}% / Pitta ${vpk.p}% / Kapha ${vpk.k}% (${src})`;
}

function caseSummary(session, res, leadCond, bundle, ayurvedaMap, classicalVpk, sessionVpk) {
  const L = [];
  const now = new Date();
  L.push('SYMPTOM CHECK SUMMARY');
  L.push(now.toLocaleString());
  L.push('');
  L.push(`Presenting complaint: ${session.bundle.chiefComplaint.label}`);
  L.push(`Triage: ${res.triage.label} — ${res.triage.window}`);
  L.push(`Action: ${res.triage.action}`);
  L.push('');

  if (res.redFlags.length) {
    L.push('RED FLAGS TRIGGERED');
    for (const f of res.redFlags) L.push(`  [${f.level}] ${f.label} — ${f.action}`);
    L.push('');
  }

  L.push('HISTORY GIVEN');
  for (const t of transcript(session)) L.push(`  ${t.question}\n    ${t.answer}`);
  L.push('');

  L.push('DIFFERENTIAL (share of shortlist)');
  res.ranked.slice(0, 5).forEach((r, i) => {
    const vpk = ayurvedaMap && classicalVpk ? vpkForCondition(r.id, ayurvedaMap, classicalVpk, sessionVpk) : null;
    L.push(`  ${i + 1}. ${r.name} — ${(r.share * 100).toFixed(1)}%  [${r.triage.label}, ICD-10 ${r.icd10}]${vpkSummaryLine(vpk)}`);
  });
  L.push('');

  L.push(`SUPPORTING ${res.ranked[0].name.toUpperCase()}`);
  for (const s of explainSupport(session.bundle, leadCond, res.ranked[0])) {
    L.push(`  - ${s.text} (LR ${s.lr.toFixed(1)})`);
  }
  L.push('');

  // Why each alternative ranks lower -- mirrors the "Arguments against" the
  // on-screen/printed alternatives already show, so the plain-text export
  // isn't missing the one thing that actually explains the ranking.
  const alternatives = res.ranked.slice(1, 5);
  if (alternatives.length) {
    L.push('WHY THE ALTERNATIVES RANK LOWER');
    for (const alt of alternatives) {
      const altCond = bundle ? findCond(bundle, alt.id) : null;
      const against = bundle && altCond ? explainExclusion(bundle, altCond, alt) : [];
      L.push(`  ${alt.name}:`);
      if (against.length) {
        for (const a of against) L.push(`    - ${a.text} (LR ${a.lr.toFixed(2)})`);
      } else {
        L.push('    Nothing reported argues strongly against it; ranks lower mainly on baseline likelihood.');
      }
    }
    L.push('');
  }

  L.push('EXAMINATION TO CONFIRM');
  for (const e of leadCond.exam) L.push(`  - ${e.step}\n      ${e.positive}`);
  L.push('');

  L.push('INVESTIGATIONS');
  for (const l of leadCond.labs) {
    L.push(`  [${l.tier}] ${l.test} — ${l.confirms}`);
  }
  L.push('');
  L.push('---');
  L.push('Generated by an automated symptom assessment. Not a diagnosis.');
  L.push('Findings, frequencies and doshic (Vata/Pitta/Kapha) readings are model estimates pending clinical sign-off.');
  L.push('An AI Initiative from Dr.Prasanna Kulkarni — prasanna4ai@gmail.com');
  return L.join('\n');
}

export function renderLabs(labs) {
  const TIERS = [
    ['bedside',  'In the consulting room', 'Nothing to order'],
    ['gp',       'A GP can request these', 'Primary care'],
    ['referral', 'Needs secondary care',   'What will follow on referral'],
  ];
  return TIERS.map(([tier, title, note]) => {
    const items = labs.filter(l => l.tier === tier);
    if (!items.length) return '';
    return `
      <h4 class="eyebrow" style="margin:16px 0 8px">${esc(title)}
        <span class="muted" style="font-weight:500;text-transform:none;letter-spacing:0"> — ${esc(note)}</span></h4>
      <ul class="lab-list">
        ${items.map(l => `
          <li>
            <span class="tier tier-${tier}">${tier === 'gp' ? 'GP' : esc(tier)}</span>
            <span class="lab-body">
              <span class="lab-test">${esc(l.test)}</span>
              <span class="lab-conf">${esc(l.confirms)}</span>
            </span>
          </li>`).join('')}
      </ul>`;
  }).join('');
}

export function renderVideoSystem(sys) {
  const ICON = { search: '🔍', channel: '📺', guide: '📄' };
  return `
    <h4 class="eyebrow" style="margin:16px 0 8px">${esc(sys.label)}
      <span class="muted" style="font-weight:500;text-transform:none;letter-spacing:0"> — ${esc(sys.blurb)}</span></h4>
    <div class="vid-grid">
      ${sys.resources.map(r => `
        <a class="vid" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
          <span class="vid-ico" aria-hidden="true">${ICON[r.kind] || '🔗'}</span>
          <span>
            <span class="vid-t">${esc(r.title)}</span>
            <span class="vid-s">${esc(r.source)} · ${esc(r.note)}</span>
          </span>
        </a>`).join('')}
    </div>`;
}

function renderAlternative(bundle, alt, vpk) {
  const cond = findCond(bundle, alt.id);
  const against = explainExclusion(bundle, cond, alt);
  const revisit = whatWouldChangeIt(bundle, cond, session);

  return `
    <details class="alt">
      <summary>
        <span class="pill ${pillClass(alt.acuity)}">${esc(alt.triage.label)}</span>
        <span class="alt-name">${esc(alt.name)}</span>
        <span class="alt-share">${alt.share < 0.005 ? '<1' : Math.round(alt.share * 100)}%</span>
      </summary>
      <div class="alt-body">
        ${renderVpkBadge(vpk, { compact: true })}
        <p class="small muted" style="margin:0 0 12px">${esc(alt.summary)}</p>
        ${against.length ? `
          <h4 class="eyebrow" style="margin:0 0 8px">Arguments against</h4>
          <ul class="reasons">
            ${against.map(r => `
              <li>
                <span class="tick tick-no" aria-hidden="true">✕</span>
                <span>${esc(r.text)}</span>
                <span class="lr-tag" title="Likelihood ratio">×${r.lr.toFixed(2)}</span>
              </li>`).join('')}
          </ul>` : `
          <p class="small muted">Nothing you reported argues strongly against this. It ranks
          lower mainly because it is less common in this setting.</p>`}
        ${revisit.length ? `
          <h4 class="eyebrow" style="margin:16px 0 8px">Would raise this again</h4>
          <p class="small muted" style="margin:0">
            ${revisit.map(r => esc(r.layman.toLowerCase())).join(', ')}.
            Seek review if any of these develop.
          </p>` : ''}
      </div>
    </details>`;
}

/* VPK score for a diagnosed condition on the result page. Two sources,
 * preferred in this order:
 *   1. CLASSICAL -- the condition has a matched Ayurveda entity
 *      (ayurveda_map.json's entities[]) whose name resolves in
 *      classical_vpk.json (eParicharak_VPK_Mapping's automated read of
 *      Cl_Decision_Tree_Symptom_Dataset_Integrative.xlsx). This is the
 *      classical disease's OWN doshic profile, independent of what this
 *      particular user answered.
 *   2. SESSION -- no confident classical match exists for this condition
 *      (true for most of the 261 -- see the entity-matching project's own
 *      history), so fall back to this session's live VPK reading, computed
 *      from the symptoms actually answered. Same number for every ranked
 *      condition in that case, since it isn't condition-specific -- labelled
 *      accordingly so it never reads as if it were the condition's own
 *      classical profile.
 * Returns null if neither is available (nothing answered yet, e.g. a fully
 * skipped interview). */
function vpkForCondition(condId, ayurvedaMap, classicalVpk, sessionVpk) {
  const entities = ayurvedaMap?.[condId]?.entities || [];
  for (const e of entities) {
    const key = (e.name || '').trim().toLowerCase();
    const hit = classicalVpk?.[key];
    if (hit) {
      return {
        source: 'classical', entityName: e.name,
        v: hit.v, p: hit.p, k: hit.k, confidence: hit.confidence,
        // Carried through (not flattened away) so renderVpkBadge can show
        // how closely what THIS person actually reported lines up with the
        // classical entity's own profile -- two different numbers that
        // happen to both exist once a condition is matched.
        sessionVpk,
      };
    }
  }
  if (sessionVpk) {
    return { source: 'session', v: sessionVpk.vata, p: sessionVpk.pitta, k: sessionVpk.kapha, n: sessionVpk.n };
  }
  return null;
}

/* Total-variation-style distance between two V/P/K triples that each sum to
 * 100 -- half the sum of absolute per-axis differences, so it's naturally
 * bounded 0 (identical) to 100 (completely disjoint, e.g. 100/0/0 vs
 * 0/0/100), the same units as the percentages themselves. */
function vpkDistance(a, b) {
  return (Math.abs(a.v - b.v) + Math.abs(a.p - b.p) + Math.abs(a.k - b.k)) / 2;
}

function vpkMatchPhrase(vpk) {
  if (vpk.source !== 'classical' || !vpk.sessionVpk) return '';
  const sv = { v: vpk.sessionVpk.vata, p: vpk.sessionVpk.pitta, k: vpk.sessionVpk.kapha };
  const dist = vpkDistance(vpk, sv);
  const verdict = dist < 15 ? 'closely matches' : dist < 40 ? 'broadly consistent with' : 'differs noticeably from';
  return ` What you actually reported this session (Vata ${sv.v}% / Pitta ${sv.p}% / Kapha ${sv.k}%) ${verdict} this classical profile.`;
}

function renderVpkBadge(vpk, { compact = false } = {}) {
  if (!vpk) return '';
  const isClassical = vpk.source === 'classical';
  // Two genuinely different kinds of number, and they must never look
  // interchangeable: a classical entity's own profile vs. this session's
  // one live reading, silently repeated identically against every
  // unmatched condition on the page. Even in compact mode (the
  // alternatives list) a short source tag stays attached to the chips --
  // dropping it there would let two unrelated "closest alternatives" show
  // the exact same percentages with nothing marking that as a fallback
  // rather than a coincidence.
  const shortTag = isClassical
    ? `classical: ${esc(vpk.entityName)}`
    : `from your symptoms`;
  const note = isClassical
    ? `Classical doshic profile of "${esc(vpk.entityName)}" (${esc(vpk.confidence)} confidence) — see Cl_Decision_Tree_Symptom_Dataset_Integrative.xlsx's VPK_Methodology sheet.${esc(vpkMatchPhrase(vpk))}`
    : `Estimated from the ${vpk.n} symptom${vpk.n === 1 ? '' : 's'} you answered — no confident classical match for this condition yet, so this is the SAME reading shown for every other unmatched condition here, not specific to this one`;
  return `
    <div class="vpk-badge${compact ? ' vpk-badge-compact' : ''}">
      <span class="vpk-chip is-vata">Vata ${vpk.v}%</span>
      <span class="vpk-chip is-pitta">Pitta ${vpk.p}%</span>
      <span class="vpk-chip is-kapha">Kapha ${vpk.k}%</span>
      <span class="vpk-source-tag ${isClassical ? 'is-classical' : 'is-session'}">${shortTag}</span>
      ${compact ? '' : `<p class="small muted" style="margin:6px 0 0;flex-basis:100%">${note}</p>`}
    </div>`;
}

const findCond = (bundle, id) => bundle.conditions.find(c => c.id === id);

function triageIcon(tone) {
  return { critical: '🚨', high: '⚠️', moderate: '📋', low: '📅', info: '🏠' }[tone] || '📋';
}




