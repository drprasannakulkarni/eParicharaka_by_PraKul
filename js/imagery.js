/* Clinical schematics.
 *
 * These are drawings, not photographs, and that is deliberate.
 *
 * A photograph of one patient's shingles is one instance of shingles, carrying
 * that patient's skin tone, that room's lighting and whatever else was on the
 * skin that day. A schematic isolates the single feature the question turns on
 * -- the band stopping dead at the midline -- and nothing else.
 *
 * Skin tone is a variable rather than an assumption. Clinical image libraries
 * skew heavily toward pale skin, and erythema, cyanosis and non-blanching
 * rashes all read differently on darker skin; that gap is a documented source
 * of missed diagnosis. Every drawing here takes --skin and --erythema from the
 * tone the user picks, and the erythema hue shifts toward violaceous on deeper
 * tones because that is how it actually presents.
 *
 * Nothing here is a substitute for looking at the patient.
 */

/* Fitzpatrick-ish scale. `erythema` is the colour redness actually reads as on
 * that tone, not a fixed red laid over everything. */
export const SKIN_TONES = [
  { id: 't1', label: 'Very fair',  skin: '#f6ddcd', shade: '#e8c4ac', erythema: '#d1454a', scale: '#f2ece4' },
  { id: 't2', label: 'Fair',       skin: '#eec9a8', shade: '#dbaf8a', erythema: '#c8434a', scale: '#f0e7db' },
  { id: 't3', label: 'Medium',     skin: '#d9a06b', shade: '#bf8552', erythema: '#b04046', scale: '#e8dac6' },
  { id: 't4', label: 'Olive',      skin: '#b57a49', shade: '#9a6338', erythema: '#9c3f48', scale: '#dbc9ae' },
  { id: 't5', label: 'Brown',      skin: '#8d5524', shade: '#71411a', erythema: '#7d3644', scale: '#c9b394' },
  { id: 't6', label: 'Deep brown', skin: '#5c3317', shade: '#452510', erythema: '#63304a', scale: '#a8906f' },
];

const S = 'var(--skin)';
const SH = 'var(--skin-shade)';
const ERY = 'var(--erythema)';
const SC = 'var(--scale-col)';

/* A patch of skin to draw a lesion on. */
const skinPatch = (r = 8) =>
  `<rect x="2" y="2" width="116" height="116" rx="${r}" fill="${S}"/>`;

/* Body outline, front view, 80x160. Deliberately schematic. */
const body = (extra = '') => `
<svg viewBox="0 0 80 160" role="img" class="cs">
  <g fill="${S}" stroke="${SH}" stroke-width="1.1">
    <circle cx="40" cy="15" r="10"/>
    <path d="M31 26h18l7 5 4 30-6 2-3-16v27H29V47l-3 16-6-2 4-30z"/>
    <path d="M31 74h7v52h-7z"/><path d="M42 74h7v52h-7z"/>
    <path d="M22 40l-5 30 5 2 6-28z"/><path d="M58 40l5 30-5 2-6-28z"/>
  </g>
  ${extra}
</svg>`;

