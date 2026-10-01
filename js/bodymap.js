/* Shareera Darshana 3D Anatomical Doshic Atlas View
 * Interactive anatomical structures mapped across Kapha (Above Heart),
 * Pitta (Heart to Navel), and Vata (Below Navel) Doshic Sthanas.
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
  `role="button" tabindex="0" data-zone="${id}" aria-label="${esc(label)} — ${count || 0} symptoms"><title>${esc(label)}</title>`;

/* Whole-body Shareera Darshana 3D Anatomical Doshic Atlas SVG */
export function bodySilhouetteSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  
  return `
    <svg class="bodymap-svg shareera-atlas-svg" viewBox="0 0 340 520" xmlns="http://www.w3.org/2000/svg" aria-label="Anatomical Doshic Atlas">
      <defs>
        <!-- Gradients -->
        <linearGradient id="body-silhouette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--surface-2)" stop-opacity="0.9" />
          <stop offset="100%" stop-color="var(--surface)" stop-opacity="0.95" />
        </linearGradient>
        <filter id="pin-glow-kapha" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="pin-glow-pitta" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="pin-glow-vata" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Doshic Regions (Sthanas) Background Bands -->
      <!-- 1. Kapha Region: Above Heart (y: 0 - 150) -->
      <rect x="0" y="0" width="340" height="150" fill="rgba(16, 185, 129, 0.06)" rx="8" />
      <line x1="0" y1="150" x2="340" y2="150" stroke="#10b981" stroke-dasharray="4 3" stroke-width="1.5" opacity="0.6" />
      <text x="12" y="24" fill="#10b981" font-size="11" font-weight="700" letter-spacing="0.5">KAPHA REGION</text>

      <!-- 2. Pitta Region: Heart to Navel (y: 150 - 280) -->
      <rect x="0" y="150" width="340" height="130" fill="rgba(249, 115, 22, 0.06)" />
      <line x1="0" y1="280" x2="340" y2="280" stroke="#f97316" stroke-dasharray="4 3" stroke-width="1.5" opacity="0.6" />
      <text x="12" y="172" fill="#f97316" font-size="11" font-weight="700" letter-spacing="0.5">PITTA REGION</text>

      <!-- 3. Vata Region: Below Navel (y: 280 - 520) -->
      <rect x="0" y="280" width="340" height="240" fill="rgba(59, 130, 246, 0.06)" rx="8" />
      <text x="12" y="302" fill="#3b82f6" font-size="11" font-weight="700" letter-spacing="0.5">VATA REGION</text>

      <!-- Translucent Anatomical Figure Outline -->
      <g opacity="0.85">
        <!-- Head & Skull -->
        <ellipse cx="170" cy="46" rx="30" ry="34" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
        <rect x="156" y="78" width="28" height="20" rx="6" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
        
        <!-- Chest & Ribcage -->
        <path d="M124 98 Q170 84 216 98 Q220 130 216 172 Q170 186 124 172 Q120 130 124 98 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
        
        <!-- Abdomen & Spine -->
        <path d="M126 174 Q170 188 214 174 L208 268 Q170 284 132 268 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
        
        <!-- Pelvis -->
        <path d="M132 268 Q170 284 208 268 L200 310 Q170 326 140 310 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />

        <!-- Arms -->
        <path d="M120 96 Q94 104 90 168 Q88 214 98 246 Q104 260 116 256 L124 250 Q114 214 118 172 Q120 130 132 104 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
        <path d="M220 96 Q246 104 250 168 Q252 214 242 246 Q236 260 224 256 L216 250 Q226 214 222 172 Q220 130 208 104 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />

        <!-- Legs -->
        <path d="M132 310 L126 498 Q126 508 136 508 L150 508 Q158 508 158 498 L162 348 L162 310 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
        <path d="M208 310 L214 498 Q214 508 204 508 L190 508 Q182 508 182 498 L178 348 L178 310 Z" fill="url(#body-silhouette)" stroke="var(--line)" stroke-width="1.5" />
      </g>

      <!-- Anatomical Internal Organs -->
      <g opacity="0.75">
        <!-- Lungs -->
        <ellipse cx="152" cy="132" rx="16" ry="24" fill="#06b6d4" opacity="0.3" />
        <ellipse cx="188" cy="132" rx="16" ry="24" fill="#06b6d4" opacity="0.3" />
        <!-- Heart -->
        <circle cx="176" cy="136" r="14" fill="#ef4444" opacity="0.4" />
        <!-- Liver & Stomach -->
        <path d="M142 180 Q160 172 178 180 Q184 200 142 208 Z" fill="#f59e0b" opacity="0.4" />
        <!-- Intestines -->
        <rect x="146" y="212" width="48" height="44" rx="10" fill="#3b82f6" opacity="0.3" />
        <!-- Bladder -->
        <ellipse cx="170" cy="292" rx="14" ry="10" fill="#3b82f6" opacity="0.4" />
      </g>

      <!-- Hotspot Pins & Leader Lines (Matching Shareera Darshana Atlas) -->

      <!-- 🟢 KAPHA HOTSPOTS (Above Heart) -->
      <!-- 1. Head & Brain (Shirsha) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Brain & Head (Shirsha)')}>
        <line x1="170" y1="34" x2="270" y2="34" stroke="#10b981" stroke-width="1.2" />
        <circle cx="170" cy="34" r="7" fill="#10b981" filter="url(#pin-glow-kapha)" />
        <circle cx="170" cy="34" r="3" fill="#ffffff" />
        <text x="274" y="38" fill="#10b981" font-size="11" font-weight="700">Head &amp; Brain <tspan font-weight="400" font-style="italic">(Shirsha)</tspan></text>
      </g>

      <!-- 2. Eyes & ENT (Drik/Ghrana) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Eyes & Nose (Drik/Ghrana)')}>
        <line x1="170" y1="56" x2="270" y2="56" stroke="#10b981" stroke-width="1.2" />
        <circle cx="170" cy="56" r="6" fill="#10b981" />
        <circle cx="170" cy="56" r="2.5" fill="#ffffff" />
        <text x="274" y="60" fill="#10b981" font-size="10.5" font-weight="650">Eyes &amp; Nose <tspan font-weight="400" font-style="italic">(Drik/Ghrana)</tspan></text>
      </g>

      <!-- 3. Throat & Mouth (Kantha) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Mouth & Throat (Kantha)')}>
        <line x1="170" y1="84" x2="270" y2="78" stroke="#10b981" stroke-width="1.2" />
        <circle cx="170" cy="84" r="6" fill="#10b981" />
        <circle cx="170" cy="84" r="2.5" fill="#ffffff" />
        <text x="274" y="82" fill="#10b981" font-size="10.5" font-weight="650">Mouth &amp; Throat <tspan font-weight="400" font-style="italic">(Kantha)</tspan></text>
      </g>

      <!-- 4. Chest & Lungs (Uras) -->
      <g class="bodymap-zone pin-kapha" ${zone('chest', 'Chest & Lungs (Uras)')}>
        <line x1="152" y1="126" x2="50" y2="126" stroke="#06b6d4" stroke-width="1.2" />
        <circle cx="152" cy="126" r="7" fill="#06b6d4" filter="url(#pin-glow-kapha)" />
        <circle cx="152" cy="126" r="3" fill="#ffffff" />
        <text x="46" y="122" text-anchor="end" fill="#06b6d4" font-size="11" font-weight="700">Chest &amp; Lungs <tspan font-weight="400" font-style="italic">(Uras)</tspan></text>
      </g>

      <!-- 🟠 PITTA HOTSPOTS (Heart to Navel) -->
      <!-- 5. Heart (Hridaya) -->
      <g class="bodymap-zone pin-pitta" ${zone('chest', 'Heart (Hridaya)')}>
        <line x1="176" y1="136" x2="270" y2="136" stroke="#f97316" stroke-width="1.2" />
        <circle cx="176" cy="136" r="7" fill="#ef4444" filter="url(#pin-glow-pitta)" />
        <circle cx="176" cy="136" r="3" fill="#ffffff" />
        <text x="274" y="140" fill="#ef4444" font-size="11" font-weight="700">Heart <tspan font-weight="400" font-style="italic">(Hridaya)</tspan></text>
      </g>

      <!-- 6. Liver & Stomach (Yakrit & Amashaya) -->
      <g class="bodymap-zone pin-pitta" ${zone('torso', 'Stomach & Liver (Yakrit & Amashaya)')}>
        <line x1="154" y1="184" x2="50" y2="184" stroke="#f97316" stroke-width="1.2" />
        <circle cx="154" cy="184" r="7" fill="#f97316" filter="url(#pin-glow-pitta)" />
        <circle cx="154" cy="184" r="3" fill="#ffffff" />
        <text x="46" y="188" text-anchor="end" fill="#f97316" font-size="11" font-weight="700">Stomach &amp; Liver <tspan font-weight="400" font-style="italic">(Amashaya)</tspan></text>
      </g>

      <!-- 7. Small Intestine & Spleen (Grahani & Pliha) -->
      <g class="bodymap-zone pin-pitta" ${zone('torso', 'Small Intestine (Grahani)')}>
        <line x1="170" y1="216" x2="270" y2="216" stroke="#f97316" stroke-width="1.2" />
        <circle cx="170" cy="216" r="6.5" fill="#f97316" />
        <circle cx="170" cy="216" r="2.5" fill="#ffffff" />
        <text x="274" y="220" fill="#f97316" font-size="10.5" font-weight="650">Small Intestine <tspan font-weight="400" font-style="italic">(Grahani)</tspan></text>
      </g>

      <!-- 🔵 VATA HOTSPOTS (Below Navel) -->
      <!-- 8. Navel & Colon (Nabhi & Pakvashaya) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Navel & Colon (Nabhi)')}>
        <line x1="170" y1="248" x2="50" y2="248" stroke="#3b82f6" stroke-width="1.2" />
        <circle cx="170" cy="248" r="7" fill="#3b82f6" filter="url(#pin-glow-vata)" />
        <circle cx="170" cy="248" r="3" fill="#ffffff" />
        <text x="46" y="252" text-anchor="end" fill="#3b82f6" font-size="11" font-weight="700">Navel &amp; Colon <tspan font-weight="400" font-style="italic">(Nabhi)</tspan></text>
      </g>

      <!-- 9. Pelvis & Reproductive (Shroni) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Pelvis & Reproductive (Shroni)')}>
        <line x1="170" y1="280" x2="270" y2="280" stroke="#3b82f6" stroke-width="1.2" />
        <circle cx="170" cy="280" r="6.5" fill="#3b82f6" />
        <circle cx="170" cy="280" r="2.5" fill="#ffffff" />
        <text x="274" y="284" fill="#3b82f6" font-size="10.5" font-weight="650">Pelvis &amp; Lower Back <tspan font-weight="400" font-style="italic">(Shroni)</tspan></text>
      </g>

      <!-- 10. Bladder & Kidneys (Basti) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Bladder & Kidneys (Basti)')}>
        <line x1="170" y1="304" x2="50" y2="304" stroke="#3b82f6" stroke-width="1.2" />
        <circle cx="170" cy="304" r="6.5" fill="#3b82f6" />
        <circle cx="170" cy="304" r="2.5" fill="#ffffff" />
        <text x="46" y="308" text-anchor="end" fill="#3b82f6" font-size="10.5" font-weight="650">Bladder &amp; Kidneys <tspan font-weight="400" font-style="italic">(Basti)</tspan></text>
      </g>

      <!-- 11. Arms & Joints (Parva) -->
      <g class="bodymap-zone pin-kapha" ${zone('arm', 'Arms & Joints (Parva)')}>
        <line x1="104" y1="168" x2="20" y2="168" stroke="#10b981" stroke-width="1.2" />
        <circle cx="104" cy="168" r="6.5" fill="#10b981" />
        <circle cx="104" cy="168" r="2.5" fill="#ffffff" />
        <text x="16" y="164" text-anchor="end" fill="#10b981" font-size="10.5" font-weight="650">Arms &amp; Joints <tspan font-weight="400" font-style="italic">(Parva)</tspan></text>
      </g>

      <!-- 12. Thighs, Legs & Feet (Sakthi) -->
      <g class="bodymap-zone pin-vata" ${zone('leg', 'Thighs, Legs & Feet (Sakthi)')}>
        <line x1="146" y1="410" x2="50" y2="410" stroke="#3b82f6" stroke-width="1.2" />
        <circle cx="146" cy="410" r="7" fill="#3b82f6" filter="url(#pin-glow-vata)" />
        <circle cx="146" cy="410" r="3" fill="#ffffff" />
        <text x="46" y="414" text-anchor="end" fill="#3b82f6" font-size="11" font-weight="700">Thighs, Legs &amp; Feet <tspan font-weight="400" font-style="italic">(Sakthi)</tspan></text>
      </g>

    </svg>`;
}

