import type { Lang } from "./types";

/**
 * Client-side UI strings (DESIGN §5). The server-owned strings (refusal,
 * advisory) never appear here — they arrive on the stream and are rendered
 * exactly as delivered, exactly once.
 *
 * The five strings marked "(DESIGN §5)" are copied verbatim from the doc table
 * so the UI matches the documented contract.
 */
export interface UIStrings {
  tagline: string;
  dashboard: string;
  langToggleLabel: string;
  chipsLabel: string;
  emptyTitle: string;
  emptyHint: string;
  placeholder: string;
  send: string;
  stop: string;
  listen: string;
  ttsStop: string;
  ttsUnsupported: string;
  mic: string;
  micStop: string;
  micListening: string;
  micUnsupported: string;
  thinking: string;
  sourcesHeading: string;
  sourceExpand: string;
  sourceCollapse: string;
  userLabel: string;
  assistantLabel: string;
  retry: string;
  stopped: string;
  // Dashboard & history (Phase 5, DESIGN §1.3)
  tabImpact: string;
  tabHistory: string;
  close: string;
  askedLabel: string;
  answeredLabel: string;
  refusedLabel: string;
  lastAskedLabel: string;
  kbCoverageHeading: string;
  kbCropsUnit: string;
  kbDocsUnit: string;
  kbLangsUnit: string;
  deviceOnlyNote: string;
  historyEmpty: string;
  clearAll: string;
  deleteEntry: string;
  reopen: string;
  historyCountLabel: string;
  // Delete confirmation (FR12): explicit cancel/confirm before a destructive
  // per-item delete (DESIGN §7).
  cancel: string;
  delete: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  upstreamNote: string; // (DESIGN §5)
  rateLimitToast: string; // (DESIGN §5)
  offlineToast: string; // (DESIGN §5)
}

export const UI_STRINGS: Record<Lang, UIStrings> = {
  hi: {
    tagline: "छोटे किसानों के लिए AI सलाहकार",
    dashboard: "डैशबोर्ड",
    langToggleLabel: "भाषा बदलें",
    chipsLabel: "सुझाए गए सवाल",
    emptyTitle: "नमस्ते! मैं आपका कृषि सहायक हूँ।",
    emptyHint: "नीचे कोई सवाल चुनें या अपना सवाल लिखकर भेजें।",
    placeholder: "अपना सवाल लिखें…",
    send: "भेजें",
    stop: "रोकें",
    listen: "सुनें",
    ttsStop: "रोकें",
    ttsUnsupported: "इस ब्राउज़र में आवाज़ में सुनना उपलब्ध नहीं है।",
    mic: "आवाज़ से पूछें",
    micStop: "सुनना बंद करें",
    micListening: "सुन रहा हूँ…",
    micUnsupported: "इस ब्राउज़र में आवाज़ से पूछना उपलब्ध नहीं है — सवाल लिखें।",
    thinking: "सोच रहा हूँ…",
    sourcesHeading: "स्रोत",
    sourceExpand: "पूरा स्रोत देखें",
    sourceCollapse: "स्रोत बंद करें",
    userLabel: "आपका सवाल",
    assistantLabel: "कृषि साथी का जवाब",
    retry: "दोबारा कोशिश करें",
    stopped: "जवाब रोक दिया गया।",
    tabImpact: "इस डिवाइस का प्रभाव",
    tabHistory: "इतिहास",
    close: "बंद करें",
    askedLabel: "सवाल पूछे",
    answeredLabel: "जवाब मिले",
    refusedLabel: "नहीं मिला",
    lastAskedLabel: "पिछला सवाल",
    kbCoverageHeading: "ज्ञान कक्षा",
    kbCropsUnit: "फसलें",
    kbDocsUnit: "दस्तावेज़",
    kbLangsUnit: "भाषाएँ",
    deviceOnlyNote: "सभी आँकड़े इसी डिवाइस से — कोई डेटा बाहर नहीं जाता।",
    historyEmpty: "अभी कोई इतिहास नहीं है।",
    clearAll: "सब हटाएँ",
    deleteEntry: "इतिहास से हटाएँ",
    reopen: "फिर से खोलें",
    historyCountLabel: "कुल प्रविष्टियाँ",
    cancel: "रद्द करें",
    delete: "हटाएँ",
    deleteConfirmTitle: "इतिहास से हटाएँ?",
    deleteConfirmBody:
      "यह सवाल और इसका जवाब इतिहास से हटा दिया जाएगा। इसे वापस नहीं लाया जा सकता।",
    upstreamNote:
      "जवाब तैयार नहीं हो सका। नीचे ज्ञान-कोश से मिली जानकारी दी गई है।",
    rateLimitToast: "थोड़ा रुकिए, फिर कोशिश करें।",
    offlineToast: "कनेक्शन नहीं, दोबारा कोशिश करें।",
  },
  en: {
    tagline: "AI advisor for smallholder farmers",
    dashboard: "Dashboard",
    langToggleLabel: "Change language",
    chipsLabel: "Suggested questions",
    emptyTitle: "Hello! I'm your farming assistant.",
    emptyHint: "Pick a question below or type your own.",
    placeholder: "Type your question…",
    send: "Send",
    stop: "Stop",
    listen: "Listen",
    ttsStop: "Stop",
    ttsUnsupported: "Read-aloud isn't available in this browser.",
    mic: "Ask with your voice",
    micStop: "Stop listening",
    micListening: "Listening…",
    micUnsupported: "Voice input isn't available in this browser — please type.",
    thinking: "Thinking…",
    sourcesHeading: "Sources",
    sourceExpand: "Read full source",
    sourceCollapse: "Hide source",
    userLabel: "Your question",
    assistantLabel: "Krishi Sathi's answer",
    retry: "Try again",
    stopped: "Answer stopped.",
    tabImpact: "Impact from this device",
    tabHistory: "History",
    close: "Close",
    askedLabel: "Questions asked",
    answeredLabel: "Answered",
    refusedLabel: "Not found",
    lastAskedLabel: "Last question",
    kbCoverageHeading: "Knowledge base",
    kbCropsUnit: "crops",
    kbDocsUnit: "documents",
    kbLangsUnit: "languages",
    deviceOnlyNote: "All stats are from this device — no data leaves it.",
    historyEmpty: "No history yet.",
    clearAll: "Clear all",
    deleteEntry: "Delete from history",
    reopen: "Reopen",
    historyCountLabel: "Total entries",
    cancel: "Cancel",
    delete: "Delete",
    deleteConfirmTitle: "Delete from history?",
    deleteConfirmBody:
      "This question and its answer will be removed from your history. This can't be undone.",
    upstreamNote:
      "Could not generate an answer. Below is what I found in the knowledge base.",
    rateLimitToast: "Please wait a moment and try again.",
    offlineToast: "No connection — please try again.",
  },
};