export const SCHEMATICS = {

  /* ------------------------------------------------- the glass test */
  blanch_no: {
    label: 'Spots stay visible under the glass',
    caption: 'Non-blanching. The spots are still there through the pressed glass — this is the pattern that matters.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <g fill="${ERY}">
    <circle cx="34" cy="40" r="4"/><circle cx="52" cy="32" r="3"/><circle cx="70" cy="44" r="4.5"/>
    <circle cx="44" cy="58" r="3.5"/><circle cx="63" cy="66" r="3"/><circle cx="82" cy="56" r="3.5"/>
    <circle cx="36" cy="78" r="3"/><circle cx="55" cy="86" r="4"/><circle cx="76" cy="82" r="3"/>
  </g>
  <g>
    <rect x="30" y="26" width="62" height="62" rx="4" fill="#cfe8f5" fill-opacity=".34"
          stroke="#7fb8d6" stroke-width="2.5"/>
    <rect x="30" y="26" width="62" height="18" rx="4" fill="#ffffff" fill-opacity=".22"/>
  </g>
</svg>`,
  },

  blanch_yes: {
    label: 'Spots fade under the glass',
    caption: 'Blanching. The redness disappears where the glass presses, and returns when released.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <g fill="${ERY}">
    <circle cx="20" cy="36" r="4"/><circle cx="22" cy="70" r="3.5"/>
    <circle cx="100" cy="44" r="4"/><circle cx="98" cy="80" r="3"/>
    <circle cx="60" cy="16" r="3.5"/><circle cx="52" cy="104" r="3.5"/>
  </g>
  <g>
    <rect x="30" y="26" width="62" height="62" rx="4" fill="${S}" fill-opacity=".92"/>
    <rect x="30" y="26" width="62" height="62" rx="4" fill="#cfe8f5" fill-opacity=".30"
          stroke="#7fb8d6" stroke-width="2.5"/>
    <rect x="30" y="26" width="62" height="18" rx="4" fill="#ffffff" fill-opacity=".22"/>
  </g>
</svg>`,
  },

  /* ------------------------------------------------- rash morphology */
  vesicular: {
    label: 'Small fluid-filled blisters',
    caption: 'Clustered thin-walled blisters on a red base, often grouped rather than scattered.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <ellipse cx="60" cy="60" rx="42" ry="30" fill="${ERY}" fill-opacity=".38"/>
  <g stroke="${SH}" stroke-width="1">
    <circle cx="44" cy="52" r="7" fill="#f7f1dc" fill-opacity=".95"/>
    <circle cx="62" cy="46" r="6" fill="#f7f1dc" fill-opacity=".95"/>
    <circle cx="78" cy="56" r="7.5" fill="#f7f1dc" fill-opacity=".95"/>
    <circle cx="52" cy="70" r="6.5" fill="#f7f1dc" fill-opacity=".95"/>
    <circle cx="70" cy="72" r="6" fill="#f7f1dc" fill-opacity=".95"/>
  </g>
  <g fill="#ffffff" fill-opacity=".7">
    <circle cx="42" cy="49" r="2"/><circle cx="60" cy="43" r="1.7"/>
    <circle cx="76" cy="53" r="2.1"/><circle cx="50" cy="67" r="1.8"/>
  </g>
</svg>`,
  },

  weal: {
    label: 'Raised weals that move around',
    caption: 'Pale raised centres with a red flare, irregular outlines, gone from any one spot within a day.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <g>
    <path d="M26 44q14-16 32-8t26 2 6 20-18 14-30 4-20-12 4-20z" fill="${ERY}" fill-opacity=".34"/>
    <path d="M34 48q12-11 26-5t20 2 4 13-14 9-24 2-16-8 4-13z" fill="${S}"
          stroke="${SH}" stroke-width="1"/>
    <path d="M30 84q10-10 22-5t16 6-4 12-20 3-18-6z" fill="${ERY}" fill-opacity=".34"/>
    <path d="M36 86q8-6 16-3t11 4-3 7-14 2-12-4z" fill="${S}" stroke="${SH}" stroke-width="1"/>
  </g>
</svg>`,
  },

  plaque_scale: {
    label: 'Thick raised patches with silvery scale',
    caption: 'Well-demarcated plaques with a loose silvery scale that lifts at the edge.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <g>
    <rect x="24" y="30" width="46" height="38" rx="9" fill="${ERY}" fill-opacity=".55"/>
    <rect x="26" y="32" width="42" height="34" rx="8" fill="${SC}" fill-opacity=".82"/>
    <g stroke="${SC}" stroke-width="2.4" stroke-linecap="round" opacity=".95">
      <path d="M31 40h32"/><path d="M31 48h28"/><path d="M31 56h33"/>
    </g>
    <rect x="58" y="72" width="34" height="26" rx="7" fill="${ERY}" fill-opacity=".55"/>
    <rect x="60" y="74" width="30" height="22" rx="6" fill="${SC}" fill-opacity=".82"/>
    <g stroke="${SC}" stroke-width="2.2" stroke-linecap="round">
      <path d="M64 82h22"/><path d="M64 89h18"/>
    </g>
  </g>
</svg>`,
  },

  target_ring: {
    label: 'A red ring that keeps getting bigger',
    caption: 'An expanding ring with the centre clearing as the edge advances outward.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <circle cx="60" cy="60" r="44" fill="none" stroke="${ERY}" stroke-width="3" stroke-opacity=".28" stroke-dasharray="5 5"/>
  <circle cx="60" cy="60" r="34" fill="none" stroke="${ERY}" stroke-width="9"/>
  <circle cx="60" cy="60" r="25" fill="${S}"/>
  <circle cx="60" cy="60" r="6" fill="${ERY}" fill-opacity=".8"/>
  <g stroke="${ERY}" stroke-width="1.6" stroke-opacity=".55" stroke-linecap="round">
    <path d="M60 12v-6"/><path d="M60 108v6"/><path d="M12 60H6"/><path d="M108 60h6"/>
  </g>
</svg>`,
  },

  cellulitis: {
    label: 'A spreading area of hot, red, tender skin',
    caption: 'Diffuse redness with an ill-defined edge. Marking the border shows whether it is advancing.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <path d="M22 62q6-30 34-32t44 20-10 44-48 8-20-40z" fill="${ERY}" fill-opacity=".22"/>
  <path d="M32 62q6-22 28-24t34 16-8 32-38 6-16-30z" fill="${ERY}" fill-opacity=".38"/>
  <path d="M44 62q4-13 18-14t22 10-6 20-24 4-10-20z" fill="${ERY}" fill-opacity=".5"/>
  <path d="M22 62q6-30 34-32t44 20-10 44-48 8-20-40z" fill="none"
        stroke="#2f6fa8" stroke-width="2" stroke-dasharray="4 4"/>
  <text x="60" y="112" text-anchor="middle" font-size="10" fill="#2f6fa8">border marked</text>
</svg>`,
  },

  eczema_flaky: {
    label: 'Dry, red, flaky patches',
    caption: 'Ill-defined dry scaly redness, often with scratch marks from persistent itch.',
    svg: `
<svg viewBox="0 0 120 120" role="img" class="cs">
  ${skinPatch()}
  <g fill="${ERY}" fill-opacity=".3">
    <path d="M26 40q18-12 34-4t28 6-4 26-30 10-30-6-2-20z"/>
    <path d="M34 84q12-8 24-3t18 5-6 12-22 3-16-6z"/>
  </g>
  <g fill="${SC}" fill-opacity=".7">
    <circle cx="40" cy="48" r="3"/><circle cx="55" cy="42" r="2.4"/><circle cx="70" cy="52" r="3.2"/>
    <circle cx="48" cy="60" r="2.6"/><circle cx="66" cy="64" r="2.8"/><circle cx="80" cy="46" r="2.4"/>
    <circle cx="44" cy="90" r="2.6"/><circle cx="60" cy="94" r="2.4"/>
  </g>
  <g stroke="${ERY}" stroke-width="1.5" stroke-opacity=".75" stroke-linecap="round">
    <path d="M36 34l16 22"/><path d="M48 32l14 20"/><path d="M62 76l12 14"/>
  </g>
</svg>`,
  },

  /* ---------------------------------------------- rash distribution */
  dist_dermatomal: {
    label: 'A band on one side, stopping at the midline',
    caption: 'A stripe following one nerve root. It stops dead at the midline and does not cross.',
    svg: body(`
  <path d="M40 44h16l6 22-4 12H40z" fill="${ERY}" fill-opacity=".55"/>
  <g fill="${ERY}">
    <circle cx="46" cy="52" r="2"/><circle cx="53" cy="58" r="2.2"/>
    <circle cx="48" cy="66" r="1.9"/><circle cx="56" cy="70" r="2"/>
  </g>
  <path d="M40 30v100" stroke="#2f6fa8" stroke-width="1.2" stroke-dasharray="3 3"/>
  <text x="72" y="86" text-anchor="end" font-size="6.5" fill="#2f6fa8">midline</text>`),
  },

  dist_single: {
    label: 'One patch in a single place',
    caption: 'A single localised area with normal skin all around it.',
    svg: body(`<ellipse cx="52" cy="58" rx="9" ry="7" fill="${ERY}" fill-opacity=".6"/>`),
  },

  dist_flexural: {
    label: 'In the creases of the elbows and knees',
    caption: 'Concentrated in the skin folds — the classic flexural pattern.',
    svg: body(`
  <g fill="${ERY}" fill-opacity=".55">
    <ellipse cx="23" cy="58" rx="5" ry="7"/><ellipse cx="57" cy="58" rx="5" ry="7"/>
    <ellipse cx="34" cy="100" rx="5" ry="7"/><ellipse cx="46" cy="100" rx="5" ry="7"/>
  </g>`),
  },

  dist_widespread: {
    label: 'Widespread over the body',
    caption: 'Scattered across several regions rather than confined to one place.',
    svg: body(`
  <g fill="${ERY}" fill-opacity=".55">
    <circle cx="40" cy="12" r="2.6"/><circle cx="34" cy="38" r="3"/><circle cx="47" cy="44" r="2.8"/>
    <circle cx="40" cy="56" r="3.2"/><circle cx="31" cy="64" r="2.6"/><circle cx="50" cy="66" r="3"/>
    <circle cx="24" cy="52" r="2.4"/><circle cx="57" cy="54" r="2.4"/>
    <circle cx="34" cy="90" r="3"/><circle cx="46" cy="96" r="2.8"/>
    <circle cx="35" cy="116" r="2.6"/><circle cx="45" cy="120" r="2.4"/>
  </g>`),
  },
};

export const SCHEMATIC_IDS = Object.keys(SCHEMATICS);
