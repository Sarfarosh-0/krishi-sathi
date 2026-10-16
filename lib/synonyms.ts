/**
 * Topics the advisor deliberately does not answer (PRD non-goals). Declared
 * before the synonym groups so retrieval can refuse a query that names one
 * *before* scoring — otherwise "खाद की कीमत" matches the fertiliser chunks on
 * "खाद" and leaks an answer for a market-price question. Never add these as
 * tags to an answerable chunk.
 */
export const OUT_OF_SCOPE_GROUPS: readonly (readonly string[])[] = [
  [
    "कीमत",
    "भाव",
    "मूल्य",
    "दाम",
    "price",
    "rate",
    "मार्केट",
    "market",
    "keemat",
    "kimat",
    "bhav",
    "bhaav",
    "daam",
    "moolya",
  ],
  ["योजना", "सरकारी योजना", "scheme", "subsidy", "सब्सिडी", "अनुदान", "किसान योजना", "yojana", "sarkari"],
  ["लोन", "ऋण", "कर्ज", "loan", "credit", "बैंक", "bank", "karz", "karza"],
  ["लागत", "खर्च", "cost", "expense", "lagat", "kharch"],
  ["मछली", "मछली पालन", "fish", "fishery", "aquaculture", "मत्स्य", "machhli"],
  ["मौसम", "weather", "जलवायु", "climate", "पूर्वानुमान", "forecast", "mausam", "mosam"],
];

/** Every out-of-scope term, for the pre-scoring refusal check. */
export const OUT_OF_SCOPE_TERMS: readonly string[] = (() => {
  const terms: string[] = [];
  for (const group of OUT_OF_SCOPE_GROUPS) {
    terms.push(...group);
  }
  return terms;
})();

