/* Shareera Darshana 2D Anatomical Doshic Atlas View
 * Interactive real 2D anatomical plates (body.webp, head.webp, gut.webp, excretion.webp)
 * mapped across Kapha (Above Heart), Pitta (Heart to Navel), and Vata (Below Navel) Doshic Sthanas.
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
  `role="button" tabindex="0" data-zone="${id}" aria-label="${esc(label)} - ${count || 0} symptoms"><title>${esc(label)} (${count || 0} symptoms)</title>`;

/* Whole-body Shareera Darshana Anatomical Doshic Atlas SVG using real body.webp plate */
export function bodySilhouetteSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);

  return `
    <svg class="bodymap-svg shareera-atlas-svg" viewBox="0 0 800 1800" xmlns="http://www.w3.org/2000/svg" aria-label="Real Anatomical Doshic Atlas">
      <defs>
        <filter id="pin-glow-kapha" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="pin-glow-pitta" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="pin-glow-vata" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Real 2D Anatomical Plate Image -->
      <image href="assets/plates/body.webp" x="0" y="0" width="800" height="1800" opacity="0.95" />

      <!-- Doshic Regions (Sthanas) Background Overlay & Guideline Boundaries -->
      <!-- 1. KAPHA REGION: Above Heart (y: 0 - 450) -->
      <rect x="10" y="10" width="780" height="440" fill="rgba(16, 185, 129, 0.08)" rx="16" />
      <line x1="10" y1="450" x2="790" y2="450" stroke="#10b981" stroke-dasharray="8 6" stroke-width="3" opacity="0.85" />
      <rect x="24" y="24" width="180" height="34" rx="6" fill="rgba(16, 185, 129, 0.85)" />
      <text x="36" y="47" fill="#ffffff" font-size="18" font-weight="700" letter-spacing="1">KAPHA REGION</text>

      <!-- 2. PITTA REGION: Heart to Navel (y: 450 - 720) -->
      <rect x="10" y="450" width="780" height="270" fill="rgba(249, 115, 22, 0.08)" />
      <line x1="10" y1="720" x2="790" y2="720" stroke="#f97316" stroke-dasharray="8 6" stroke-width="3" opacity="0.85" />
      <rect x="24" y="466" width="170" height="34" rx="6" fill="rgba(249, 115, 22, 0.85)" />
      <text x="36" y="489" fill="#ffffff" font-size="18" font-weight="700" letter-spacing="1">PITTA REGION</text>

      <!-- 3. VATA REGION: Below Navel (y: 720 - 1790) -->
      <rect x="10" y="720" width="780" height="1060" fill="rgba(59, 130, 246, 0.08)" rx="16" />
      <rect x="24" y="736" width="160" height="34" rx="6" fill="rgba(59, 130, 246, 0.85)" />
      <text x="36" y="759" fill="#ffffff" font-size="18" font-weight="700" letter-spacing="1">VATA REGION</text>

      <!-- ==================== KAPHA HOTSPOTS (Above Heart) ==================== -->
      <!-- 1. Head, Brain & Eyes (Shiras) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Head, Brain & Eyes (Shiras)')}>
        <line x1="380" y1="136" x2="160" y2="136" stroke="#10b981" stroke-width="3" />
        <circle cx="380" cy="136" r="18" fill="#10b981" filter="url(#pin-glow-kapha)" />
        <circle cx="380" cy="136" r="8" fill="#ffffff" />
        <rect x="15" y="112" width="230" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#10b981" stroke-width="2" />
        <text x="25" y="138" fill="#047857" font-size="18" font-weight="700">Head &amp; Eyes <tspan font-weight="400" font-style="italic">(Shiras)</tspan></text>
      </g>

      <!-- 2. Nose & Sinuses (Ghrana) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Nose & Sinuses (Ghrana)')}>
        <line x1="380" y1="180" x2="620" y2="180" stroke="#10b981" stroke-width="3" />
        <circle cx="380" cy="180" r="14" fill="#06b6d4" filter="url(#pin-glow-kapha)" />
        <circle cx="380" cy="180" r="6" fill="#ffffff" />
        <rect x="545" y="158" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#06b6d4" stroke-width="2" />
        <text x="555" y="184" fill="#0891b2" font-size="18" font-weight="700">Nose &amp; ENT <tspan font-weight="400" font-style="italic">(Ghrana)</tspan></text>
      </g>

      <!-- 3. Mouth & Throat (Kantha & Jihva) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Mouth & Throat (Kantha)')}>
        <line x1="380" y1="259" x2="160" y2="259" stroke="#10b981" stroke-width="3" />
        <circle cx="380" cy="259" r="16" fill="#10b981" filter="url(#pin-glow-kapha)" />
        <circle cx="380" cy="259" r="7" fill="#ffffff" />
        <rect x="15" y="236" width="230" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#10b981" stroke-width="2" />
        <text x="25" y="262" fill="#047857" font-size="18" font-weight="700">Mouth &amp; Throat <tspan font-weight="400" font-style="italic">(Kantha)</tspan></text>
      </g>

      <!-- 4. Chest & Lungs (Uras) -->
      <g class="bodymap-zone pin-kapha" ${zone('chest', 'Chest & Lungs (Uras)')}>
        <line x1="380" y1="485" x2="160" y2="485" stroke="#06b6d4" stroke-width="3" />
        <circle cx="380" cy="485" r="20" fill="#06b6d4" filter="url(#pin-glow-kapha)" />
        <circle cx="380" cy="485" r="9" fill="#ffffff" />
        <rect x="15" y="462" width="230" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#06b6d4" stroke-width="2" />
        <text x="25" y="488" fill="#0891b2" font-size="18" font-weight="700">Chest &amp; Lungs <tspan font-weight="400" font-style="italic">(Uras)</tspan></text>
      </g>

      <!-- ==================== PITTA HOTSPOTS (Heart to Navel) ==================== -->
      <!-- 5. Heart & Circulation (Hridaya) -->
      <g class="bodymap-zone pin-pitta" ${zone('chest', 'Heart & Circulation (Hridaya)')}>
        <line x1="358" y1="460" x2="620" y2="460" stroke="#ef4444" stroke-width="3" />
        <circle cx="358" cy="460" r="18" fill="#ef4444" filter="url(#pin-glow-pitta)" />
        <circle cx="358" cy="460" r="8" fill="#ffffff" />
        <rect x="545" y="438" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#ef4444" stroke-width="2" />
        <text x="555" y="464" fill="#b91c1c" font-size="18" font-weight="700">Heart &amp; Blood <tspan font-weight="400" font-style="italic">(Hridaya)</tspan></text>
      </g>

      <!-- 6. Stomach & Liver (Amashaya & Yakrit) -->
      <g class="bodymap-zone pin-pitta" ${zone('torso', 'Stomach & Liver (Amashaya & Yakrit)')}>
        <line x1="341" y1="588" x2="160" y2="588" stroke="#f97316" stroke-width="3" />
        <circle cx="341" cy="588" r="18" fill="#f97316" filter="url(#pin-glow-pitta)" />
        <circle cx="341" cy="588" r="8" fill="#ffffff" />
        <rect x="15" y="565" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#f97316" stroke-width="2" />
        <text x="25" y="591" fill="#c2410c" font-size="18" font-weight="700">Stomach &amp; Liver <tspan font-weight="400" font-style="italic">(Amashaya)</tspan></text>
      </g>

      <!-- 7. Small Intestine (Grahani) -->
      <g class="bodymap-zone pin-pitta" ${zone('torso', 'Small Intestine & Digestion (Grahani)')}>
        <line x1="396" y1="655" x2="620" y2="655" stroke="#f97316" stroke-width="3" />
        <circle cx="396" cy="655" r="18" fill="#f97316" filter="url(#pin-glow-pitta)" />
        <circle cx="396" cy="655" r="8" fill="#ffffff" />
        <rect x="545" y="632" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#f97316" stroke-width="2" />
        <text x="555" y="658" fill="#c2410c" font-size="18" font-weight="700">Small Intestine <tspan font-weight="400" font-style="italic">(Grahani)</tspan></text>
      </g>

      <!-- ==================== VATA HOTSPOTS (Below Navel) ==================== -->
      <!-- 8. Navel & Colon (Nabhi & Pakvashaya) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Navel & Colon (Nabhi & Pakvashaya)')}>
        <line x1="379" y1="712" x2="160" y2="712" stroke="#3b82f6" stroke-width="3" />
        <circle cx="379" cy="712" r="18" fill="#3b82f6" filter="url(#pin-glow-vata)" />
        <circle cx="379" cy="712" r="8" fill="#ffffff" />
        <rect x="15" y="689" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#3b82f6" stroke-width="2" />
        <text x="25" y="715" fill="#1d4ed8" font-size="18" font-weight="700">Navel &amp; Colon <tspan font-weight="400" font-style="italic">(Pakvashaya)</tspan></text>
      </g>

      <!-- 9. Pelvis, Kidneys & Bladder (Basti & Shroni) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Bladder, Kidneys & Pelvis (Basti & Shroni)')}>
        <line x1="380" y1="877" x2="620" y2="877" stroke="#3b82f6" stroke-width="3" />
        <circle cx="380" cy="877" r="18" fill="#3b82f6" filter="url(#pin-glow-vata)" />
        <circle cx="380" cy="877" r="8" fill="#ffffff" />
        <rect x="545" y="854" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#3b82f6" stroke-width="2" />
        <text x="555" y="880" fill="#1d4ed8" font-size="18" font-weight="700">Bladder &amp; Pelvis <tspan font-weight="400" font-style="italic">(Basti)</tspan></text>
      </g>

      <!-- 10. Arms & Joints (Parva) -->
      <g class="bodymap-zone pin-kapha" ${zone('arm', 'Arms & Upper Joints (Parva)')}>
        <line x1="189" y1="375" x2="160" y2="375" stroke="#10b981" stroke-width="3" />
        <circle cx="189" cy="375" r="18" fill="#10b981" filter="url(#pin-glow-kapha)" />
        <circle cx="189" cy="375" r="8" fill="#ffffff" />
        <circle cx="602" cy="375" r="18" fill="#10b981" filter="url(#pin-glow-kapha)" />
        <circle cx="602" cy="375" r="8" fill="#ffffff" />
        <rect x="15" y="352" width="230" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#10b981" stroke-width="2" />
        <text x="25" y="378" fill="#047857" font-size="18" font-weight="700">Arms &amp; Joints <tspan font-weight="400" font-style="italic">(Parva)</tspan></text>
      </g>

      <!-- 11. Thighs, Legs & Feet (Sakthi) -->
      <g class="bodymap-zone pin-vata" ${zone('leg', 'Thighs, Legs & Feet (Sakthi)')}>
        <line x1="470" y1="1086" x2="160" y2="1086" stroke="#3b82f6" stroke-width="3" />
        <circle cx="470" cy="1086" r="20" fill="#3b82f6" filter="url(#pin-glow-vata)" />
        <circle cx="470" cy="1086" r="9" fill="#ffffff" />
        <circle cx="288" cy="1086" r="20" fill="#3b82f6" filter="url(#pin-glow-vata)" />
        <circle cx="288" cy="1086" r="9" fill="#ffffff" />
        <rect x="15" y="1063" width="240" height="42" rx="8" fill="var(--surface, #ffffff)" stroke="#3b82f6" stroke-width="2" />
        <text x="25" y="1089" fill="#1d4ed8" font-size="18" font-weight="700">Thighs &amp; Legs <tspan font-weight="400" font-style="italic">(Sakthi)</tspan></text>
      </g>

    </svg>`;
}

