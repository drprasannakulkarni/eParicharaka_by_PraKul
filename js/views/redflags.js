/* Standalone "should I go to ER right now?" checklist -- independent of the
 * full Check-symptoms interview, for someone who wants an answer to one
 * question fast rather than running an 8-15 question adaptive assessment.
 *
 * Uses the 11 UNIVERSAL red flags from data/red_flags.json (the ones not
 * tied to a specific chief complaint -- sepsis, stroke, anaphylaxis, GI
 * bleed, sudden vision loss, jaundice, delirium, a new seizure, thoughts of
 * self-harm, a non-blanching rash, reduced consciousness). Each flag's own
 * `message` field already states its full compound criteria in plain
 * language ("A fever together with confusion, very fast breathing..."), so
 * this tool asks it as ONE yes/no question per flag rather than
 * re-implementing the allOf/anyOf boolean logic the live interview uses --
 * that logic exists to combine findings gathered one at a time over a
 * session; here the user is answering the whole compound statement at once.
 */
import { loadRedFlags } from '../data.js';
import { esc } from '../ui.js';

export async function render(root) {
  const all = await loadRedFlags().catch(() => []);
  const flags = all.filter(f => f.universal)
    .sort((a, b) => (a.level === b.level ? 0 : a.level === 'EMERGENCY' ? -1 : 1));

  root.innerHTML = `
    <h2 class="section">🚨 Red flags — should I go to the ER right now?</h2>
    <p class="lede">
      A quick check for the most dangerous warning signs, independent of the full symptom
      assessment. Tick anything that is happening to you (or the person you're checking on)
      right now.
    </p>

    <div id="rf-banner"></div>

    <div id="rf-list"></div>

    <p class="small muted" style="margin-top:18px">
      None of these apply, but something still feels wrong? A calm "no" here isn't a clean bill
      of health — it only rules out this specific short list.
      <a href="#check" id="rf-to-check">Run the full symptom check instead</a> for a proper
      differential, or speak to a clinician directly if you're still worried.
    </p>
  `;

  const banner = root.querySelector('#rf-banner');
  const list = root.querySelector('#rf-list');
  const checked = new Set();

  list.innerHTML = flags.map(f => `
    <label class="row rf-row" style="cursor:pointer">
      <input type="checkbox" class="row-check" id="rf-${esc(f.id)}" data-id="${esc(f.id)}" style="pointer-events:auto">
      <span class="row-main">
        <strong>${esc(f.label)}</strong>
        <span>${esc(f.message)}</span>
      </span>
      <span class="pill ${f.level === 'EMERGENCY' ? 'pill-crit' : 'pill-high'}">${esc(f.level)}</span>
    </label>`).join('');

  function updateBanner() {
    const hit = flags.filter(f => checked.has(f.id));
    const emergency = hit.filter(f => f.level === 'EMERGENCY');
    const urgent = hit.filter(f => f.level === 'URGENT');

    if (emergency.length) {
      banner.innerHTML = `
        <div class="triage t-critical">
          <span class="triage-icon" aria-hidden="true">🚑</span>
          <div>
            <h2>Call emergency services now</h2>
            ${emergency.map(f => `<p><strong>${esc(f.label)}:</strong> ${esc(f.action)}</p>`).join('')}
          </div>
        </div>`;
    } else if (urgent.length) {
      banner.innerHTML = `
        <div class="triage t-high">
          <span class="triage-icon" aria-hidden="true">⚠️</span>
          <div>
            <h2>Seek urgent medical assessment</h2>
            ${urgent.map(f => `<p><strong>${esc(f.label)}:</strong> ${esc(f.action)}</p>`).join('')}
          </div>
        </div>`;
    } else {
      banner.innerHTML = `
        <div class="triage t-info">
          <span class="triage-icon" aria-hidden="true">🏠</span>
          <div>
            <h2>None of these apply right now</h2>
            <p>This checklist only covers the most urgent, easy-to-recognise warning signs — it
            is not a full assessment. If you're still concerned, run the full symptom check or
            speak to a clinician.</p>
          </div>
        </div>`;
    }
  }

  updateBanner();
  list.addEventListener('change', e => {
    const box = e.target.closest('[data-id]');
    if (!box) return;
    if (box.checked) checked.add(box.dataset.id); else checked.delete(box.dataset.id);
    updateBanner();
  });
}