/**
 * Hindi ⇄ English synonym groups (DECISIONS §4, PRD §7).
 *
 * Farmers phrase the same problem in many ways — "पीली इल्टी", "तना छेदक",
 * "borer" all mean the same pest. Each group below is a set of equivalent
 * terms; a query token that hits any member expands to the whole group before
 * scoring, so retrieval survives paraphrase and mixed-language questions.
 *
 * Rules of thumb:
 * - Every term is lower-case (matching normalisation in lib/retrieval.ts).
 * - Include both scripts and common Roman transliterations (gehu, dhaan...).
 * - Keep out structural boilerplate (लक्षण / उपाय / सावधानी) — it appears in
 *   every chunk and would carry zero signal. Those live in retrieval STOPWORDS.
 * - Multi-word terms are allowed and matched as substrings.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // ---- crops -----------------------------------------------------------
  ["गेहूँ", "गेहू", "गेहूं", "gehu", "gehun", "gehoon", "wheat"],
  ["धान", "धान की फसल", "चावल", "dhan", "dhaan", "chawal", "paddy", "rice"],
  ["सरसों", "सरसो", "राई", "सरसों की फसल", "sarson", "rai", "mustard"],
  ["प्याज", "प्याज़", "pyaz", "piyaz", "onion"],
  ["मसूर", "मसूर दाल", "masoor", "lentil"],

  // ---- pests -----------------------------------------------------------
  [
    "पीली इल्टी",
    "इल्टी",
    "पीला तना छेदक",
    "तना छेदक",
    "yellow stem borer",
    "stem borer",
    "borer",
    "सुंडी",
    "इल्ली",
    "ilti",
    "iltee",
    "tana chhedak",
  ],
  ["माहू", "चेपा", "लाही", "aphid", "aphids", "रस चूसक", "mahu", "chepa", "lahi"],
  ["थ्रिप्स", "थ्रीप्स", "थ्रिप", "thrips", "पत्ती चूसक"],
  ["डेड हार्ट", "dead heart", "सफेद बाली", "white ear"],
  // Generic pest words. Every pest chunk is tagged "कीट" / "pest", so mapping
  // the Roman transliterations into that group turns "keet"/"keeda" into a real
  // tag hit instead of a lucky alphabetical tie-break.
  [
    "कीट",
    "कीड़ा",
    "कीड़े",
    "कीड़ों",
    "कीटों",
    "pest",
    "pests",
    "insect",
    "insects",
    "keet",
    "keeda",
    "keede",
  ],

  // ---- diseases --------------------------------------------------------
  [
    "रतुआ",
    "गेरुआ",
    "पीला रतुआ",
    "भूरा रतुआ",
    "नीला रतुआ",
    "रतुआ रोग",
    "rust",
    "yellow rust",
    "brown rust",
    "leaf rust",
    "blue rust",
    "ratua",
    "gerua",
  ],
  ["झुलसा", "blight", "बैक्टीरियल झुलसा", "bacterial blight", "जीवाणु झुलसा", "jhulsa"],
  ["उकठा", "उकठा रोग", "wilt", "मुरझाना", "मुरझा", "ukatha"],

  // ---- topics ----------------------------------------------------------
  ["खाद", "उर्वरक", "fertiliser", "fertilizer", "पोषक तत्व", "nutrient", "khad", "khaad"],
  ["यूरिया", "urea", "नाइट्रोजन", "nitrogen", "top dressing", "टॉप ड्रेसिंग"],
  [
    "सिंचाई",
    "पानी देना",
    "सींचना",
    "irrigation",
    "irrigate",
    "watering",
    "water",
    "पानी",
    "sinchai",
    "pani",
  ],
  [
    "बुवाई",
    "बुआई",
    "बोवाई",
    "बोआई",
    "बोना",
    "बीजाई",
    "बीज",
    "sowing",
    "sow",
    "बोनी",
    "seed",
    "buwai",
    "bowai",
    "bona",
    "beej",
  ],
  ["रोपाई", "रोपना", "रोपण", "transplant", "transplanting", "नर्सरी", "nursery", "ropai"],
  ["बीज दर", "बीज मात्रा", "seed rate", "बीज की मात्रा"],
  ["नीम", "नीम तेल", "नीम का तेल", "neem", "neem oil", "नीम स्प्रे"],
  ["छिड़काव", "स्प्रे", "छिड़कना", "spray", "spraying", "फुहार"],
  ["सुरक्षा", "सुरक्षित", "safety", "safe", "बचाव", "protection", "suraksha"],
  [
    "बारिश",
    "वर्षा",
    "बरसात",
    "rain",
    "rainfall",
    "बारिश से पहले",
    "before rain",
    "barish",
    "varsha",
  ],
  ["जल भराव", "जलभराव", "waterlogging", "जल निकास", "drainage"],
  ["अवस्था", "चरण", "stage", "stages", "phase"],
  ["ताज जड़", "क्राउन रूट", "crown root initiation", "cri", "crown root"],
  ["पैदावार", "उपज", "yield", "production", "उत्पादन"],
  ["बीज उपचार", "seed treatment", "बीजोपचार"],

  // ---- question intent -------------------------------------------------
  ["इलाज", "उपचार", "नियंत्रण", "रोकथाम", "treatment", "control", "management"],
  ["समय", "समय-सारिणी", "timing", "time", "schedule"],
  ["नुकसान", "क्षति", "damage", "loss", "नुक़सान"],

  // ---- deliberately out-of-scope topics --------------------------------
  // Declared above so retrieval can also refuse them before scoring.
  ...OUT_OF_SCOPE_GROUPS,
];

/** term → every term in its group (built once at module load). */
export const SYNONYM_MAP: ReadonlyMap<string, readonly string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      const existing = map.get(term);
      if (existing) {
        // A term shared by two groups — merge instead of overwriting.
        existing.push(...group.filter((t) => !existing.includes(t)));
      } else {
        map.set(term, [...group]);
      }
    }
  }
  return map;
})();

/** All terms in `token`'s synonym group, or just `[token]` when unknown. */
export function expandToken(token: string): readonly string[] {
  return SYNONYM_MAP.get(token) ?? [token];
}
