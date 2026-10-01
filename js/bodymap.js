/* Shareera Darshana 2D Anatomical Doshic Atlas View
 * Professional Real 2D Anatomical Plates (body.webp, head.webp, gut.webp)
 * mapped across Kapha (Above Heart), Pitta (Heart to Navel), and Vata (Below Navel) Doshic Sthanas.
 * Engineered specifically for Physicians, Clinicians, and Medics.
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

/* Whole-body Shareera Darshana Anatomical Doshic Atlas SVG using real body.webp plate */
export function bodySilhouetteSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);

  return `
    <svg class="bodymap-svg shareera-atlas-svg" viewBox="0 0 900 1820" xmlns="http://www.w3.org/2000/svg" aria-label="Clinical Anatomical Doshic Atlas">
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
        <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.2" />
        </filter>
      </defs>

      <!-- Real 2D High-Resolution Anatomical Plate Image -->
      <image href="assets/plates/body.webp" x="50" y="0" width="800" height="1800" opacity="0.96" />

      <!-- Doshic Regions (Sthanas) Clinical Guideline Boundaries -->
      <!-- 1. KAPHA REGION: Above Heart (y: 0 - 450) -->
      <rect x="10" y="10" width="880" height="440" fill="rgba(16, 185, 129, 0.06)" rx="16" />
      <line x1="10" y1="450" x2="890" y2="450" stroke="#10b981" stroke-dasharray="8 6" stroke-width="3" opacity="0.85" />
      <rect x="20" y="20" width="220" height="38" rx="8" fill="#047857" filter="url(#card-shadow)" />
      <text x="32" y="45" fill="#ffffff" font-size="19" font-weight="700" letter-spacing="1">KAPHA STHANA</text>

      <!-- 2. PITTA REGION: Heart to Navel (y: 450 - 720) -->
      <rect x="10" y="450" width="880" height="270" fill="rgba(249, 115, 22, 0.06)" />
      <line x1="10" y1="720" x2="890" y2="720" stroke="#f97316" stroke-dasharray="8 6" stroke-width="3" opacity="0.85" />
      <rect x="20" y="462" width="210" height="38" rx="8" fill="#c2410c" filter="url(#card-shadow)" />
      <text x="32" y="487" fill="#ffffff" font-size="19" font-weight="700" letter-spacing="1">PITTA STHANA</text>

      <!-- 3. VATA REGION: Below Navel (y: 720 - 1810) -->
      <rect x="10" y="720" width="880" height="1090" fill="rgba(59, 130, 246, 0.06)" rx="16" />
      <rect x="20" y="732" width="200" height="38" rx="8" fill="#1d4ed8" filter="url(#card-shadow)" />
      <text x="32" y="757" fill="#ffffff" font-size="19" font-weight="700" letter-spacing="1">VATA STHANA</text>

      <!-- ==================== KAPHA CLINICAL HOTSPOTS (Above Heart) ==================== -->
      <!-- 1. Cranial & Neurological / Brain (Shiras) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Cranial & Neurological (Shiras)')}>
        <line x1="430" y1="136" x2="260" y2="136" stroke="#047857" stroke-width="3" />
        <circle cx="430" cy="136" r="20" fill="#047857" filter="url(#pin-glow-kapha)" />
        <circle cx="430" cy="136" r="8" fill="#ffffff" />
        <rect x="10" y="110" width="250" height="52" rx="10" fill="#ffffff" stroke="#047857" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="134" fill="#047857" font-size="17" font-weight="700">Cranial &amp; Brain</text>
        <text x="22" y="153" fill="#065f46" font-size="14" font-weight="500" font-style="italic">Shiras (Head / CNS)</text>
      </g>

      <!-- 2. ENT, Nasal & Paranasal (Ghrana) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'ENT, Nasal & Paranasal (Ghrana)')}>
        <line x1="430" y1="180" x2="640" y2="180" stroke="#0891b2" stroke-width="3" />
        <circle cx="430" cy="180" r="16" fill="#0891b2" filter="url(#pin-glow-kapha)" />
        <circle cx="430" cy="180" r="7" fill="#ffffff" />
        <rect x="640" y="154" width="250" height="52" rx="10" fill="#ffffff" stroke="#0891b2" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="652" y="178" fill="#0891b2" font-size="17" font-weight="700">ENT &amp; Nasal Cavity</text>
        <text x="652" y="197" fill="#0e7490" font-size="14" font-weight="500" font-style="italic">Ghrana (Upper Airway)</text>
      </g>

      <!-- 3. Oral Cavity & Pharynx (Kantha) -->
      <g class="bodymap-zone pin-kapha" ${zone('head', 'Oral Cavity & Pharynx (Kantha)')}>
        <line x1="430" y1="259" x2="260" y2="259" stroke="#047857" stroke-width="3" />
        <circle cx="430" cy="259" r="18" fill="#047857" filter="url(#pin-glow-kapha)" />
        <circle cx="430" cy="259" r="7" fill="#ffffff" />
        <rect x="10" y="233" width="250" height="52" rx="10" fill="#ffffff" stroke="#047857" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="257" fill="#047857" font-size="17" font-weight="700">Oral &amp; Pharyngeal</text>
        <text x="22" y="276" fill="#065f46" font-size="14" font-weight="500" font-style="italic">Kantha &amp; Jihva (Throat)</text>
      </g>

      <!-- 4. Pulmonary & Bronchial / Lungs (Uras) -->
      <g class="bodymap-zone pin-kapha" ${zone('chest', 'Pulmonary & Thoracic (Uras)')}>
        <line x1="430" y1="485" x2="260" y2="485" stroke="#0891b2" stroke-width="3" />
        <circle cx="430" cy="485" r="22" fill="#0891b2" filter="url(#pin-glow-kapha)" />
        <circle cx="430" cy="485" r="9" fill="#ffffff" />
        <rect x="10" y="459" width="250" height="52" rx="10" fill="#ffffff" stroke="#0891b2" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="483" fill="#0891b2" font-size="17" font-weight="700">Pulmonary &amp; Lungs</text>
        <text x="22" y="502" fill="#0e7490" font-size="14" font-weight="500" font-style="italic">Uras (Thorax / Respiration)</text>
      </g>

      <!-- ==================== PITTA CLINICAL HOTSPOTS (Heart to Navel) ==================== -->
      <!-- 5. Cardiovascular & Myocardial / Heart (Hridaya) -->
      <g class="bodymap-zone pin-pitta" ${zone('chest', 'Cardiovascular & Myocardial (Hridaya)')}>
        <line x1="408" y1="460" x2="640" y2="460" stroke="#dc2626" stroke-width="3" />
        <circle cx="408" cy="460" r="20" fill="#dc2626" filter="url(#pin-glow-pitta)" />
        <circle cx="408" cy="460" r="8" fill="#ffffff" />
        <rect x="640" y="434" width="250" height="52" rx="10" fill="#ffffff" stroke="#dc2626" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="652" y="458" fill="#b91c1c" font-size="17" font-weight="700">Cardiovascular &amp; Heart</text>
        <text x="652" y="477" fill="#991b1b" font-size="14" font-weight="500" font-style="italic">Hridaya &amp; Dhamani</text>
      </g>

      <!-- 6. Hepato-Gastric & Spleen (Amashaya & Yakrit) -->
      <g class="bodymap-zone pin-pitta" ${zone('torso', 'Hepato-Gastric & Spleen (Amashaya & Yakrit)')}>
        <line x1="391" y1="588" x2="260" y2="588" stroke="#c2410c" stroke-width="3" />
        <circle cx="391" cy="588" r="20" fill="#c2410c" filter="url(#pin-glow-pitta)" />
        <circle cx="391" cy="588" r="8" fill="#ffffff" />
        <rect x="10" y="562" width="250" height="52" rx="10" fill="#ffffff" stroke="#c2410c" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="586" fill="#c2410c" font-size="17" font-weight="700">Hepato-Gastric &amp; Spleen</text>
        <text x="22" y="605" fill="#9a3412" font-size="14" font-weight="500" font-style="italic">Amashaya, Yakrit &amp; Pliha</text>
      </g>

      <!-- 7. Gastro-Duodenal & Intestinal (Grahani) -->
      <g class="bodymap-zone pin-pitta" ${zone('torso', 'Gastro-Duodenal & Small Intestine (Grahani)')}>
        <line x1="446" y1="655" x2="640" y2="655" stroke="#ea580c" stroke-width="3" />
        <circle cx="446" cy="655" r="20" fill="#ea580c" filter="url(#pin-glow-pitta)" />
        <circle cx="446" cy="655" r="8" fill="#ffffff" />
        <rect x="640" y="629" width="250" height="52" rx="10" fill="#ffffff" stroke="#ea580c" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="652" y="653" fill="#c2410c" font-size="17" font-weight="700">Small Intestine</text>
        <text x="652" y="672" fill="#9a3412" font-size="14" font-weight="500" font-style="italic">Grahani &amp; Pittashaya</text>
      </g>

      <!-- ==================== VATA CLINICAL HOTSPOTS (Below Navel) ==================== -->
      <!-- 8. Colonic & Mesenteric / Navel (Nabhi & Pakvashaya) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Colonic & Mesenteric (Pakvashaya & Nabhi)')}>
        <line x1="429" y1="712" x2="260" y2="712" stroke="#1d4ed8" stroke-width="3" />
        <circle cx="429" cy="712" r="20" fill="#1d4ed8" filter="url(#pin-glow-vata)" />
        <circle cx="429" cy="712" r="8" fill="#ffffff" />
        <rect x="10" y="686" width="250" height="52" rx="10" fill="#ffffff" stroke="#1d4ed8" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="710" fill="#1d4ed8" font-size="17" font-weight="700">Colon &amp; Mesentery</text>
        <text x="22" y="729" fill="#1e40af" font-size="14" font-weight="500" font-style="italic">Nabhi &amp; Pakvashaya</text>
      </g>

      <!-- 9. Renal, Bladder & Pelvic (Basti & Shroni) -->
      <g class="bodymap-zone pin-vata" ${zone('torso', 'Renal, Bladder & Pelvic (Basti & Shroni)')}>
        <line x1="430" y1="877" x2="640" y2="877" stroke="#2563eb" stroke-width="3" />
        <circle cx="430" cy="877" r="20" fill="#2563eb" filter="url(#pin-glow-vata)" />
        <circle cx="430" cy="877" r="8" fill="#ffffff" />
        <rect x="640" y="851" width="250" height="52" rx="10" fill="#ffffff" stroke="#2563eb" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="652" y="875" fill="#1d4ed8" font-size="17" font-weight="700">Renal &amp; Pelvic Bladder</text>
        <text x="652" y="894" fill="#1e40af" font-size="14" font-weight="500" font-style="italic">Basti, Vrikka &amp; Shroni</text>
      </g>

      <!-- 10. Upper Extremities & Arm Joints (Parva) -->
      <g class="bodymap-zone pin-kapha" ${zone('arm', 'Upper Extremities & Joint (Parva)')}>
        <line x1="239" y1="375" x2="260" y2="375" stroke="#047857" stroke-width="3" />
        <circle cx="239" cy="375" r="20" fill="#047857" filter="url(#pin-glow-kapha)" />
        <circle cx="239" cy="375" r="8" fill="#ffffff" />
        <circle cx="652" cy="375" r="20" fill="#047857" filter="url(#pin-glow-kapha)" />
        <circle cx="652" cy="375" r="8" fill="#ffffff" />
        <rect x="10" y="349" width="250" height="52" rx="10" fill="#ffffff" stroke="#047857" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="373" fill="#047857" font-size="17" font-weight="700">Upper Extremity Joints</text>
        <text x="22" y="392" fill="#065f46" font-size="14" font-weight="500" font-style="italic">Parva (Arm / Shoulder)</text>
      </g>

      <!-- 11. Lower Extremities & Femoral (Sakthi) -->
      <g class="bodymap-zone pin-vata" ${zone('leg', 'Lower Extremity & Femoral (Sakthi)')}>
        <line x1="520" y1="1086" x2="260" y2="1086" stroke="#1d4ed8" stroke-width="3" />
        <circle cx="520" cy="1086" r="22" fill="#1d4ed8" filter="url(#pin-glow-vata)" />
        <circle cx="520" cy="1086" r="9" fill="#ffffff" />
        <circle cx="338" cy="1086" r="22" fill="#1d4ed8" filter="url(#pin-glow-vata)" />
        <circle cx="338" cy="1086" r="9" fill="#ffffff" />
        <rect x="10" y="1060" width="250" height="52" rx="10" fill="#ffffff" stroke="#1d4ed8" stroke-width="2.5" filter="url(#card-shadow)" />
        <text x="22" y="1084" fill="#1d4ed8" font-size="17" font-weight="700">Lower Extremities</text>
        <text x="22" y="1103" fill="#1e40af" font-size="14" font-weight="500" font-style="italic">Sakthi (Legs &amp; Feet)</text>
      </g>

    </svg>`;
}

