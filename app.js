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
    cameraBtn: $("cameraBtn"),
    imageInput: $("imageInput"),
    clearBtn: $("clearBtn"),
    speakBtn: $("speakBtn"),
    copyBtn: $("copyBtn"),
    charCount: $("charCount"),
    micStatus: $("micStatus"),
    ocrStatus: $("ocrStatus"),
    speakStatus: $("speakStatus"),
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
    els.micBtn.classList.remove("listening");
    els.micStatus.classList.add("hidden");
  }

  function startMic() {
    if (recognition) {
      stopMic();
      showToast("Mic stopped");
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) {
      showToast("Voice input not supported in this browser — try Chrome/Edge");
      return;
    }

    const rec = new SR();
    recognition = rec;
    rec.lang = STT_LANG[state.source] || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    els.micBtn.classList.add("listening");
    els.micStatus.classList.remove("hidden");
    els.micStatus.querySelector("span:last-child").textContent =
      "Listening… (" + rec.lang + ")";

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
      if (err === "not-allowed") showToast("Microphone permission denied");
      else if (err === "no-speech") showToast("No speech detected");
      else if (err === "language-not-supported") {
        showToast("Browser may not support " + (STT_LANG[state.source] || state.source) + " — try en-US");
      } else showToast("Mic error: " + err);
    };

    rec.onend = () => {
      stopMic();
    };

    try {
      rec.start();
    } catch (e) {
      stopMic();
      showToast("Could not start microphone");
    }
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      s.async = true;
      s.onload = () => {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error("Tesseract failed to load"));
      };
      s.onerror = () => reject(new Error("Could not load Tesseract.js (CDN)"));
      document.head.appendChild(s);
    });
    return tesseractLoading;
  }

  function startCamera() {
    els.imageInput.click();
  }

  async function onImagePicked(e) {
    const file = e.target.files && e.target.files[0];
    els.imageInput.value = "";
    if (!file) return;

    const name = file.name || "photo.jpg";
    const ocrCode = OCR_LANG[state.source] || "eng";
    els.ocrStatus.classList.remove("hidden");
    els.ocrStatus.textContent = "OCR · loading engine for " + ocrCode + "…";

    try {
      const Tesseract = await loadTesseract();
      els.ocrStatus.textContent = "OCR · reading " + name + " (" + ocrCode + ")…";
      const result = await Tesseract.recognize(file, ocrCode, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            els.ocrStatus.textContent =
              "OCR · " + Math.round(m.progress * 100) + "% · " + name;
          }
        },
      });
      const text = (result && result.data && result.data.text ? result.data.text : "").trim();
      if (!text) {
        els.ocrStatus.textContent = "OCR · no text found in " + name;
        showToast("No text detected in image");
      } else {
        els.inputText.value = text;
        updateCharCount();
        applyScriptClass(els.inputText, state.source);
        els.ocrStatus.textContent = "OCR · done · " + name;
        showToast("OCR text inserted");
      }
    } catch (err) {
      els.ocrStatus.textContent = "OCR failed";
      showToast((err && err.message) || "OCR failed", 4000);
    }
    setTimeout(() => els.ocrStatus.classList.add("hidden"), 2800);
  }

  function refreshVoices() {
    if (typeof window.speechSynthesis === "undefined") return;
    voicesCache = window.speechSynthesis.getVoices() || [];
  }

  function pickVoice(bcp47) {
    refreshVoices();
    if (!voicesCache.length) return null;
    const want = (bcp47 || "").toLowerCase();
    const primary = want.split("-")[0];
    // Exact lang match
    let v = voicesCache.find((x) => (x.lang || "").toLowerCase() === want);
    if (v) return v;
    // Prefix match (ar-EG → ar-SA / ar-XA / ar)
    v = voicesCache.find((x) => (x.lang || "").toLowerCase().indexOf(primary) === 0);
    if (v) return v;
    // Galician fallback → Spanish
    if (primary === "gl") {
      v = voicesCache.find((x) => (x.lang || "").toLowerCase().indexOf("es") === 0);
      if (v) return v;
    }
    // Egyptian Arabic: prefer any Arabic voice
    if (want === "ar-eg" || primary === "ar") {
      v = voicesCache.find((x) => /ar/i.test(x.lang || ""));
      if (v) return v;
    }
    return null;
  }

  function speakOutput() {
    const hasResult = els.outputText.classList.contains("has-result");
    const text = hasResult ? els.outputText.textContent.trim() : "";
    if (!text) {
      showToast("Translate something first");
      return;
    }

    if (typeof window.speechSynthesis === "undefined") {
      showToast("Speech synthesis unavailable in this browser");
      return;
    }

    const bcp = LANGS[state.target].tts || "en-US";
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = bcp;
      u.rate = state.target === "ja" ? 0.9 : 0.95;
      const voice = pickVoice(bcp);
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || bcp;
      }
      els.speakBtn.classList.add("speaking");
      els.speakStatus.classList.remove("hidden");
      u.onend = u.onerror = () => {
        els.speakBtn.classList.remove("speaking");
        els.speakStatus.classList.add("hidden");
      };
      window.speechSynthesis.speak(u);
      if (!voice && (state.target === "ar-EG" || state.target === "gl")) {
        showToast(
          state.target === "gl"
            ? "No Galician voice — using best available (often Spanish)"
            : "No ar-EG voice — using best Arabic/default voice available",
          3500
        );
      }
    } catch (_) {
      els.speakBtn.classList.remove("speaking");
      els.speakStatus.classList.add("hidden");
      showToast("Could not speak this language on this device");
    }
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
    els.cameraBtn.addEventListener("click", startCamera);
    els.imageInput.addEventListener("change", onImagePicked);
    els.speakBtn.addEventListener("click", speakOutput);
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
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
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
