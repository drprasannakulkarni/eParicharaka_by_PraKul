/* Shareera Darshana 2D Anatomical Atlas View
 * Real 2D Anatomical Plates (body.webp, head.webp, gut.webp)
 * Engineered for Medical Professionals with English-Only 20px High-Contrast Organ Cards.
 */
import { esc } from './ui.js';

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
  `role="button" tabindex="0" data-zone="${id}" aria-label="${esc(label)} - ${count || 0} clinical signs"><title>${esc(label)} (${count || 0} signs)</title>`;

/* Whole-body Anatomical Atlas SVG using real body.webp plate */
export function bodySilhouetteSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);

  return `
    <svg class="bodymap-svg shareera-atlas-svg" viewBox="0 0 940 1820" xmlns="http://www.w3.org/2000/svg" aria-label="Anatomical Organ Map">
      <defs>
        <filter id="pin-glow-head" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Real 2D High-Resolution Anatomical Plate Image -->
      <image href="assets/plates/body.webp" x="70" y="0" width="800" height="1800" opacity="0.98" />

      <!-- ==================== ENGLISH-ONLY 20PX HIGH-CONTRAST ORGAN CARDS ==================== -->
      
      <!-- 1. Head & Brain -->
      <g class="bodymap-zone card-head" ${zone('head', 'Head & Brain')}>
        <line x1="450" y1="136" x2="280" y2="136" stroke="#14b8a6" stroke-width="3" />
        <circle cx="450" cy="136" r="18" fill="#14b8a6" filter="url(#pin-glow-head)" />
        <circle cx="450" cy="136" r="7" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="112" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="143">Head &amp; Brain</text>
      </g>

      <!-- 2. ENT & Nasal Cavity -->
      <g class="bodymap-zone card-ent" ${zone('head', 'ENT & Nasal Cavity')}>
        <line x1="450" y1="180" x2="660" y2="180" stroke="#38bdf8" stroke-width="3" />
        <circle cx="450" cy="180" r="16" fill="#38bdf8" filter="url(#pin-glow-head)" />
        <circle cx="450" cy="180" r="6" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="660" y="156" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="674" y="187">ENT &amp; Nasal Cavity</text>
      </g>

      <!-- 3. Mouth & Throat -->
      <g class="bodymap-zone card-head" ${zone('head', 'Mouth & Throat')}>
        <line x1="450" y1="259" x2="280" y2="259" stroke="#14b8a6" stroke-width="3" />
        <circle cx="450" cy="259" r="18" fill="#14b8a6" filter="url(#pin-glow-head)" />
        <circle cx="450" cy="259" r="7" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="235" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="266">Mouth &amp; Throat</text>
      </g>

      <!-- 4. Arms & Shoulder Joints -->
      <g class="bodymap-zone card-arm" ${zone('arm', 'Arms & Shoulder Joints')}>
        <line x1="259" y1="375" x2="280" y2="375" stroke="#fbbf24" stroke-width="3" />
        <circle cx="259" cy="375" r="18" fill="#fbbf24" />
        <circle cx="259" cy="375" r="7" fill="#ffffff" />
        <circle cx="672" cy="375" r="18" fill="#fbbf24" />
        <circle cx="672" cy="375" r="7" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="351" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="382">Arms &amp; Shoulder Joints</text>
      </g>

      <!-- 5. Chest & Lungs -->
      <g class="bodymap-zone card-chest" ${zone('chest', 'Chest & Lungs')}>
        <line x1="450" y1="485" x2="280" y2="485" stroke="#38bdf8" stroke-width="3" />
        <circle cx="450" cy="485" r="20" fill="#38bdf8" />
        <circle cx="450" cy="485" r="8" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="461" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="492">Chest &amp; Lungs</text>
      </g>

      <!-- 6. Heart & Circulation -->
      <g class="bodymap-zone card-heart" ${zone('chest', 'Heart & Circulation')}>
        <line x1="428" y1="460" x2="660" y2="460" stroke="#f87171" stroke-width="3" />
        <circle cx="428" cy="460" r="20" fill="#f87171" />
        <circle cx="428" cy="460" r="8" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="660" y="436" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="674" y="467">Heart &amp; Circulation</text>
      </g>

      <!-- 7. Stomach & Liver -->
      <g class="bodymap-zone card-gut" ${zone('torso', 'Stomach & Liver')}>
        <line x1="411" y1="588" x2="280" y2="588" stroke="#fb923c" stroke-width="3" />
        <circle cx="411" cy="588" r="20" fill="#fb923c" />
        <circle cx="411" cy="588" r="8" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="564" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="595">Stomach &amp; Liver</text>
      </g>

      <!-- 8. Small Intestine -->
      <g class="bodymap-zone card-gut" ${zone('torso', 'Small Intestine')}>
        <line x1="466" y1="655" x2="660" y2="655" stroke="#fb923c" stroke-width="3" />
        <circle cx="466" cy="655" r="20" fill="#fb923c" />
        <circle cx="466" cy="655" r="8" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="660" y="631" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="674" y="662">Small Intestine</text>
      </g>

      <!-- 9. Colon & Abdomen -->
      <g class="bodymap-zone card-vata" ${zone('torso', 'Colon & Abdomen')}>
        <line x1="449" y1="712" x2="280" y2="712" stroke="#60a5fa" stroke-width="3" />
        <circle cx="449" cy="712" r="20" fill="#60a5fa" />
        <circle cx="449" cy="712" r="8" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="688" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="719">Colon &amp; Abdomen</text>
      </g>

      <!-- 10. Bladder & Kidneys -->
      <g class="bodymap-zone card-vata" ${zone('torso', 'Bladder & Kidneys')}>
        <line x1="450" y1="877" x2="660" y2="877" stroke="#60a5fa" stroke-width="3" />
        <circle cx="450" cy="877" r="20" fill="#60a5fa" />
        <circle cx="450" cy="877" r="8" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="660" y="853" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="674" y="884">Bladder &amp; Kidneys</text>
      </g>

      <!-- 11. Legs & Feet -->
      <g class="bodymap-zone card-vata" ${zone('leg', 'Legs & Feet')}>
        <line x1="540" y1="1086" x2="280" y2="1086" stroke="#60a5fa" stroke-width="3" />
        <circle cx="540" cy="1086" r="22" fill="#60a5fa" />
        <circle cx="540" cy="1086" r="9" fill="#ffffff" />
        <circle cx="358" cy="1086" r="22" fill="#60a5fa" />
        <circle cx="358" cy="1086" r="9" fill="#ffffff" />
        <rect class="bodymap-card-bg" x="10" y="1062" width="270" height="48" rx="10" />
        <text class="bodymap-card-title" x="24" y="1093">Legs &amp; Feet</text>
      </g>

    </svg>`;
}