export function faceCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 240 260" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a facial feature">
      <rect x="0" y="0" width="240" height="260" fill="rgba(16, 185, 129, 0.06)" rx="8" />
      <g class="bodymap-zone bm-base" ${zone('headgen', 'Head (general)')}>
        <path d="M120 20 Q186 20 190 92 Q194 140 178 176 Q160 210 120 214 Q80 210 62 176 Q46 140 50 92 Q54 20 120 20 Z" fill="#c4b5fd" opacity="0.4" stroke="#8b5cf6" stroke-width="1.8" />
      </g>
      <g class="bodymap-zone bm-base" ${zone('ear', 'Ears')}>
        <ellipse cx="52" cy="110" rx="12" ry="20" fill="#10b981" />
        <ellipse cx="188" cy="110" rx="12" ry="20" fill="#10b981" />
      </g>
      <g class="bodymap-zone bm-feature" ${zone('eye', 'Eyes')}>
        <circle cx="20" cy="0" r="16" transform="translate(90,110)" fill="#10b981" />
        <circle cx="20" cy="0" r="16" transform="translate(130,110)" fill="#10b981" />
      </g>
      <g class="bodymap-zone bm-feature" ${zone('nose', 'Nose')}>
        <path d="M110 122 Q120 150 108 168 Q120 178 132 168 Q120 150 130 122 Z" fill="#10b981" />
      </g>
      <g class="bodymap-zone bm-feature" ${zone('mouth', 'Mouth & Throat')}>
        <path d="M92 188 Q120 202 148 188 Q148 200 120 208 Q92 200 92 188 Z" fill="#10b981" />
      </g>
    </svg>`;
}

export function armCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 160 320" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a joint">
      <rect x="0" y="0" width="160" height="320" fill="rgba(245, 158, 11, 0.06)" rx="8" />
      <path class="bm-base" d="M56 20 Q40 60 44 130 Q46 190 56 250 Q58 280 74 300 L100 300 Q90 270 86 240 Q98 180 96 120 Q100 60 108 20 Z" fill="#fde68a" opacity="0.4" stroke="#f59e0b" stroke-width="1.8" />
      <g class="bodymap-zone bm-joint" ${zone('shoulder', 'Shoulder')}><circle cx="76" cy="34" r="26" /></g>
      <g class="bodymap-zone bm-joint" ${zone('elbow', 'Elbow')}><circle cx="70" cy="150" r="22" /></g>
      <g class="bodymap-zone bm-joint" ${zone('wrist', 'Wrist & Hand')}><circle cx="86" cy="278" r="24" /></g>
    </svg>`;
}

export function legCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 160 360" xmlns="http://www.w3.org/2000/svg" aria-label="Tap a joint">
      <rect x="0" y="0" width="160" height="360" fill="rgba(59, 130, 246, 0.06)" rx="8" />
      <path class="bm-base" d="M58 20 Q46 90 52 170 Q56 220 62 260 Q60 300 68 336 L96 336 Q100 300 94 262 Q104 220 104 170 Q108 90 100 20 Z" fill="#93c5fd" opacity="0.4" stroke="#3b82f6" stroke-width="1.8" />
      <g class="bodymap-zone bm-joint" ${zone('hip', 'Hip')}><circle cx="80" cy="34" r="28" /></g>
      <g class="bodymap-zone bm-joint" ${zone('knee', 'Knee')}><circle cx="70" cy="182" r="24" /></g>
      <g class="bodymap-zone bm-joint" ${zone('ankle', 'Ankle & Foot')}><circle cx="76" cy="322" r="24" /></g>
    </svg>`;
}