/** One chip: a localized label plus the question it sends (FR3). */
export interface ChipDef {
  id: string;
  hi: { label: string; question: string };
  en: { label: string; question: string };
}

/**
 * The 8 suggested questions (DESIGN §1.1, DECISIONS §3). Chip #8 is
 * deliberately out of KB so the demo can show the refusal path.
 *
 * `question` is the exact text sent to `/api/ask` (it is BOTH the retrieval
 * query and the model prompt), so every answerable chip must keep the crop and
 * topic words its target KB chunk is indexed on (`kb/crop-docs.json`) — e.g.
 * `इल्टी` for the wheat borer chunk, `सिंचाई` for the paddy irrigation chunk.
 * Rewording a chip is safe as long as those anchors stay; dropping one silently
 * changes which chunk answers. Chip #8 must keep its out-of-scope wording
 * (fish/cost) so it still refuses.
 */
export const CHIPS: ChipDef[] = [
  {
    id: "wheat-borer",
    hi: { label: "गेहूँ: पीली इल्टी", question: "गेहूँ में पीली इल्टी का इलाज क्या है?" },
    en: { label: "Wheat: yellow stem borer", question: "How do I control yellow stem borer in wheat?" },
  },
  {
    id: "mustard-fertiliser",
    hi: { label: "सरसों: खाद", question: "सरसों में खाद कब डालें?" },
    en: { label: "Mustard: fertiliser", question: "When should I apply fertiliser to mustard?" },
  },
  {
    id: "paddy-irrigation",
    hi: { label: "धान: सिंचाई", question: "धान में सिंचाई कब-कब करनी चाहिए?" },
    en: { label: "Paddy: irrigation", question: "At which stages should I irrigate paddy?" },
  },
  {
    id: "wheat-rust",
    hi: { label: "गेहूँ: रतुआ", question: "गेहूँ में पीला रतुआ लगा है, क्या करें?" },
    en: { label: "Wheat: rust", question: "My wheat crop has yellow rust — what should I do?" },
  },
  {
    id: "neem-safety",
    hi: { label: "नीम: सुरक्षा", question: "नीम के छिड़काव में क्या सावधानी रखें?" },
    en: { label: "Neem: spray safety", question: "What precautions should I take while spraying neem oil?" },
  },
  {
    id: "pre-rain",
    hi: { label: "बारिश से पहले", question: "बारिश से पहले खेत में क्या करें?" },
    en: { label: "Before rain", question: "What preparations should I make before rain?" },
  },
  {
    id: "onion-sowing",
    hi: { label: "प्याज: बुवाई", question: "प्याज की बुवाई कब करें?" },
    en: { label: "Onion: sowing", question: "When should I sow onion?" },
  },
  {
    id: "fish-cost",
    hi: { label: "मछली पालन: लागत", question: "मछली पालन की लागत कितनी होती है?" },
    en: { label: "Fish farming: cost", question: "What is the cost of fish farming?" },
  },
];