/* Head & Neck closeup using real head.webp plate */
export function faceCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 900 1000" xmlns="http://www.w3.org/2000/svg" aria-label="Head and ENT Anatomical Plate">
      <image href="assets/plates/head.webp" x="0" y="0" width="900" height="1000" />
      <g class="bodymap-zone" ${zone('headgen', 'Head & Brain (Shiras)')}>
        <circle cx="448" cy="323" r="24" fill="#8b5cf6" opacity="0.85" />
        <circle cx="448" cy="323" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('ear', 'Ears (Shrotra)')}>
        <circle cx="269" cy="428" r="24" fill="#10b981" opacity="0.85" />
        <circle cx="628" cy="428" r="24" fill="#10b981" opacity="0.85" />
      </g>
      <g class="bodymap-zone" ${zone('eye', 'Eyes (Drik)')}>
        <circle cx="373" cy="404" r="22" fill="#06b6d4" opacity="0.85" />
        <circle cx="524" cy="404" r="22" fill="#06b6d4" opacity="0.85" />
      </g>
      <g class="bodymap-zone" ${zone('nose', 'Nose & Sinuses (Ghrana)')}>
        <circle cx="449" cy="434" r="20" fill="#10b981" opacity="0.85" />
      </g>
      <g class="bodymap-zone" ${zone('mouth', 'Mouth & Throat (Jihva & Kantha)')}>
        <circle cx="449" cy="576" r="22" fill="#f97316" opacity="0.85" />
        <circle cx="448" cy="629" r="24" fill="#ef4444" opacity="0.85" />
      </g>
    </svg>`;
}

export function armCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg" aria-label="Arm and Joints">
      <rect x="0" y="0" width="400" height="600" fill="rgba(16, 185, 129, 0.04)" rx="16" />
      <image href="assets/plates/body.webp" x="-100" y="-200" width="600" height="1350" opacity="0.9" />
      <g class="bodymap-zone" ${zone('shoulder', 'Shoulder Joint')}>
        <circle cx="150" cy="120" r="26" fill="#10b981" opacity="0.85" />
        <circle cx="150" cy="120" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('elbow', 'Elbow Joint')}>
        <circle cx="130" cy="280" r="24" fill="#10b981" opacity="0.85" />
        <circle cx="130" cy="280" r="9" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('wrist', 'Wrist & Hand')}>
        <circle cx="110" cy="440" r="26" fill="#10b981" opacity="0.85" />
        <circle cx="110" cy="440" r="10" fill="#ffffff" />
      </g>
    </svg>`;
}

export function legCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 400 650" xmlns="http://www.w3.org/2000/svg" aria-label="Leg and Lower Joints">
      <rect x="0" y="0" width="400" height="650" fill="rgba(59, 130, 246, 0.04)" rx="16" />
      <image href="assets/plates/body.webp" x="-100" y="-700" width="600" height="1350" opacity="0.9" />
      <g class="bodymap-zone" ${zone('hip', 'Hip Joint')}>
        <circle cx="210" cy="90" r="28" fill="#3b82f6" opacity="0.85" />
        <circle cx="210" cy="90" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('knee', 'Knee Joint')}>
        <circle cx="220" cy="310" r="26" fill="#3b82f6" opacity="0.85" />
        <circle cx="220" cy="310" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('ankle', 'Ankle & Foot')}>
        <circle cx="230" cy="530" r="26" fill="#3b82f6" opacity="0.85" />
        <circle cx="230" cy="530" r="10" fill="#ffffff" />
      </g>
    </svg>`;
}
