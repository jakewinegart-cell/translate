/**
 * Say — Egyptian Arabic pronunciation policy.
 *
 * Order: device ar-EG voice, then Google's public translate_tts Arabic
 * (standard Arabic, not Egyptian), then any other device Arabic voice.
 * A voice is an Arabic (Egypt) locale only when its language tag is ar-EG,
 * or its id contains ar-eg / the ISO 639-3 code arz, or a generic/empty
 * Arabic tag is explicitly named Egypt. ar, ar-XA, ar-SA, ar-AE, and other
 * Arabic locales stay "not Egyptian" even if the name sounds familiar
 * (Maged, Hala, Google العربية).
 *
 * Egypt-locale voices are still not a colloquial Cairene coach. Microsoft
 * has described classic ar-EG (Hoda) as Modern Standard Arabic.
 * Google's tl=ar voice is Modern Standard Arabic as well.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SayPronounce = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var RATE_NORMAL = 0.92;
  var RATE_SLOW = 0.65;
  // Measured for "من فضلك": no ttsspeed is 1.32s; ttsspeed=0.1 is 1.73s
  // (~0.76×). 0.24 and 0.3 were a shorter slowdown and identical to each
  // other. 0.5 and above matched normal, so Slow uses 0.1.
  var GOOGLE_TTS_SLOW = "0.1";
  var GOOGLE_TTS_MAX = 200;
  var GOOGLE_TTS_BASE = "https://translate.google.com/translate_tts";

  var DIALECT_LIMITS = {
    egyptLocale:
      "Egypt-locale voices are often Modern Standard Arabic with an Egyptian accent, not everyday Cairene (مصري). Sounds such as ج and ق may still differ from Cairo speech.",
    notEgyptian:
      "This voice is Arabic, but it is not Egyptian. Playback is a fallback and will not match مصري.",
    googleOnline:
      "Google Arabic (online) is standard Arabic pronunciation, not Egyptian (مصري).",
    noArabic:
      "Couldn’t reach Google’s Arabic voice, and this device has no Arabic voice.",
    offline:
      "You’re offline, and this device has no Arabic voice, so this phrase can’t be played.",
    noSpeech:
      "This browser has no device speech synthesis. Hear can still use Google Arabic (online) while you are connected.",
    tap: "Audio plays only after you tap Hear, Slow, or Speak.",
    slow:
      "Slow replay is about two-thirds speed. Google’s voice uses its own ttsspeed setting; a device voice uses the speech rate.",
  };

  var REGION = {
    ar: "Arabic (no country)",
    "ar-sa": "Arabic (Saudi Arabia)",
    "ar-xa": "Arabic (generic multi-region)",
    "ar-ae": "Arabic (UAE)",
    "ar-lb": "Arabic (Lebanon)",
    "ar-ma": "Arabic (Morocco)",
    "ar-dz": "Arabic (Algeria)",
    "ar-tn": "Arabic (Tunisia)",
    "ar-kw": "Arabic (Kuwait)",
    "ar-qa": "Arabic (Qatar)",
    "ar-bh": "Arabic (Bahrain)",
    "ar-om": "Arabic (Oman)",
    "ar-ye": "Arabic (Yemen)",
    "ar-iq": "Arabic (Iraq)",
    "ar-sy": "Arabic (Syria)",
    "ar-jo": "Arabic (Jordan)",
    "ar-ps": "Arabic (Palestinian Territories)",
    "ar-ly": "Arabic (Libya)",
    "ar-sd": "Arabic (Sudan)",
    "ar-eg": "Arabic (Egypt)",
  };

  function normalizeLang(lang) {
    return String(lang || "")
      .trim()
      .replace(/_/g, "-")
      .toLowerCase();
  }

  function regionLabel(lang) {
    var norm = normalizeLang(lang);
    if (REGION[norm]) return REGION[norm];
    if (/^ar-eg\b/.test(norm)) return "Arabic (Egypt)";
    if (/^ar\b/.test(norm)) return "Arabic (" + (lang || norm) + ")";
    return lang || "Unknown language";
  }

  function voiceId(voice) {
    return (String(voice.name || "") + " " + String(voice.voiceURI || "")).toLowerCase();
  }

  /**
   * @returns {{tier:"egyptian-locale"|"arabic-other"|"other", egyptianLocale:boolean, lang:string, name:string}}
   */
  function classifyVoice(voice) {
    var empty = { tier: "other", egyptianLocale: false, lang: "", name: "" };
    if (!voice || typeof voice !== "object") return empty;
    var lang = normalizeLang(voice.lang);
    var name = String(voice.name || "");
    var id = voiceId(voice);
    var tokenEg = /(^|[^a-z0-9])(ar-eg|arz)([^a-z0-9]|$)/.test(id);
    var wordEgypt = /egypt|egyptian|مصر|مصري/.test(id);
    var specificRegion = /^ar-[a-z]{2}\b/.test(lang);
    var tier = "other";

    if (/^ar-eg\b/.test(lang)) {
      tier = "egyptian-locale";
    } else if (specificRegion) {
      // A country/region tag other than ar-EG (including ar-XA) is not Egyptian
      // unless the voice id itself carries ar-eg or arz.
      tier = tokenEg ? "egyptian-locale" : "arabic-other";
    } else if ((lang === "" || lang === "ar") && (tokenEg || wordEgypt)) {
      tier = "egyptian-locale";
    } else if (/^ar\b/.test(lang)) {
      tier = "arabic-other";
    }

    return {
      tier: tier,
      egyptianLocale: tier === "egyptian-locale",
      lang: voice.lang || "",
      name: name,
    };
  }

  function scoreVoice(voice, info) {
    if (!info || info.tier === "other") return 0;
    var score = info.tier === "egyptian-locale" ? 1000 : 100;
    if (/^ar-eg\b/.test(normalizeLang(voice.lang))) score += 50;
    if (voice.localService) score += 5;
    if (voice.default) score += 2;
    return score;
  }

  function pickEgyptianVoice(voices) {
    var list = voices || [];
    var best = null;
    var bestInfo = null;
    var bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var voice = list[i];
      var info = classifyVoice(voice);
      var score = scoreVoice(voice, info);
      if (score > bestScore) {
        bestScore = score;
        best = voice;
        bestInfo = info;
      }
    }
    if (!best) return { voice: null, tier: "none", info: null };
    return { voice: best, tier: bestInfo.tier, info: bestInfo };
  }

  function pickTier(voices, tier) {
    var list = voices || [];
    var best = null;
    var bestInfo = null;
    var bestScore = 0;
    for (var i = 0; i < list.length; i++) {
      var voice = list[i];
      var info = classifyVoice(voice);
      if (info.tier !== tier) continue;
      var score = scoreVoice(voice, info);
      if (score > bestScore) {
        bestScore = score;
        best = voice;
        bestInfo = info;
      }
    }
    if (!best) return { voice: null, tier: "none", info: null };
    return { voice: best, tier: tier, info: bestInfo };
  }

  /**
   * 1) device ar-EG  2) Google online Arabic  3) other device Arabic when offline
   * or after Google fails (the caller uses plan.fallback).
   */
  function choosePronunciation(opts) {
    opts = opts || {};
    var voices = opts.voices || [];
    var egypt = pickTier(voices, "egyptian-locale");
    var other = pickTier(voices, "arabic-other");
    if (egypt.voice) return { engine: "egyptian-device", pick: egypt, fallback: other };
    if (opts.online !== false) return { engine: "google", pick: null, fallback: other };
    if (other.voice) return { engine: "arabic-device", pick: other, fallback: null };
    return { engine: "none", pick: null, fallback: null };
  }

  function googleTtsUrl(text, slow) {
    var url =
      GOOGLE_TTS_BASE +
      "?ie=UTF-8&client=tw-ob&tl=ar&q=" +
      encodeURIComponent(String(text || ""));
    if (slow) url += "&ttsspeed=" + GOOGLE_TTS_SLOW;
    return url;
  }

  function pushChunk(parts, text) {
    var trimmed = String(text || "").trim();
    if (trimmed) parts.push(trimmed);
  }

  function splitLong(parts, text, maxLen) {
    var src = String(text || "").trim();
    if (!src) return;
    if (src.length <= maxLen) {
      pushChunk(parts, src);
      return;
    }
    var words = src.split(/\s+/);
    var buf = "";
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (!word) continue;
      if (word.length > maxLen) {
        if (buf) {
          pushChunk(parts, buf);
          buf = "";
        }
        for (var j = 0; j < word.length; j += maxLen) {
          pushChunk(parts, word.slice(j, j + maxLen));
        }
        continue;
      }
      if (!buf) buf = word;
      else if ((buf + " " + word).length <= maxLen) buf = buf + " " + word;
      else {
        pushChunk(parts, buf);
        buf = word;
      }
    }
    if (buf) pushChunk(parts, buf);
  }

  function chunkForGoogleTts(text, maxLen) {
    var limit = maxLen || GOOGLE_TTS_MAX;
    var src = String(text || "").replace(/\s+/g, " ").trim();
    if (!src) return [];
    if (src.length <= limit) return [src];
    var parts = [];
    var sentences = src.split(/(?<=[\.!\?؟\n؛])/);
    for (var i = 0; i < sentences.length; i++) splitLong(parts, sentences[i], limit);
    return parts;
  }

  function disclosure(opts) {
    opts = opts || {};
    if (opts.playbackError) {
      return {
        level: "error",
        badge: "Playback failed",
        short: opts.playbackError,
        text: opts.playbackError,
      };
    }
    if (opts.engine === "google") {
      return {
        level: "google",
        badge: "Google Arabic (online)",
        short: "Google Arabic (online). Standard Arabic, not Egyptian.",
        text: DIALECT_LIMITS.googleOnline + " " + DIALECT_LIMITS.tap,
      };
    }
    if (opts.engine === "none") {
      var offline = opts.online === false;
      return {
        level: "error",
        badge: offline ? "Offline" : "Playback failed",
        short: offline
          ? "You’re offline, and this device has no Arabic voice."
          : "Couldn’t play audio. Check the connection and tap Hear again.",
        text: offline ? DIALECT_LIMITS.offline : DIALECT_LIMITS.noArabic + " Check the connection and tap Hear again.",
      };
    }
    if (opts.speechUnavailable) {
      return {
        level: "google",
        badge: "Google Arabic (online)",
        short: "Google Arabic (online). Standard Arabic, not Egyptian.",
        text: DIALECT_LIMITS.noSpeech + " " + DIALECT_LIMITS.googleOnline,
      };
    }
    if (!opts.voicesKnown) {
      return {
        level: "pending",
        badge: "Checking voices",
        short: "Checking for an Arabic (Egypt) voice. Otherwise Hear uses Google Arabic.",
        text:
          "Checking this device for an Arabic (Egypt) voice. If none is installed, Hear uses Google Arabic (online). " +
          DIALECT_LIMITS.googleOnline +
          " " +
          DIALECT_LIMITS.tap,
      };
    }
    var pick = opts.pick || { voice: null, tier: "none" };
    if (!pick.voice || pick.tier === "none" || pick.tier === "other") {
      return {
        level: "error",
        badge: "Playback failed",
        short: "Couldn’t play audio. Check the connection and tap Hear again.",
        text: DIALECT_LIMITS.noArabic + " Check the connection and tap Hear again.",
      };
    }
    var name = pick.voice.name || "Unnamed voice";
    var lang = pick.voice.lang || "ar";
    var retry = opts.playedWithoutVoice
      ? " Voices finished loading after this tap. Tap Hear again to select this voice."
      : "";
    if (pick.tier === "egyptian-locale") {
      return {
        level: "ok",
        badge: "Arabic (Egypt) voice",
        short:
          "Arabic (Egypt) voice. Often standard Arabic, not full Cairene." +
          (opts.playedWithoutVoice ? " Tap Hear again to select this voice." : ""),
        text:
          "Using " +
          name +
          " (" +
          lang +
          "). Closest voice on this device. " +
          DIALECT_LIMITS.egyptLocale +
          retry,
      };
    }
    return {
      level: "warn",
      badge: "Not Egyptian",
      short:
        "Not Egyptian. " +
        regionLabel(lang) +
        "." +
        (opts.playedWithoutVoice ? " Tap Hear again to select this voice." : ""),
      text:
        name +
        " is " +
        regionLabel(lang) +
        " (" +
        lang +
        "), not Egyptian Arabic. " +
        DIALECT_LIMITS.notEgyptian +
        retry,
    };
  }

  return {
    RATE_NORMAL: RATE_NORMAL,
    RATE_SLOW: RATE_SLOW,
    GOOGLE_TTS_SLOW: GOOGLE_TTS_SLOW,
    GOOGLE_TTS_MAX: GOOGLE_TTS_MAX,
    DIALECT_LIMITS: DIALECT_LIMITS,
    classifyVoice: classifyVoice,
    pickEgyptianVoice: pickEgyptianVoice,
    pickTier: pickTier,
    choosePronunciation: choosePronunciation,
    googleTtsUrl: googleTtsUrl,
    chunkForGoogleTts: chunkForGoogleTts,
    disclosure: disclosure,
    regionLabel: regionLabel,
  };
});
