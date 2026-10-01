/* Body-map symptom picker: a visual ALTERNATIVE to the search/list picker on
 * the Check-symptoms landing screen, not a replacement for it -- someone who
 * doesn't know the clinical word for their symptom can tap roughly where it
 * is instead of typing.
 *
 * Three-level drill-down for the areas with enough going on to need it:
 *   1. Whole-body silhouette -- 5 big zones (head, chest, torso, arms, legs).
 *   2. Head/arm/leg zones open a closeup with their own sub-hotspots (eyes/
 *      nose/ears/mouth for the face; shoulder/elbow/wrist for an arm;
 *      hip/knee/ankle for a leg) -- small anatomical features are too fiddly
 *      to tap reliably at whole-body scale, so they get their own zoomed-in
 *      diagram instead of being crammed onto the small head/limb shapes.
 *   3. Either level can end in a plain list of the chief complaints filed
 *      under that spot.
 * Chest and torso have no level 2 -- there's nothing under them specific
 * enough to need its own closeup, so they go straight to their list.
 *
 * Joints (shoulder/elbow/wrist/hip/knee/ankle) don't have their OWN chief
 * complaint in this app -- "Joint pain" and "Muscle aches" are single,
 * generalised interview trees that ask which joint/site once you're in them
 * (Q_JOINT_SITE etc.). Clicking a joint here is a discoverability shortcut
 * into the right complaint, not a way to pre-fill which joint -- the
 * interview still asks that itself. See data/body_map.json's `ccIds` for
 * which complaints are cross-listed under each joint (a joint can list
 * things beyond Joint pain/Muscle aches where relevant -- e.g. wrist also
 * lists Numbness and Tremor, knee/ankle also list Leg swelling).
 *
 * A simple front-view illustration, not a medical atlas -- SVG shapes with
 * gentle gradients for a shaded, "rendered" look rather than a flat
 * silhouette, but still hand-drawn shapes, not a photographic or licensed
 * reference image (see the chat for why: copyright, and it wouldn't retint
 * for the app's light/dark themes the way an SVG does).
 */
import { esc } from './ui.js';

/* Resolve one zone/sub-zone's chief-complaint list: either an explicit
 * ccIds[] (joints, and anything else that needs complaints beyond a single
 * index.json `region`), or every chief complaint whose own `region` field
 * appears in this entry's regions[]. */
export function resolveEntryCcs(entry, chiefComplaints, ccById) {
  if (entry.ccIds) return entry.ccIds.map(id => ccById.get(id)).filter(Boolean);
  const regions = new Set(entry.regions || []);
  return chiefComplaints.filter(cc => regions.has(cc.region));
}

export function groupCcsByZone(chiefComplaints, bodyMap) {
  const ccById = new Map(chiefComplaints.map(cc => [cc.id, cc]));
  const byZone = new Map();
  for (const z of bodyMap.zones) {
    if (z.sub) {
      // count = union across its sub-entries, for the outer hotspot's label
      const seen = new Set();
      for (const s of z.sub) resolveEntryCcs(s, chiefComplaints, ccById).forEach(cc => seen.add(cc));
      byZone.set(z.id, [...seen]);
    } else {
      byZone.set(z.id, resolveEntryCcs(z, chiefComplaints, ccById));
    }
  }
  return byZone;
}

export function subCcs(zone, subId, chiefComplaints) {
  const ccById = new Map(chiefComplaints.map(cc => [cc.id, cc]));
  const sub = zone.sub?.find(s => s.id === subId);
  return sub ? resolveEntryCcs(sub, chiefComplaints, ccById) : [];
}

const hotspotAttrs = (id, label, count) =>
  `role="button" tabindex="0" data-zone="${id}" aria-label="${esc(label)} — ${count || 0} symptoms"><title>${esc(label)}</title>`;

/* Shared shading -- a soft light-to-shadow gradient per part, referencing
 * this app's own theme tokens (via CSS custom properties inside the SVG's
 * own <style>) so it re-tints correctly in dark mode instead of being
 * baked-in flat hex colours. */
const SHADING_DEFS = `
  <defs>
    <linearGradient id="bm-head-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#c4b5fd" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="bm-chest-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#67e8f9" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <linearGradient id="bm-torso-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6ee7b7" />
      <stop offset="100%" stop-color="#10b981" />
    </linearGradient>
    <linearGradient id="bm-arm-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fde68a" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <linearGradient id="bm-leg-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#93c5fd" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
  </defs>`;

/* Whole-body silhouette, front view, ~1.5x the size of the original simple
 * outline. Arms are now real hotspots (drilling into shoulder/elbow/wrist),
 * not decorative -- everything visible on the figure is tappable. */