/* Head & Neck closeup using real head.webp plate */
export function faceCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 900 1000" xmlns="http://www.w3.org/2000/svg" aria-label="Cranial and ENT Anatomical Plate">
      <image href="assets/plates/head.webp" x="0" y="0" width="900" height="1000" />
      <g class="bodymap-zone" ${zone('headgen', 'Cranial & CNS')}>
        <circle cx="448" cy="323" r="28" fill="#8b5cf6" opacity="0.92" />
        <circle cx="448" cy="323" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('ear', 'Auditory & Vestibular')}>
        <circle cx="269" cy="428" r="28" fill="#10b981" opacity="0.92" />
        <circle cx="628" cy="428" r="28" fill="#10b981" opacity="0.92" />
      </g>
      <g class="bodymap-zone" ${zone('eye', 'Ophthalmic & Visual')}>
        <circle cx="373" cy="404" r="26" fill="#06b6d4" opacity="0.92" />
        <circle cx="524" cy="404" r="26" fill="#06b6d4" opacity="0.92" />
      </g>
      <g class="bodymap-zone" ${zone('nose', 'Nasal Cavity')}>
        <circle cx="449" cy="434" r="24" fill="#10b981" opacity="0.92" />
      </g>
      <g class="bodymap-zone" ${zone('mouth', 'Oral Cavity & Pharynx')}>
        <circle cx="449" cy="576" r="26" fill="#f97316" opacity="0.92" />
        <circle cx="448" cy="629" r="28" fill="#ef4444" opacity="0.92" />
      </g>
    </svg>`;
}

export function armCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg" aria-label="Upper Extremity Joints">
      <rect x="0" y="0" width="400" height="600" fill="rgba(16, 185, 129, 0.04)" rx="16" />
      <image href="assets/plates/body.webp" x="-100" y="-200" width="600" height="1350" opacity="0.94" />
      <g class="bodymap-zone" ${zone('shoulder', 'Shoulder Joint')}>
        <circle cx="150" cy="120" r="30" fill="#10b981" opacity="0.92" />
        <circle cx="150" cy="120" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('elbow', 'Elbow Joint')}>
        <circle cx="130" cy="280" r="28" fill="#10b981" opacity="0.92" />
        <circle cx="130" cy="280" r="9" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('wrist', 'Wrist & Hand')}>
        <circle cx="110" cy="440" r="30" fill="#10b981" opacity="0.92" />
        <circle cx="110" cy="440" r="10" fill="#ffffff" />
      </g>
    </svg>`;
}

export function legCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 400 650" xmlns="http://www.w3.org/2000/svg" aria-label="Lower Extremity Joints">
      <rect x="0" y="0" width="400" height="650" fill="rgba(59, 130, 246, 0.04)" rx="16" />
      <image href="assets/plates/body.webp" x="-100" y="-700" width="600" height="1350" opacity="0.94" />
      <g class="bodymap-zone" ${zone('hip', 'Hip Joint')}>
        <circle cx="210" cy="90" r="32" fill="#3b82f6" opacity="0.92" />
        <circle cx="210" cy="90" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('knee', 'Knee Joint')}>
        <circle cx="220" cy="310" r="30" fill="#3b82f6" opacity="0.92" />
        <circle cx="220" cy="310" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('ankle', 'Ankle & Foot')}>
        <circle cx="230" cy="530" r="30" fill="#3b82f6" opacity="0.92" />
        <circle cx="230" cy="530" r="10" fill="#ffffff" />
      </g>
    </svg>`;
}