/* Head & Neck closeup using real head.webp plate */
export function faceCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 900 1000" xmlns="http://www.w3.org/2000/svg" aria-label="Cranial and ENT Anatomical Plate">
      <image href="assets/plates/head.webp" x="0" y="0" width="900" height="1000" />
      <g class="bodymap-zone" ${zone('headgen', 'Cranial & CNS (Shiras)')}>
        <circle cx="448" cy="323" r="26" fill="#8b5cf6" opacity="0.9" />
        <circle cx="448" cy="323" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('ear', 'Auditory & Vestibular (Shrotra)')}>
        <circle cx="269" cy="428" r="26" fill="#10b981" opacity="0.9" />
        <circle cx="628" cy="428" r="26" fill="#10b981" opacity="0.9" />
      </g>
      <g class="bodymap-zone" ${zone('eye', 'Ophthalmic & Visual (Drik)')}>
        <circle cx="373" cy="404" r="24" fill="#06b6d4" opacity="0.9" />
        <circle cx="524" cy="404" r="24" fill="#06b6d4" opacity="0.9" />
      </g>
      <g class="bodymap-zone" ${zone('nose', 'Nasal Cavity (Ghrana)')}>
        <circle cx="449" cy="434" r="22" fill="#10b981" opacity="0.9" />
      </g>
      <g class="bodymap-zone" ${zone('mouth', 'Oral Cavity & Pharynx (Kantha)')}>
        <circle cx="449" cy="576" r="24" fill="#f97316" opacity="0.9" />
        <circle cx="448" cy="629" r="26" fill="#ef4444" opacity="0.9" />
      </g>
    </svg>`;
}

export function armCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg" aria-label="Upper Extremity Joints">
      <rect x="0" y="0" width="400" height="600" fill="rgba(16, 185, 129, 0.04)" rx="16" />
      <image href="assets/plates/body.webp" x="-100" y="-200" width="600" height="1350" opacity="0.92" />
      <g class="bodymap-zone" ${zone('shoulder', 'Glenohumeral / Shoulder Joint')}>
        <circle cx="150" cy="120" r="28" fill="#10b981" opacity="0.9" />
        <circle cx="150" cy="120" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('elbow', 'Humeroradial / Elbow Joint')}>
        <circle cx="130" cy="280" r="26" fill="#10b981" opacity="0.9" />
        <circle cx="130" cy="280" r="9" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('wrist', 'Radiocarpal / Wrist & Hand')}>
        <circle cx="110" cy="440" r="28" fill="#10b981" opacity="0.9" />
        <circle cx="110" cy="440" r="10" fill="#ffffff" />
      </g>
    </svg>`;
}

