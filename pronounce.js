/**
 * Say — Egyptian Arabic pronunciation policy.
 *
 * Browser speechSynthesis only. No cloud voice and no paid service.
 * A voice is an Arabic (Egypt) locale only when its language tag is ar-EG,
 * or its id contains ar-eg / the ISO 639-3 code arz, or a generic/empty
 * Arabic tag is explicitly named Egypt. ar, ar-XA, ar-SA, ar-AE, and other
 * Arabic locales stay "not Egyptian" even if the name sounds familiar
 * (Maged, Hala, Google العربية).
 *
 * Egypt-locale voices are still not a colloquial Cairene coach. Microsoft
 * has described classic ar-EG (Hoda) as Modern Standard Arabic.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SayPronounce = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var RATE_NORMAL = 0.92;
  var RATE_SLOW = 0.65;

  var DIALECT_LIMITS = {
    egyptLocale:
      "Egypt-locale voices are often Modern Standard Arabic with an Egyptian accent, not everyday Cairene (مصري). Sounds such as ج and ق may still differ from Cairo speech.",
    notEgyptian:
      "This voice is Arabic, but it is not Egyptian. Playback is a fallback and will not match مصري.",
    noArabic:
      "No Arabic voice is installed. A non-Arabic voice is not used.",
    noSpeech: "This browser has no speech synthesis, so pronunciation cannot play.",
    tap: "Audio plays only after you tap Hear, Slow, or Speak.",
    slow:
      "Slow replay uses about two-thirds speed. It is not a studio time-stretch, and some browsers clamp the rate.",
    deviceOnly:
      "Say does not call a cloud or paid voice. Quality is whatever this device has installed.",
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
    if (opts.speechUnavailable) {
      return {
        level: "error",
        badge: "Playback unavailable",
        short: "Speech playback isn’t available in this browser.",
        text: DIALECT_LIMITS.noSpeech + " Translation still works. " + DIALECT_LIMITS.deviceOnly,
      };
    }
    if (!opts.voicesKnown) {
      return {
        level: "pending",
        badge: "Checking voices",
        short: "Checking this device for an Arabic (Egypt) voice.",
        text:
          "Checking this device for an Arabic (Egypt) voice. " +
          DIALECT_LIMITS.tap +
          " " +
          DIALECT_LIMITS.deviceOnly,
      };
    }
    var pick = opts.pick || { voice: null, tier: "none" };
    if (!pick.voice || pick.tier === "none" || pick.tier === "other") {
      return {
        level: "error",
        badge: "No Arabic voice",
        short: "No Arabic voice. A non-Arabic voice is not used.",
        text:
          DIALECT_LIMITS.noArabic +
          " Add an Arabic (Egypt) voice in your device’s speech settings, then tap Hear again. " +
          DIALECT_LIMITS.deviceOnly,
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
        " Install an Arabic (Egypt) voice for a closer reading." +
        retry,
    };
  }

  return {
    RATE_NORMAL: RATE_NORMAL,
    RATE_SLOW: RATE_SLOW,
    DIALECT_LIMITS: DIALECT_LIMITS,
    classifyVoice: classifyVoice,
    pickEgyptianVoice: pickEgyptianVoice,
    disclosure: disclosure,
    regionLabel: regionLabel,
  };
});
