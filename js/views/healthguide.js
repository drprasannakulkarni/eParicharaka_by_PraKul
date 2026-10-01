/* Health Guide: a landing spot for standalone Ayurveda wellness content --
 * deliberately separate from the diagnostic flow (Check symptoms) so general
 * preventive/constitutional material never blurs into disease reasoning.
 * All entries are upcoming; this view just reserves their place. */
import { esc } from '../ui.js';

const UPCOMING = [
  {
    title: 'Know your Prakruti',
    blurb: 'A guided self-assessment of your Ayurvedic constitution -- the stable, individual '
         + 'baseline Ayurveda uses as a reference point for diet and lifestyle guidance.',
  },
  {
    title: 'Rutu Rhythm',
    blurb: 'Seasonal routine (Ritucharya): how diet, activity and daily habits are traditionally '
         + 'adjusted through the year.',
  },
  {
    title: 'Dinacharya',
    blurb: 'Daily routine: a structured guide to the day’s natural rhythm, from waking to sleep.',
  },
];

export async function render(root) {
  root.innerHTML = `
    <h2 class="section">Health Guide</h2>
    <p class="lede">
      General wellness guidance, kept separate from symptom checking on purpose --
      nothing here is part of, or influences, the diagnostic reasoning elsewhere in this app.
    </p>
    <div class="grid" style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      ${UPCOMING.map(item => `
        <div class="card">
          <div class="chips" style="margin-bottom:10px">
            <span class="pill pill-info">Coming soon</span>
          </div>
          <h3 style="margin:0 0 8px">${esc(item.title)}</h3>
          <p class="small muted" style="margin:0">${esc(item.blurb)}</p>
        </div>`).join('')}
    </div>
  `;
}
