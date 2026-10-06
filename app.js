/**
 * Say — translation UI (Egyptian Arabic · مصري first)
 * Real: MyMemory text API (arz), Web Speech STT/TTS, Tesseract.js OCR
 * Fast path: curated DEMO dictionary for common phrases
 */
(function () {
  "use strict";

  const STORAGE_KEY = "say.translate.v1";
  const HISTORY_KEY = "say.history.v1";
  const MAX_HISTORY = 8;

  /** Optional: set window.SAY_TRANSLATE_EMAIL = "you@example.com" before load for higher MyMemory quota */
  const MYMEMORY_EMAIL =
    (typeof window !== "undefined" && window.SAY_TRANSLATE_EMAIL) || "";

  const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

  /**
   * App lang id → MyMemory / ISO codes.
   * Egyptian Arabic uses ISO 639-3 `arz` (NOT `ar` MSA / Gulf default).
   * MyMemory tags matches as ar-EG when langpair uses arz.
   */
  const API_LANG = {
    en: "en",
    "ar-EG": "arz",
    es: "es",
    gl: "gl",
    ja: "ja",
  };

  /** Web Speech Recognition / Synthesis BCP-47 */
  const STT_LANG = {
    en: "en-US",
    "ar-EG": "ar-EG",
    es: "es-ES",
    gl: "gl-ES",
    ja: "ja-JP",
  };

  /** Tesseract.js traineddata codes (Galician → spa closest) */
  const OCR_LANG = {
    en: "eng",
    "ar-EG": "ara",
    es: "spa",
    gl: "spa",
    ja: "jpn",
  };

  const LANGS = {
    en: { id: "en", name: "English", short: "EN", rtl: false, tts: "en-US", script: "latn" },
    "ar-EG": {
      id: "ar-EG",
      name: "Egyptian Arabic",
      short: "مصري",
      rtl: true,
      tts: "ar-EG",
      script: "arab",
      label: "Egyptian Arabic · مصري",
    },
    es: { id: "es", name: "Spanish", short: "ES", rtl: false, tts: "es-ES", script: "latn" },
    gl: {
      id: "gl",
      name: "Galician (Galicia)",
      short: "GL",
      rtl: false,
      tts: "gl-ES",
      script: "latn",
      label: "Galician (Galicia)",
    },
    ja: { id: "ja", name: "Japanese", short: "JA", rtl: false, tts: "ja-JP", script: "jpan" },
  };

  const PAIRS = [
    {
      id: "en-arEG",
      label: "English ↔ Egyptian Arabic",
      shortLabel: "EN ↔ مصري",
      featured: true,
      langs: ["en", "ar-EG"],
    },
    {
      id: "en-es",
      label: "Spanish ↔ English",
      shortLabel: "ES ↔ EN",
      featured: false,
      langs: ["es", "en"],
    },
    {
      id: "en-gl",
      label: "Galician (Galicia) ↔ English",
      shortLabel: "GL ↔ EN",
      featured: false,
      langs: ["gl", "en"],
    },
    {
      id: "en-ja",
      label: "Japanese ↔ English",
      shortLabel: "JA ↔ EN",
      featured: false,
      langs: ["ja", "en"],
    },
  ];

  /** Demo dictionary: normalized source phrase -> map of target lang -> translation */
  const DEMO = {
    hello: {
      en: "Hello",
      es: "Hola",
      gl: "Ola",
      ja: "こんにちは",
      "ar-EG": "أهلاً",
    },
    hi: {
      en: "Hi",
      es: "Hola",
      gl: "Ola",
      ja: "やあ",
      "ar-EG": "إزيك",
    },
    "thank you": {
      en: "Thank you",
      es: "Gracias",
      gl: "Grazas",
      ja: "ありがとう",
      "ar-EG": "شكراً",
    },
    thanks: {
      en: "Thanks",
      es: "Gracias",
      gl: "Grazas",
      ja: "どうも",
      "ar-EG": "متشكر",
    },
    "how are you": {
      en: "How are you?",
      es: "¿Cómo estás?",
      gl: "Como estás?",
      ja: "お元気ですか？",
      "ar-EG": "عامل إيه؟",
    },
    "good morning": {
      en: "Good morning",
      es: "Buenos días",
      gl: "Bos días",
      ja: "おはようございます",
      "ar-EG": "صباح الخير",
    },
    "good night": {
      en: "Good night",
      es: "Buenas noches",
      gl: "Boas noites",
      ja: "おやすみなさい",
      "ar-EG": "تصبح على خير",
    },
    goodbye: {
      en: "Goodbye",
      es: "Adiós",
      gl: "Adeus",
      ja: "さようなら",
      "ar-EG": "مع السلامة",
    },
    yes: {
      en: "Yes",
      es: "Sí",
      gl: "Si",
      ja: "はい",
      "ar-EG": "أيوه",
    },
    no: {
      en: "No",
      es: "No",
      gl: "Non",
      ja: "いいえ",
      "ar-EG": "لأ",
    },
    please: {
      en: "Please",
      es: "Por favor",
      gl: "Por favor",
      ja: "お願いします",
      "ar-EG": "من فضلك",
    },
    "i love you": {
      en: "I love you",
      es: "Te quiero",
      gl: "Quérote",
      ja: "愛してる",
      "ar-EG": "بحبك",
    },
    water: {
      en: "Water",
      es: "Agua",
      gl: "Auga",
      ja: "水",
      "ar-EG": "مية",
    },
    // Egyptian Arabic native phrases (reverse)
    "أهلاً": { en: "Hello", es: "Hola", gl: "Ola", ja: "こんにちは", "ar-EG": "أهلاً" },
    أهلا: { en: "Hello", es: "Hola", gl: "Ola", ja: "こんにちは", "ar-EG": "أهلاً" },
    إزيك: { en: "How are you? (EG)", es: "¿Cómo estás?", gl: "Como estás?", ja: "元気？", "ar-EG": "إزيك" },
    "عامل إيه": { en: "How are you doing?", es: "¿Cómo te va?", gl: "Como vai?", ja: "調子どう？", "ar-EG": "عامل إيه؟" },
    "عامل إيه؟": { en: "How are you doing?", es: "¿Cómo te va?", gl: "Como vai?", ja: "調子どう？", "ar-EG": "عامل إيه؟" },
    شكرا: { en: "Thank you", es: "Gracias", gl: "Grazas", ja: "ありがとう", "ar-EG": "شكراً" },
    "شكراً": { en: "Thank you", es: "Gracias", gl: "Grazas", ja: "ありがとう", "ar-EG": "شكراً" },
    متشكر: { en: "Thanks", es: "Gracias", gl: "Grazas", ja: "どうも", "ar-EG": "متشكر" },
    "صباح الخير": { en: "Good morning", es: "Buenos días", gl: "Bos días", ja: "おはようございます", "ar-EG": "صباح الخير" },
    "مع السلامة": { en: "Goodbye", es: "Adiós", gl: "Adeus", ja: "さようなら", "ar-EG": "مع السلامة" },
    أيوه: { en: "Yes", es: "Sí", gl: "Si", ja: "はい", "ar-EG": "أيوه" },
    لأ: { en: "No", es: "No", gl: "Non", ja: "いいえ", "ar-EG": "لأ" },
    بحبك: { en: "I love you", es: "Te quiero", gl: "Quérote", ja: "愛してる", "ar-EG": "بحبك" },
    مية: { en: "Water", es: "Agua", gl: "Auga", ja: "水", "ar-EG": "مية" },
    // Spanish
    hola: { en: "Hello", es: "Hola", gl: "Ola", ja: "こんにちは", "ar-EG": "أهلاً" },
    gracias: { en: "Thank you", es: "Gracias", gl: "Grazas", ja: "ありがとう", "ar-EG": "شكراً" },
    "buenos días": { en: "Good morning", es: "Buenos días", gl: "Bos días", ja: "おはようございます", "ar-EG": "صباح الخير" },
    "cómo estás": { en: "How are you?", es: "¿Cómo estás?", gl: "Como estás?", ja: "お元気ですか？", "ar-EG": "عامل إيه؟" },
    "como estás": { en: "How are you?", es: "¿Cómo estás?", gl: "Como estás?", ja: "お元気ですか？", "ar-EG": "عامل إيه؟" },
    // Galician
    ola: { en: "Hello", es: "Hola", gl: "Ola", ja: "こんにちは", "ar-EG": "أهلاً" },
    grazas: { en: "Thank you", es: "Gracias", gl: "Grazas", ja: "ありがとう", "ar-EG": "شكراً" },
    "bos días": { en: "Good morning", es: "Buenos días", gl: "Bos días", ja: "おはようございます", "ar-EG": "صباح الخير" },
    // Japanese
    "こんにちは": { en: "Hello", es: "Hola", gl: "Ola", ja: "こんにちは", "ar-EG": "أهلاً" },
    "ありがとう": { en: "Thank you", es: "Gracias", gl: "Grazas", ja: "ありがとう", "ar-EG": "شكراً" },
    "おはようございます": { en: "Good morning", es: "Buenos días", gl: "Bos días", ja: "おはようございます", "ar-EG": "صباح الخير" },
    "お元気ですか": { en: "How are you?", es: "¿Cómo estás?", gl: "Como estás?", ja: "お元気ですか？", "ar-EG": "عامل إيه؟" },
    "お元気ですか？": { en: "How are you?", es: "¿Cómo estás?", gl: "Como estás?", ja: "お元気ですか？", "ar-EG": "عامل إيه؟" },
  };

  // State
  let state = {
    pairId: "en-arEG",
    source: "en",
    target: "ar-EG",
    history: [],
  };

  // DOM
  const $ = (id) => document.getElementById(id);
  const els = {
    pairChips: $("pairChips"),
    sourceLangBtn: $("sourceLangBtn"),
    targetLangBtn: $("targetLangBtn"),
    sourceLangName: $("sourceLangName"),
    targetLangName: $("targetLangName"),
    sourceLangCode: $("sourceLangCode"),
    targetLangCode: $("targetLangCode"),
    swapBtn: $("swapBtn"),
    langMenu: $("langMenu"),
    inputText: $("inputText"),
    outputText: $("outputText"),
    inputLabel: $("inputLabel"),
    outputLabel: $("outputLabel"),
    translateBtn: $("translateBtn"),
    micBtn: $("micBtn"),
    micBtnMain: $("micBtnMain"),
    cameraBtn: $("cameraBtn"),
    imageInput: $("imageInput"),
    clearBtn: $("clearBtn"),
    speakBtn: $("speakBtn"),
    speakBtnMain: $("speakBtnMain"),
    copyBtn: $("copyBtn"),
    charCount: $("charCount"),
    micStatus: $("micStatus"),
    ocrStatus: $("ocrStatus"),
    speakStatus: $("speakStatus"),
    voiceHint: $("voiceHint"),
    demoNote: $("demoNote"),
    historyList: $("historyList"),
    clearHistoryBtn: $("clearHistoryBtn"),
    toast: $("toast"),
  };

  let toastTimer = null;
  let menuSide = null;
  let recognition = null;
  let tesseractLoading = null;
  let voicesCache = [];
  let voicesReady = false;
  let speechUnlocked = false;
  let speakResumeTimer = null;

  const TRANSLATE_BTN_HTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8l6 6M5 8l6-6M5 8h10a4 4 0 0 1 0 8h-2"/><path d="M13 16l6 6M19 16l-6 6"/></svg> Translate';

  function langDisplay(id) {
    const L = LANGS[id];
    return L.label || L.name;
  }

  function normalize(text) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[\u00bf\u00a1?!.,;:"'\u060c\u061b\u00ab\u00bb\u201c\u201d\u2018\u2019]/g, "")
      .replace(/\s+/g, " ");
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.pairId && PAIRS.some((x) => x.id === p.pairId)) {
          state.pairId = p.pairId;
          state.source = p.source;
          state.target = p.target;
        }
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) state.history = JSON.parse(h) || [];
    } catch (_) {
      /* ignore */
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          pairId: state.pairId,
          source: state.source,
          target: state.target,
        })
      );
    } catch (_) {
      /* ignore */
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, MAX_HISTORY)));
    } catch (_) {
      /* ignore */
    }
  }

  function currentPair() {
    return PAIRS.find((p) => p.id === state.pairId) || PAIRS[0];
  }

  function showToast(msg, ms) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), ms || 2800);
  }

  function applyScriptClass(el, langId) {
    el.classList.remove("rtl", "ja");
    if (LANGS[langId].rtl) el.classList.add("rtl");
    if (langId === "ja") el.classList.add("ja");
  }

  function renderPairs() {
    els.pairChips.innerHTML = "";
    PAIRS.forEach((pair) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pair-chip" + (pair.featured ? " featured" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", pair.id === state.pairId ? "true" : "false");
      if (pair.id === state.pairId) btn.classList.add("active");

      if (pair.featured) {
        btn.innerHTML =
          '<span class="chip-badge">Recommended</span>' +
          "<span>EN ↔ Egyptian Arabic</span>" +
          '<span class="chip-ar">مصري</span>';
      } else {
        btn.textContent = pair.shortLabel;
        btn.title = pair.label;
      }

      btn.addEventListener("click", () => selectPair(pair.id));
      els.pairChips.appendChild(btn);
    });
  }

  function selectPair(pairId, preserveText) {
    const pair = PAIRS.find((p) => p.id === pairId);
    if (!pair) return;
    state.pairId = pairId;
    const [a, b] = pair.langs;
    if (!pair.langs.includes(state.source) || !pair.langs.includes(state.target)) {
      if (pair.featured) {
        state.source = "en";
        state.target = "ar-EG";
      } else if (a !== "en") {
        state.source = a;
        state.target = b;
      } else {
        state.source = a;
        state.target = b;
      }
    }
    savePrefs();
    renderPairs();
    updateLangUI();
    if (!preserveText) clearOutput();
    closeMenu();
  }

  function updateLangUI() {
    const src = LANGS[state.source];
    const tgt = LANGS[state.target];
    els.sourceLangName.textContent = src.name;
    els.targetLangName.textContent = tgt.name;
    els.sourceLangCode.textContent = src.short;
    els.targetLangCode.textContent = tgt.short;
    els.inputLabel.textContent = langDisplay(state.source);
    els.outputLabel.textContent = langDisplay(state.target);
    applyScriptClass(els.inputText, state.source);
    applyScriptClass(els.outputText, state.target);
  }

  function swapLanguages() {
    const tmp = state.source;
    state.source = state.target;
    state.target = tmp;
    els.swapBtn.classList.remove("spin");
    void els.swapBtn.offsetWidth;
    els.swapBtn.classList.add("spin");

    const inVal = els.inputText.value;
    const outEl = els.outputText;
    const hasResult = outEl.classList.contains("has-result");
    const outText = hasResult ? outEl.textContent : "";

    if (hasResult && outText) {
      els.inputText.value = outText;
      setOutput(inVal, null);
    }

    savePrefs();
    updateLangUI();
    updateCharCount();
  }

  function openMenu(side) {
    menuSide = side;
    const pair = currentPair();
    const options = pair.langs;
    els.langMenu.innerHTML = "";
    options.forEach((id) => {
      const L = LANGS[id];
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "lang-option";
      opt.setAttribute("role", "option");
      const selected = side === "source" ? state.source === id : state.target === id;
      opt.setAttribute("aria-selected", selected ? "true" : "false");
      opt.innerHTML =
        "<span>" +
        escapeHtml(langDisplay(id)) +
        '</span><span style="color:var(--text-dim);font-size:0.75rem">' +
        escapeHtml(L.short) +
        "</span>";
      opt.addEventListener("click", () => {
        if (side === "source") {
          if (id === state.target) {
            state.target = state.source;
          }
          state.source = id;
        } else {
          if (id === state.source) {
            state.source = state.target;
          }
          state.target = id;
        }
        if (!pair.langs.includes(state.source) || !pair.langs.includes(state.target)) {
          state.source = pair.langs[0];
          state.target = pair.langs[1];
        }
        savePrefs();
        updateLangUI();
        closeMenu();
      });
      els.langMenu.appendChild(opt);
    });
    els.langMenu.hidden = false;
    els.langMenu.classList.remove("hidden");
    els.sourceLangBtn.setAttribute("aria-expanded", side === "source" ? "true" : "false");
    els.targetLangBtn.setAttribute("aria-expanded", side === "target" ? "true" : "false");

    const bar = document.querySelector(".lang-bar");
    const app = document.querySelector(".app");
    if (bar && app) {
      const appRect = app.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      els.langMenu.style.position = "absolute";
      els.langMenu.style.top = barRect.bottom - appRect.top + app.scrollTop + 6 + "px";
      els.langMenu.style.left = "16px";
      els.langMenu.style.right = "16px";
    }
  }

  function closeMenu() {
    els.langMenu.hidden = true;
    els.langMenu.classList.add("hidden");
    els.sourceLangBtn.setAttribute("aria-expanded", "false");
    els.targetLangBtn.setAttribute("aria-expanded", "false");
    menuSide = null;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {string} text
   * @param {null|{kind:string,detail?:string}} note
   */
  function setOutput(text, note) {
    els.outputText.classList.add("has-result");
    els.outputText.textContent = text;
    applyScriptClass(els.outputText, state.target);
    if (note && note.kind === "api") {
      const eg =
        state.source === "ar-EG" || state.target === "ar-EG"
          ? " · API code arz (Egyptian Arabic; quality varies vs curated phrases)"
          : "";
      els.demoNote.textContent = "MyMemory · " + (note.detail || "live") + eg;
      els.demoNote.classList.remove("hidden");
    } else if (note && note.kind === "dict") {
      els.demoNote.textContent = "Curated phrase · Egyptian-first dictionary";
      els.demoNote.classList.remove("hidden");
    } else if (note && note.kind === "error") {
      els.demoNote.textContent = note.detail || "Translation failed";
      els.demoNote.classList.remove("hidden");
    } else {
      els.demoNote.classList.add("hidden");
    }
  }

  function clearOutput() {
    els.outputText.classList.remove("has-result");
    els.outputText.innerHTML = '<span class="placeholder">Translation appears here</span>';
    els.demoNote.classList.add("hidden");
    els.speakStatus.classList.add("hidden");
    els.speakBtn.classList.remove("speaking");
  }

  function updateCharCount() {
    els.charCount.textContent = els.inputText.value.length + " chars";
  }

  function lookupDemo(text, targetLang) {
    const key = normalize(text);
    if (DEMO[key] && DEMO[key][targetLang]) {
      return { text: DEMO[key][targetLang], demo: false };
    }
    const noQ = key.replace(/\?$/g, "").trim();
    if (DEMO[noQ] && DEMO[noQ][targetLang]) {
      return { text: DEMO[noQ][targetLang], demo: false };
    }
    const raw = text.trim();
    if (DEMO[raw] && DEMO[raw][targetLang]) {
      return { text: DEMO[raw][targetLang], demo: false };
    }
    const rawLower = raw.toLowerCase();
    if (DEMO[rawLower] && DEMO[rawLower][targetLang]) {
      return { text: DEMO[rawLower][targetLang], demo: false };
    }
    return null;
  }

  function looksLikeQuotaWarning(translated) {
    if (!translated) return true;
    const t = String(translated).toUpperCase();
    return t.indexOf("MYMEMORY WARNING") !== -1 || t.indexOf("QUOTA") !== -1;
  }

  async function translateViaMyMemory(text, sourceId, targetId) {
    const sl = API_LANG[sourceId] || "en";
    const tl = API_LANG[targetId] || "en";
    if (sl === tl) return { text: text, detail: "same language" };

    const params = new URLSearchParams();
    params.set("q", text.slice(0, 450));
    params.set("langpair", sl + "|" + tl);
    if (MYMEMORY_EMAIL) params.set("de", MYMEMORY_EMAIL);

    const res = await fetch(MYMEMORY_URL + "?" + params.toString(), {
      method: "GET",
      mode: "cors",
    });
    if (!res.ok) {
      throw new Error("MyMemory HTTP " + res.status);
    }
    const data = await res.json();
    const status = data.responseStatus;
    const translated = data.responseData && data.responseData.translatedText;
    if (status === 429 || looksLikeQuotaWarning(translated)) {
      throw new Error("MyMemory daily quota reached — try again later or set SAY_TRANSLATE_EMAIL");
    }
    if (status !== 200 || !translated) {
      throw new Error((data.responseDetails || "MyMemory error").toString().slice(0, 120));
    }
    return {
      text: String(translated).trim(),
      detail: sl + "→" + tl,
    };
  }

  async function doTranslate() {
    const text = els.inputText.value.trim();
    if (!text) {
      showToast("Type something to translate");
      els.inputText.focus();
      return;
    }

    if (state.source === state.target) {
      setOutput(text, { kind: "dict" });
      pushHistory(text, text, false);
      return;
    }

    const hit = lookupDemo(text, state.target);
    if (hit) {
      setOutput(hit.text, { kind: "dict" });
      pushHistory(text, hit.text, false);
      return;
    }

    els.translateBtn.disabled = true;
    els.translateBtn.textContent = "…";
    els.demoNote.textContent = "Translating via MyMemory…";
    els.demoNote.classList.remove("hidden");

    try {
      const result = await translateViaMyMemory(text, state.source, state.target);
      setOutput(result.text, { kind: "api", detail: result.detail });
      pushHistory(text, result.text, false);
    } catch (err) {
      const msg = (err && err.message) || "Translation failed";
      setOutput(text, { kind: "error", detail: msg });
      showToast(msg, 4000);
      pushHistory(text, text, true);
    } finally {
      els.translateBtn.disabled = false;
      els.translateBtn.innerHTML = TRANSLATE_BTN_HTML;
    }
  }

  function pushHistory(src, tgt, stub) {
    state.history.unshift({
      src,
      tgt,
      source: state.source,
      target: state.target,
      pairId: state.pairId,
      stub: !!stub,
      at: Date.now(),
    });
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    els.historyList.innerHTML = "";
    if (!state.history.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "No translations yet — try “hello” or “thank you”";
      els.historyList.appendChild(li);
      return;
    }
    state.history.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item";
      const srcL = LANGS[item.source] ? LANGS[item.source].short : item.source;
      const tgtL = LANGS[item.target] ? LANGS[item.target].short : item.target;
      const tgtClass =
        LANGS[item.target] && LANGS[item.target].rtl
          ? "rtl"
          : item.target === "ja"
            ? "ja"
            : "";
      btn.innerHTML =
        '<div class="h-meta">' +
        escapeHtml(srcL) +
        " → " +
        escapeHtml(tgtL) +
        (item.stub ? " · failed" : "") +
        "</div>" +
        '<div class="h-src">' +
        escapeHtml(item.src) +
        "</div>" +
        '<div class="h-tgt ' +
        tgtClass +
        '">' +
        escapeHtml(item.tgt) +
        "</div>";
      btn.addEventListener("click", () => {
        state.pairId = item.pairId;
        state.source = item.source;
        state.target = item.target;
        if (!PAIRS.some((p) => p.id === state.pairId)) state.pairId = PAIRS[0].id;
        savePrefs();
        renderPairs();
        updateLangUI();
        els.inputText.value = item.src;
        setOutput(item.tgt, item.stub ? { kind: "error", detail: "Previous failed/untranslated" } : null);
        updateCharCount();
      });
      li.appendChild(btn);
      els.historyList.appendChild(li);
    });
  }

  function getSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return SR || null;
  }

  function isMicSupported() {
    return !!(getSpeechRecognition() && window.isSecureContext);
  }

  function micUnsupportedReason() {
    if (!window.isSecureContext) {
      return "Mic needs a secure page (HTTPS or localhost). Open the live site over HTTPS.";
    }
    if (!getSpeechRecognition()) {
      return "Voice input (dictation) is not supported in this browser. On iPhone, Safari/Chrome/Brave share WebKit and usually lack SpeechRecognition — type instead, or use Chrome/Edge on Android or desktop.";
    }
    return "";
  }

  function setMicListeningUI(on) {
    const method = on ? "add" : "remove";
    els.micBtn.classList[method]("listening");
    if (els.micBtnMain) els.micBtnMain.classList[method]("listening");
    if (on) els.micStatus.classList.remove("hidden");
    else els.micStatus.classList.add("hidden");
  }

  function setSpeakSpeakingUI(on) {
    const method = on ? "add" : "remove";
    els.speakBtn.classList[method]("speaking");
    if (els.speakBtnMain) els.speakBtnMain.classList[method]("speaking");
    if (on) els.speakStatus.classList.remove("hidden");
    else els.speakStatus.classList.add("hidden");
  }

  function updateVoiceCapabilityUI() {
    const reason = micUnsupportedReason();
    const unsupported = !!reason;
    [els.micBtn, els.micBtnMain].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle("unsupported", unsupported);
      btn.title = unsupported
        ? "Mic — not supported on this browser"
        : "Mic — speak to type (tap once; allow microphone)";
    });
    if (els.voiceHint) {
      if (unsupported) {
        els.voiceHint.textContent = reason;
        els.voiceHint.classList.remove("hidden", "info");
      } else {
        els.voiceHint.classList.add("hidden");
        els.voiceHint.textContent = "";
      }
    }
    const ttsOk = typeof window.speechSynthesis !== "undefined";
    [els.speakBtn, els.speakBtnMain].forEach((btn) => {
      if (!btn) return;
      btn.classList.toggle("unsupported", !ttsOk);
      btn.title = ttsOk
        ? "Speak — hear translation aloud"
        : "Speak — speech synthesis unavailable";
    });
  }

  function unlockSpeech() {
    if (speechUnlocked || typeof window.speechSynthesis === "undefined") return;
    speechUnlocked = true;
    try {
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      warm.rate = 1;
      window.speechSynthesis.speak(warm);
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
  }

  function stopMic() {
    if (recognition) {
      try {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.stop();
      } catch (_) {
        /* ignore */
      }
      recognition = null;
    }
    setMicListeningUI(false);
  }

  function startMic() {
    // Must run from a direct user tap/click (gesture).
    unlockSpeech();

    if (recognition) {
      stopMic();
      showToast("Mic stopped");
      return;
    }

    const reason = micUnsupportedReason();
    if (reason) {
      updateVoiceCapabilityUI();
      showToast("Mic not supported here — see tip above", 4200);
      return;
    }

    const SR = getSpeechRecognition();
    const rec = new SR();
    recognition = rec;
    rec.lang = STT_LANG[state.source] || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    setMicListeningUI(true);
    els.micStatus.querySelector("span:last-child").textContent =
      "Listening… (" + rec.lang + ") — tap Mic again to stop";

    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      const text = (finalText || interim).trim();
      if (text) {
        els.inputText.value = text;
        updateCharCount();
        applyScriptClass(els.inputText, state.source);
      }
    };

    rec.onerror = (event) => {
      stopMic();
      const err = event.error || "error";
      if (err === "not-allowed" || err === "service-not-allowed") {
        showToast("Microphone permission denied — allow mic in browser settings", 4200);
      } else if (err === "no-speech") {
        showToast("No speech detected — tap Mic and try again");
      } else if (err === "aborted") {
        /* user/system abort — quiet */
      } else if (err === "language-not-supported") {
        showToast(
          "Browser may not support " + (STT_LANG[state.source] || state.source) + " — try English source",
          4000
        );
      } else if (err === "network") {
        showToast("Speech recognition needs network on this device", 3500);
      } else {
        showToast("Mic error: " + err);
      }
    };

    rec.onend = () => {
      stopMic();
    };

    try {
      rec.start();
    } catch (e) {
      stopMic();
      showToast("Could not start microphone — try again with a tap");
    }
  }

  function refreshVoices() {
    if (typeof window.speechSynthesis === "undefined") return;
    const list = window.speechSynthesis.getVoices() || [];
    if (list.length) {
      voicesCache = list;
      voicesReady = true;
    }
  }

  function waitForVoices(maxMs) {
    refreshVoices();
    if (voicesCache.length) return Promise.resolve(voicesCache);
    if (typeof window.speechSynthesis === "undefined") return Promise.resolve([]);
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        refreshVoices();
        resolve(voicesCache);
      };
      const onChange = () => finish();
      try {
        window.speechSynthesis.addEventListener("voiceschanged", onChange, { once: true });
      } catch (_) {
        window.speechSynthesis.onvoiceschanged = () => {
          onChange();
        };
      }
      let n = 0;
      const poll = setInterval(() => {
        refreshVoices();
        n += 1;
        if (voicesCache.length || n > 40) {
          clearInterval(poll);
          finish();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(poll);
        finish();
      }, maxMs || 1200);
    });
  }

  function scoreVoice(voice, want, primary) {
    const lang = (voice.lang || "").toLowerCase();
    let score = 0;
    if (lang === want) score += 100;
    else if (lang.indexOf(primary + "-") === 0 || lang === primary) score += 60;
    else if (lang.indexOf(primary) === 0) score += 40;
    // Prefer local / default / quality names lightly
    if (voice.localService) score += 8;
    if (voice.default) score += 4;
    const name = (voice.name || "").toLowerCase();
    if (/premium|enhanced|neural|natural|google|microsoft|siri/.test(name)) score += 6;
    // Egyptian Arabic: prefer EG / XA / SA over random ar
    if (want === "ar-eg") {
      if (/ar-eg/.test(lang)) score += 30;
      else if (/ar-xa|ar-sa|ar-ae/.test(lang)) score += 12;
      if (/egypt|egyptian|nassim|maged|hala/.test(name)) score += 10;
    }
    if (want === "ja-jp" && /ja/.test(lang)) {
      if (/kyoko|otoya|google|haruka/.test(name)) score += 6;
    }
    if (want === "es-es" && /es/.test(lang)) {
      if (/es-es|es-mx|es-us/.test(lang)) score += 8;
    }
    if (want === "gl-es") {
      if (/gl/.test(lang)) score += 40;
      else if (/es/.test(lang)) score += 20;
    }
    return score;
  }

  function pickVoice(bcp47) {
    refreshVoices();
    if (!voicesCache.length) return null;
    const want = (bcp47 || "").toLowerCase();
    const primary = want.split("-")[0];
    let best = null;
    let bestScore = 0;
    for (let i = 0; i < voicesCache.length; i++) {
      const v = voicesCache[i];
      const s = scoreVoice(v, want, primary);
      // Galician fallback: allow Spanish
      let effective = s;
      if (primary === "gl" && s === 0) {
        const lang = (v.lang || "").toLowerCase();
        if (lang.indexOf("es") === 0) effective = 15;
      }
      // Arabic: any ar*
      if ((want === "ar-eg" || primary === "ar") && effective === 0) {
        if (/ar/i.test(v.lang || "")) effective = 10;
      }
      if (effective > bestScore) {
        bestScore = effective;
        best = v;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function clearSpeakResume() {
    if (speakResumeTimer) {
      clearInterval(speakResumeTimer);
      speakResumeTimer = null;
    }
  }

  function kickSpeechSynthesis() {
    // Chrome (esp. Android) often leaves synthesis paused after speak().
    try {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch (_) {
      /* ignore */
    }
  }

  function finishSpeakingUI() {
    clearSpeakResume();
    setSpeakSpeakingUI(false);
  }

  function speakUtterance(text, bcp) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp;
    u.rate = state.target === "ja" ? 0.9 : 0.95;
    const voice = pickVoice(bcp);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || bcp;
    }
    setSpeakSpeakingUI(true);
    u.onend = () => finishSpeakingUI();
    u.onerror = () => {
      finishSpeakingUI();
      showToast("Could not speak on this device");
    };
    window.speechSynthesis.speak(u);
    kickSpeechSynthesis();
    clearSpeakResume();
    let ticks = 0;
    speakResumeTimer = setInterval(() => {
      ticks += 1;
      kickSpeechSynthesis();
      if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
        finishSpeakingUI();
      }
      if (ticks > 80) clearSpeakResume();
    }, 250);
    return voice;
  }

  function speakOutput() {
    unlockSpeech();
    const hasResult = els.outputText.classList.contains("has-result");
    const text = hasResult ? els.outputText.textContent.trim() : "";
    if (!text) {
      showToast("Translate something first, then tap Speak");
      return;
    }

    if (typeof window.speechSynthesis === "undefined") {
      showToast("Speech synthesis unavailable in this browser");
      return;
    }

    const bcp = LANGS[state.target].tts || "en-US";

    // Cancel any prior utterance, then speak inside this user gesture.
    try {
      window.speechSynthesis.cancel();
      clearSpeakResume();
    } catch (_) {
      /* ignore */
    }

    refreshVoices();

    const run = (voiceHint) => {
      try {
        const voice = speakUtterance(text, bcp);
        if (!voice && (state.target === "ar-EG" || state.target === "gl" || state.target === "ja")) {
          showToast(
            state.target === "gl"
              ? "No Galician voice — using Spanish/default if available"
              : state.target === "ja"
                ? "No Japanese voice found — using device default"
                : "No ar-EG voice — using best Arabic/default voice",
            3500
          );
        } else if (voiceHint) {
          /* voices loaded late — silent */
        }
      } catch (_) {
        finishSpeakingUI();
        showToast("Could not speak this language on this device");
      }
    };

    if (voicesCache.length) {
      run(false);
      return;
    }

    // Speak immediately with lang (keeps iOS user-gesture), then retry once voices arrive.
    run(false);
    waitForVoices(1500).then((list) => {
      if (!list.length) return;
      if (!els.speakBtn.classList.contains("speaking") && !(els.speakBtnMain && els.speakBtnMain.classList.contains("speaking"))) {
        // First speak may have ended instantly with no voice; try again with a loaded voice.
        try {
          window.speechSynthesis.cancel();
          speakUtterance(text, bcp);
        } catch (_) {
          /* ignore */
        }
      }
    });
  }

  function copyOutput() {
    const hasResult = els.outputText.classList.contains("has-result");
    const text = hasResult ? els.outputText.textContent.trim() : "";
    if (!text) {
      showToast("Nothing to copy");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast("Copied"),
        () => fallbackCopy(text)
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied");
    } catch (_) {
      showToast("Copy failed");
    }
    document.body.removeChild(ta);
  }

  function bind() {
    els.translateBtn.addEventListener("click", doTranslate);
    els.swapBtn.addEventListener("click", swapLanguages);
    els.micBtn.addEventListener("click", startMic);
    if (els.micBtnMain) els.micBtnMain.addEventListener("click", startMic);
    els.cameraBtn.addEventListener("click", startCamera);
    els.imageInput.addEventListener("change", onImagePicked);
    els.speakBtn.addEventListener("click", speakOutput);
    if (els.speakBtnMain) els.speakBtnMain.addEventListener("click", speakOutput);
    els.copyBtn.addEventListener("click", copyOutput);
    els.clearBtn.addEventListener("click", () => {
      els.inputText.value = "";
      clearOutput();
      updateCharCount();
      els.inputText.focus();
    });
    els.clearHistoryBtn.addEventListener("click", () => {
      state.history = [];
      saveHistory();
      renderHistory();
      showToast("History cleared");
    });
    els.inputText.addEventListener("input", updateCharCount);
    els.inputText.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        doTranslate();
      }
    });
    els.sourceLangBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menuSide === "source") closeMenu();
      else openMenu("source");
    });
    els.targetLangBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menuSide === "target") closeMenu();
      else openMenu("target");
    });
    document.addEventListener("click", (e) => {
      if (
        !els.langMenu.contains(e.target) &&
        !els.sourceLangBtn.contains(e.target) &&
        !els.targetLangBtn.contains(e.target)
      ) {
        closeMenu();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeMenu();
        stopMic();
      }
    });
    if (typeof window.speechSynthesis !== "undefined") {
      refreshVoices();
      try {
        window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
      } catch (_) {
        window.speechSynthesis.onvoiceschanged = refreshVoices;
      }
      waitForVoices(2500);
    }
    updateVoiceCapabilityUI();
  }

  function init() {
    document.querySelector(".app").style.position = "relative";
    loadPrefs();
    const pair = currentPair();
    if (!pair.langs.includes(state.source) || !pair.langs.includes(state.target)) {
      state.source = pair.langs[0];
      state.target = pair.langs[1];
    }
    renderPairs();
    updateLangUI();
    renderHistory();
    updateCharCount();
    bind();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