export function bodySilhouetteSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 240 480" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a body area">
      ${SHADING_DEFS}

      <g class="bodymap-zone bm-arm-zone" ${zone('arm', 'Arms & Hands')}>
        <path d="M70 96 Q44 104 40 168 Q38 214 48 246 Q54 260 66 256 L74 250 Q64 214 68 172 Q70 130 82 104 Z" />
        <path d="M170 96 Q196 104 200 168 Q202 214 192 246 Q186 260 174 256 L166 250 Q176 214 172 172 Q170 130 158 104 Z" />
      </g>

      <g class="bodymap-zone bm-leg-zone" ${zone('leg', 'Legs & Feet')}>
        <path d="M82 272 L76 460 Q76 470 86 470 L100 470 Q108 470 108 460 L112 310 L112 272 Z" />
        <path d="M158 272 L164 460 Q164 470 154 470 L140 470 Q132 470 132 460 L128 310 L128 272 Z" />
      </g>

      <g class="bodymap-zone bm-chest-zone" ${zone('chest', 'Chest')}>
        <path d="M74 98 Q120 84 166 98 Q170 130 166 172 Q120 186 74 172 Q70 130 74 98 Z" />
      </g>

      <g class="bodymap-zone bm-torso-zone" ${zone('torso', 'Abdomen, Pelvis & Back')}>
        <path d="M76 174 Q120 188 164 174 L158 258 Q120 274 82 258 Z" />
      </g>

      <g class="bodymap-zone bm-head-zone" ${zone('head', 'Head & Face')}>
        <rect x="104" y="80" width="32" height="22" rx="8" />
        <circle cx="120" cy="46" r="34" />
      </g>
    </svg>`;
}

/* Face closeup -- shown after tapping "Head & Face". Eyes/nose/ears/mouth
 * each get their own generously-sized hit area (bigger than the visible
 * glyph, since these are small features that still need to be easy to tap
 * on a phone) layered over a base head shape that itself is the "Head
 * (general)" hotspot for anything not specifically eye/nose/ear/mouth. */
export function faceCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 240 260" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a facial feature">
      ${SHADING_DEFS}

      <g class="bodymap-zone bm-base" ${zone('headgen', 'Head (general)')}>
        <path d="M120 20 Q186 20 190 92 Q194 140 178 176 Q160 210 120 214 Q80 210 62 176 Q46 140 50 92 Q54 20 120 20 Z" />
      </g>
      <g class="bodymap-zone bm-base" ${zone('ear', 'Ears')}>
        <ellipse cx="52" cy="110" rx="12" ry="20" />
        <ellipse cx="188" cy="110" rx="12" ry="20" />
      </g>
      <g class="bodymap-zone bm-feature" ${zone('eye', 'Eyes')}>
        <circle cx="20" cy="0" r="16" transform="translate(90,110)" />
        <circle cx="20" cy="0" r="16" transform="translate(130,110)" />
      </g>
      <g class="bodymap-zone bm-feature" ${zone('nose', 'Nose')}>
        <path d="M110 122 Q120 150 108 168 Q120 178 132 168 Q120 150 130 122 Z" />
      </g>
      <g class="bodymap-zone bm-feature" ${zone('mouth', 'Mouth & Throat')}>
        <path d="M92 188 Q120 202 148 188 Q148 200 120 208 Q92 200 92 188 Z" />
      </g>
    </svg>`;
}

/* Arm closeup -- shoulder / elbow / wrist markers along a simplified limb. */
export function armCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 160 320" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a joint">
      ${SHADING_DEFS}
      <path class="bm-base" d="M56 20 Q40 60 44 130 Q46 190 56 250 Q58 280 74 300 L100 300 Q90 270 86 240 Q98 180 96 120 Q100 60 108 20 Z" />
      <g class="bodymap-zone bm-joint" ${zone('shoulder', 'Shoulder')}><circle cx="76" cy="34" r="26" /></g>
      <g class="bodymap-zone bm-joint" ${zone('elbow', 'Elbow')}><circle cx="70" cy="150" r="22" /></g>
      <g class="bodymap-zone bm-joint" ${zone('wrist', 'Wrist & Hand')}><circle cx="86" cy="278" r="24" /></g>
    </svg>`;
}

/* Leg closeup -- hip / knee / ankle markers along a simplified limb. */
export function legCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 160 360" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a joint">
      ${SHADING_DEFS}
      <path class="bm-base" d="M58 20 Q46 90 52 170 Q56 220 62 260 Q60 300 68 336 L96 336 Q100 300 94 262 Q104 220 104 170 Q108 90 100 20 Z" />
      <g class="bodymap-zone bm-joint" ${zone('hip', 'Hip')}><circle cx="80" cy="34" r="28" /></g>
      <g class="bodymap-zone bm-joint" ${zone('knee', 'Knee')}><circle cx="70" cy="182" r="24" /></g>
      <g class="bodymap-zone bm-joint" ${zone('ankle', 'Ankle & Foot')}><circle cx="76" cy="322" r="24" /></g>
    </svg>`;
}
