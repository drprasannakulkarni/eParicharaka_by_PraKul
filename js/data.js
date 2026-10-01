/* Data access. Fetches once, caches, and never mutates what it hands out. */

const cache = new Map();

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(`data/${path}`).then(r => {
    if (!r.ok) throw new Error(`Could not load ${path} (${r.status})`);
    return r.json();
  }).catch(err => {
    cache.delete(path);
    throw err;
  });
  cache.set(path, p);
  return p;
}

/* Warming and reading are the same operation: getJSON caches the promise, so a
   file the prefetcher pulled is simply already resolved when a view asks. */
export const warm = path => getJSON(path);

export const loadIndex        = () => getJSON('index.json');
export const loadMeta         = () => getJSON('meta.json');
export const loadConditions   = () => getJSON('conditions.json');
export const loadEvidence     = () => getJSON('evidence.json');
export const loadBundle       = ccId => getJSON(`cc/${ccId}.json`);
export const loadExamVideos   = () => getJSON('exam_videos.json');
export const loadImagery      = () => getJSON('imagery.json');
export const loadAyurvedaMap  = () => getJSON('ayurveda_map.json');
export const loadAyurvedaExamLibrary = () => getJSON('ayurveda_exam_library.json');
export const loadAyurvedaGlossary = () => getJSON('ayurveda_glossary.json');
export const loadSelfCareRemedies = () => getJSON('selfcare_remedies.json');
export const loadYoga4U           = () => getJSON('yoga4u.json');
export const loadNutrition        = () => getJSON('nutrition.json');
export const loadSymptomRedirects = () => getJSON('symptom_redirects.json');
export const loadRedFlags         = () => getJSON('red_flags.json');
/* Disease-level Vata/Pitta/Kapha reading for a matched classical Ayurveda
 * entity (keyed by the entity's lowercased name, e.g. "urdhvagata amlapitta"
 * -- the same string ayurveda_map.json's entities[].name uses), derived from
 * eParicharak_VPK_Mapping's automated 4-tier classifier over
 * Cl_Decision_Tree_Symptom_Dataset_Integrative.xlsx. See that workbook's own
 * VPK_Methodology sheet for the full derivation and confidence tiers. */
export const loadClassicalVpk     = () => getJSON('classical_vpk.json');
/* Lean, scoped export for the result page's Ayurveda card: {entity name ->
 * symptoms[]} for only the ~86 entity names ayurveda_map.json ever
 * references (68 of them have at least one symptom with a meaning) --
 * NOT the full ayurveda_glossary.json (13+ MB, every one of 3,224 terms
 * incl. slokas), which would be far too heavy to load on every result page.
 * Ayurveda A-Z's own comparison tool already has the full glossary loaded
 * for its own tab, so it doesn't need this. */
export const loadAyurvedaSymptomsLite = () => getJSON('ayurveda_symptoms_lite.json');
/* Zone groupings for the body-map symptom picker (js/bodymap.js) -- maps
 * each chief complaint's fine-grained index.json `region` (chest/throat/
 * face/ear/head/eye/abdomen/pelvis/back/leg/skin/general) onto one of a
 * handful of large, easy-to-tap silhouette zones. */
export const loadBodyMap          = () => getJSON('body_map.json');

/* Investigations are stored per condition; the reverse index is what the
 * investigations tab actually needs, so build it once here. */
export async function investigationIndex() {
  if (cache.has('_inv')) return cache.get('_inv');
  const conditions = await loadConditions();
  const map = new Map();
  for (const c of conditions) {
    for (const w of c.workup) {
      const key = w.trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        id: c.id, name: c.name, specialty: c.specialty, acuity: c.acuity,
      });
    }
  }
  const list = [...map.entries()]
    .map(([test, conds]) => ({
      test,
      conditions: conds.sort((a, b) => a.name.localeCompare(b.name)),
      count: conds.length,
    }))
    .sort((a, b) => b.count - a.count || a.test.localeCompare(b.test));
  cache.set('_inv', list);
  return list;
}

export function groupBySystem(chiefComplaints) {
  const NAMES = {
    cardiovascular: 'Heart and circulation',
    respiratory: 'Chest and breathing',
    neurological: 'Head and nervous system',
    gi: 'Stomach and digestion',
    gu: 'Urinary and genital',
    msk: 'Bones, joints and muscles',
    derm: 'Skin',
    eye: 'Eyes',
    ent: 'Ear, nose and throat',
    psych: 'Mood and mental health',
    general: 'General and whole-body',
  };
  const groups = new Map();
  for (const cc of chiefComplaints) {
    const key = NAMES[cc.system] || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cc);
  }
  return [...groups.entries()]
    .map(([name, items]) => ({
      name,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