export function legCloseupSVG(counts = {}) {
  const zone = (id, label) => hotspotAttrs(id, label, counts[id]);
  return `
    <svg class="bodymap-svg" viewBox="0 0 400 650" xmlns="http://www.w3.org/2000/svg" aria-label="Lower Extremity Joints">
      <rect x="0" y="0" width="400" height="650" fill="rgba(59, 130, 246, 0.04)" rx="16" />
      <image href="assets/plates/body.webp" x="-100" y="-700" width="600" height="1350" opacity="0.92" />
      <g class="bodymap-zone" ${zone('hip', 'Coxofemoral / Hip Joint')}>
        <circle cx="210" cy="90" r="30" fill="#3b82f6" opacity="0.9" />
        <circle cx="210" cy="90" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('knee', 'Patellofemoral / Knee Joint')}>
        <circle cx="220" cy="310" r="28" fill="#3b82f6" opacity="0.9" />
        <circle cx="220" cy="310" r="10" fill="#ffffff" />
      </g>
      <g class="bodymap-zone" ${zone('ankle', 'Talocrural / Ankle & Foot')}>
        <circle cx="230" cy="530" r="28" fill="#3b82f6" opacity="0.9" />
        <circle cx="230" cy="530" r="10" fill="#ffffff" />
      </g>
    </svg>`;
}
