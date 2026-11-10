/**
 * Browser checks for Say pronunciation.
 * Uses system Chrome. Speech voices are injected so dialect states are deterministic.
 * A final page loads the real speechSynthesis and records whatever this machine has.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = "/opt/cursor/artifacts";
fs.mkdirSync(artifacts, { recursive: true });

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/") pathname = "/index.html";
    const file = path.join(root, pathname);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function installSpeech(page, voices) {
  return page.addInitScript((initial) => {
    const state = {
      voices: initial.slice(),
      listeners: [],
      speaking: false,
      pending: false,
      paused: false,
      spoken: [],
      hold: false,
      failNext: null,
    };
    window.__speech = state;
    window.__setVoices = (list) => {
      state.voices = list.map((v) => Object.assign({}, v));
      state.listeners.forEach((fn) => fn());
    };
    window.__holdSpeech = (on) => {
      state.hold = !!on;
    };
    window.__failNext = (code) => {
      state.failNext = code || "synthesis-failed";
    };
    const synth = {
      getVoices: () => state.voices.map((v) => Object.assign({}, v)),
      speak(u) {
        state.spoken.push({
          text: u.text,
          lang: u.lang,
          rate: u.rate,
          voice: u.voice ? { name: u.voice.name, lang: u.voice.lang, voiceURI: u.voice.voiceURI } : null,
        });
        if (state.failNext && String(u.text || "").trim()) {
          const code = state.failNext;
          state.failNext = null;
          state.speaking = false;
          setTimeout(() => u.onerror && u.onerror({ error: code }), 0);
          return;
        }
        state.speaking = true;
        if (!state.hold) {
          setTimeout(() => {
            if (!state.speaking) return;
            state.speaking = false;
            if (u.onend) u.onend();
          }, 60);
        }
      },
      cancel() {
        state.speaking = false;
        state.pending = false;
        state.paused = false;
      },
      pause() {
        state.paused = true;
      },
      resume() {
        state.paused = false;
      },
      addEventListener(name, fn) {
        if (name === "voiceschanged") state.listeners.push(fn);
      },
      removeEventListener() {},
      get speaking() {
        return state.speaking;
      },
      get pending() {
        return state.pending;
      },
      get paused() {
        return state.paused;
      },
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      get: () => synth,
    });
    const OrigUtterance = window.SpeechSynthesisUtterance;
    function TestUtterance(text) {
      const u = new OrigUtterance(text);
      let voice = null;
      try {
        Object.defineProperty(u, "voice", {
          configurable: true,
          get: () => voice,
          set: (value) => {
            voice = value;
          },
        });
      } catch (_) {
        /* keep the native setter */
      }
      return u;
    }
    TestUtterance.prototype = OrigUtterance.prototype;
    window.SpeechSynthesisUtterance = TestUtterance;
    window.__googlePlays = [];
    window.__googleFail = false;
    window.__googleHold = false;
    window.__SAY_ONLINE = true;
    function FakeAudio() {
      this.referrerPolicy = "";
      this.playbackRate = 1;
      this.preservesPitch = true;
      this.preload = "none";
      this.src = "";
      this.onended = null;
      this.onerror = null;
    }
    FakeAudio.prototype.play = function () {
      window.__googlePlays.push({
        src: this.src,
        referrerPolicy: this.referrerPolicy,
        playbackRate: this.playbackRate,
        preservesPitch: this.preservesPitch,
      });
      const self = this;
      if (window.__googleFail) {
        setTimeout(() => {
          if (typeof self.onerror === "function") self.onerror();
        }, 0);
        return Promise.reject(new Error("google-fail"));
      }
      if (!window.__googleHold) {
        setTimeout(() => {
          if (typeof self.onended === "function") self.onended();
        }, 20);
      }
      return Promise.resolve();
    };
    FakeAudio.prototype.pause = function () {};
    FakeAudio.prototype.load = function () {};
    FakeAudio.prototype.removeAttribute = function (name) {
      if (name === "src") this.src = "";
    };
    window.Audio = FakeAudio;
    try {
      localStorage.clear();
    } catch (_) {
      /* ignore */
    }
  }, voices);
}

function arabicUtterances(spoken) {
  return spoken.filter((item) => /[\u0600-\u06FF]/.test(item.text || ""));
}

async function translateHello(page) {
  await page.fill("#inputText", "hello");
  await page.click("#translateBtn");
  await page.waitForFunction(() => document.querySelector("#outputText").textContent.includes("أهلاً"));
}

async function shot(page, name) {
  const file = path.join(artifacts, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function assertNoXOverflow(page) {
  const box = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  assert.ok(box.sw <= box.cw + 1, "horizontal overflow " + box.sw + " > " + box.cw);
}

async function assertHearTargets(page) {
  for (const sel of ["#hearBtn", "#hearSlowBtn"]) {
    const box = await page.locator(sel).boundingBox();
    assert.ok(box, sel + " missing");
    assert.ok(box.height >= 43, sel + " height " + box.height);
    assert.ok(box.width >= 44, sel + " width " + box.width);
  }
}

async function openApp(browser, voices, viewport) {
  const page = await browser.newPage({
    viewport: viewport || { width: 1280, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  if (voices) await installSpeech(page, voices);
  await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#translateBtn");
  return { page, errors };
}

const hoda = { name: "Microsoft Hoda", lang: "ar-EG", voiceURI: "Microsoft Hoda - Arabic (Egypt)", localService: true, default: false };
const maged = { name: "Maged", lang: "ar-SA", voiceURI: "com.apple.voice.compact.ar-SA.Maged", localService: true, default: true };
const samantha = { name: "Samantha", lang: "en-US", voiceURI: "Samantha", localService: true, default: true };
const spanish = { name: "Monica", lang: "es-ES", voiceURI: "Monica", localService: true, default: false };

let base = "";
const report = [];

function note(line) {
  report.push(line);
  console.log(line);
}

const server = await startServer();
base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  // Egypt-locale voice: normal + slow, no autoplay, history buttons.
  {
    const { page, errors } = await openApp(browser, [samantha, maged, hoda]);
    await translateHello(page);
    const before = await page.evaluate(() => window.__speech.spoken.map((s) => s.text));
    assert.deepEqual(arabicUtterances(before.map((text) => ({ text }))), []);
    assert.equal(await page.locator("#pronounceBox").isVisible(), true);
    assert.equal(await page.locator("#pronounceBadge").textContent(), "Arabic (Egypt) voice");
    const caveat = await page.locator("#pronounceText").textContent();
    assert.match(caveat, /Microsoft Hoda/);
    assert.match(caveat, /not everyday Cairene/);
    assert.match(caveat, /Modern Standard Arabic/);
    await assertHearTargets(page);
    await assertNoXOverflow(page);
    await shot(page, "pronounce_egypt_locale_desktop.png");

    await page.evaluate(() => window.__holdSpeech(true));
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__speech.spoken.some((s) => s.text.includes("أهلاً")));
    let spoken = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(spoken.length, 1);
    assert.equal(spoken[0].voice && spoken[0].voice.lang, "ar-EG");
    assert.equal(spoken[0].voice.name, "Microsoft Hoda");
    assert.ok(Math.abs(spoken[0].rate - 0.92) < 0.001);
    const googleDuringEgypt = await page.evaluate(() => window.__googlePlays.length);
    assert.equal(googleDuringEgypt, 0, "an ar-EG voice is used instead of Google");
    assert.equal(await page.locator("#hearBtn").getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#speakStatus").isVisible(), true);
    await page.evaluate(() => {
      window.__speech.speaking = false;
      window.__speech.hold = false;
    });
    await page.waitForFunction(() => document.querySelector("#hearBtn").getAttribute("aria-pressed") === "false");

    await page.evaluate(() => window.__holdSpeech(true));
    await page.click("#hearSlowBtn");
    await page.waitForFunction(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)).length >= 2);
    spoken = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(spoken.length, 2, "slow tap must not auto-play extra audio");
    assert.ok(spoken[1].rate < spoken[0].rate);
    assert.ok(Math.abs(spoken[1].rate - 0.65) < 0.001);
    assert.equal(spoken[1].voice.lang, "ar-EG");
    assert.match(await page.locator("[data-speak-label]").textContent(), /slowly/i);
    assert.equal(await page.locator("#hearSlowBtn").getAttribute("aria-pressed"), "true");
    await shot(page, "pronounce_speaking_slow.png");
    await page.evaluate(() => {
      window.__speech.speaking = false;
      window.__speech.hold = false;
    });

    const historyHear = page.locator(".history-hear [data-hear-rate='normal']");
    assert.equal(await historyHear.count(), 1);
    await historyHear.click();
    await page.waitForFunction(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)).length >= 3);
    const labels = await page.locator(".history-hear button").allInnerTexts();
    assert.ok(labels.some((t) => t.trim() === "Hear"));
    assert.ok(labels.some((t) => t.trim() === "Slow"));
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS egypt-locale normal, slow, no autoplay, history hear");
  }

  // Online with only a Saudi voice: Google plays, and it is not labeled Egyptian.
  {
    const { page, errors } = await openApp(browser, [samantha, maged], { width: 360, height: 780 });
    await translateHello(page);
    assert.equal(await page.locator("#pronounceBadge").textContent(), "Google Arabic (online)");
    const text = await page.locator("#pronounceText").textContent();
    assert.match(text, /standard Arabic pronunciation, not Egyptian/);
    assert.doesNotMatch(text, /Install an Arabic/);
    assert.equal(await page.locator("#pronounceNote").evaluate((el) => el.classList.contains("error")), false);
    await page.evaluate(() => {
      window.__googleHold = true;
    });
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__googlePlays.length >= 1);
    const plays = await page.evaluate(() => window.__googlePlays);
    assert.match(plays[0].src, /translate\.google\.com\/translate_tts/);
    assert.match(plays[0].src, /tl=ar/);
    assert.equal(plays[0].referrerPolicy, "no-referrer");
    assert.doesNotMatch(plays[0].src, /ttsspeed/);
    assert.equal(plays[0].playbackRate, 1);
    const spoken = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(spoken.length, 0, "Google playback must not also speak with Maged");
    assert.match(await page.locator("[data-speak-label]").textContent(), /Speaking/);
    await shot(page, "google_playback_360.png");
    await page.evaluate(() => {
      window.__googleHold = false;
    });
    await page.click("#hearSlowBtn");
    await page.waitForFunction(() => window.__googlePlays.length >= 2);
    const slowPlay = await page.evaluate(() => window.__googlePlays[window.__googlePlays.length - 1]);
    assert.match(slowPlay.src, /ttsspeed=0\.1/);
    assert.equal(slowPlay.playbackRate, 1);
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS Google Arabic online is preferred over ar-SA and slow uses ttsspeed");
  }

  // If Google fails, the other device Arabic voice plays and is not called Egyptian.
  {
    const { page, errors } = await openApp(browser, [samantha, maged]);
    await translateHello(page);
    await page.evaluate(() => {
      window.__googleFail = true;
    });
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__speech.spoken.some((s) => s.text.includes("أهلاً")));
    const spoken = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(spoken[0].voice.name, "Maged");
    assert.equal(spoken[0].voice.lang, "ar-SA");
    assert.equal(await page.locator("#pronounceBadge").textContent(), "Not Egyptian");
    const text = await page.locator("#pronounceText").textContent();
    assert.match(text, /Saudi Arabia/);
    assert.match(text, /not Egyptian Arabic/);
    assert.doesNotMatch(text, /Google Arabic \(online\) is standard/);
    await shot(page, "pronounce_not_egyptian_fallback.png");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS Google failure falls back to Maged without calling it Egyptian");
  }

  // No device Arabic voice: Google plays, English TTS is not used. Offline shows an error.
  {
    const { page, errors } = await openApp(browser, [samantha], { width: 360, height: 780 });
    await translateHello(page);
    assert.equal(await page.locator("#pronounceBadge").textContent(), "Google Arabic (online)");
    await page.evaluate(() => {
      window.__googleFail = true;
      window.__SAY_ONLINE = false;
    });
    await page.click("#hearBtn");
    await page.waitForFunction(() => document.querySelector("#pronounceBadge").textContent === "Offline");
    const spoken = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(spoken.length, 0);
    assert.match(await page.locator("#pronounceText").textContent(), /offline/i);
    assert.equal(await page.locator("#hearBtn").getAttribute("aria-pressed"), "false");
    await shot(page, "google_offline_360.png");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS offline with no Arabic voice shows an error and does not speak English");
  }

  // Voices arrive after the tap. No automatic second playback.
  {
    const { page, errors } = await openApp(browser, []);
    await translateHello(page);
    assert.equal(await page.locator("#pronounceBadge").textContent(), "Checking voices");
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__googlePlays.length >= 1);
    const earlySpeech = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(earlySpeech.length, 0, "unknown voices use Google instead of a blank device voice");
    await page.evaluate((list) => window.__setVoices(list), [hoda]);
    await page.waitForFunction(() => document.querySelector("#pronounceText").textContent.includes("Tap Hear again"));
    await page.waitForTimeout(200);
    const still = await page.evaluate(() => ({
      speech: window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)).length,
      google: window.__googlePlays.length,
    }));
    assert.equal(still.speech, 0, "a late ar-EG voice must not auto-play");
    assert.equal(still.google, 1, "a late ar-EG voice must not replay Google");
    assert.match(await page.locator("#pronounceBadge").textContent(), /Arabic \(Egypt\) voice/);
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__speech.spoken.some((s) => s.voice && s.voice.name === "Microsoft Hoda"));
    const second = await page.evaluate(() => window.__speech.spoken.filter((s) => /[\u0600-\u06FF]/.test(s.text)));
    assert.equal(second[0].voice.name, "Microsoft Hoda");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS async voice load does not auto-replay; next tap uses ar-EG");
  }

  // Playback error clears the pressed state.
  {
    const { page, errors } = await openApp(browser, [hoda]);
    await translateHello(page);
    await page.evaluate(() => {
      window.__failNext("not-allowed");
      window.__googleFail = true;
    });
    await page.click("#hearBtn");
    await page.waitForFunction(() => document.querySelector("#pronounceBadge").textContent === "Playback failed");
    assert.match(await page.locator("#pronounceText").textContent(), /no Arabic voice|connection/i);
    assert.equal(await page.locator("#hearBtn").getAttribute("aria-pressed"), "false");
    assert.equal(await page.locator("#speakStatus").isVisible(), false);
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS playback error resets the button");
  }

  // Mobile layout, history controls, and a narrow phone width.
  {
    const { page, errors } = await openApp(browser, [maged], { width: 390, height: 844 });
    await translateHello(page);
    await page.fill("#inputText", "thank you");
    await page.click("#translateBtn");
    await page.waitForFunction(() => document.querySelector("#outputText").textContent.includes("شكراً"));
    await assertHearTargets(page);
    await assertNoXOverflow(page);
    const historyButtons = page.locator(".history-hear .hear-btn");
    assert.ok((await historyButtons.count()) >= 2);
    const hb = await historyButtons.first().boundingBox();
    assert.ok(hb.height >= 43, "history hear height " + hb.height);
    await page.locator("#pronounceBox").scrollIntoViewIfNeeded();
    await shot(page, "pronounce_mobile_hear_slow.png");
    await page.setViewportSize({ width: 320, height: 700 });
    await assertNoXOverflow(page);
    await assertHearTargets(page);
    await shot(page, "pronounce_mobile_320.png");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS mobile 390 and 320 layout");
  }

  // Regressions: Spanish has no Egyptian controls; mic and camera still work; copy still works.
  {
    const { page, errors } = await openApp(browser, [samantha, spanish, hoda], { width: 390, height: 844 });
    await page.locator(".pair-chip", { hasText: "ES" }).click();
    await page.fill("#inputText", "hola");
    await page.click("#translateBtn");
    await page.waitForFunction(() => document.querySelector("#outputText").textContent.trim() === "Hello");
    assert.equal(await page.locator("#pronounceBox").isVisible(), false);
    await page.click("#speakBtn");
    await page.waitForFunction(() => window.__speech.spoken.some((s) => s.text.trim() === "Hello"));
    const hello = await page.evaluate(() => window.__speech.spoken.filter((s) => s.text.trim() === "Hello"));
    assert.equal(hello[0].lang, "en-US");
    await shot(page, "pronounce_spanish_unchanged.png");

    await page.click("#micBtn");
    await page.waitForFunction(() => {
      const hint = document.querySelector("#voiceHint");
      const listening = document.querySelector("#micBtn").classList.contains("listening");
      const toast = document.querySelector("#toast");
      const toastOn = toast && !toast.classList.contains("hidden") && /[Mm]ic/.test(toast.textContent || "");
      return (hint && !hint.classList.contains("hidden") && hint.textContent.length > 0) || listening || toastOn;
    });

    const chooser = page.waitForEvent("filechooser");
    await page.click("#cameraBtn");
    await chooser;

    await page.locator(".pair-chip.featured").click();
    await translateHello(page);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.click("#copyBtn");
    await page.waitForFunction(() => (document.querySelector("#toast") || {}).textContent === "Copied");

    assert.equal(await page.locator("#micBtn").count(), 1);
    assert.equal(await page.locator("#speakBtn").count(), 1);
    assert.equal(await page.locator("#cameraBtn").count(), 1);
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS spanish speak, mic, camera chooser, copy, Egyptian controls return");
  }

  // Real device voices — disclosure must match classifyVoice, no thrown errors.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.addInitScript(() => {
      try {
        localStorage.clear();
      } catch (_) {
        /* ignore */
      }
    });
    await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
    await translateHello(page);
    await page.waitForFunction(
      () => {
        const badge = document.querySelector("#pronounceBadge");
        return badge && badge.textContent && badge.textContent !== "Checking voices";
      },
      { timeout: 5000 }
    );
    const info = await page.evaluate(async () => {
      const synth = window.speechSynthesis;
      if (!synth) return { available: false, voices: [], badge: "", text: "" };
      await new Promise((resolve) => {
        const ready = () => synth.getVoices() && synth.getVoices().length;
        if (ready()) return resolve();
        const done = () => resolve();
        synth.addEventListener("voiceschanged", done, { once: true });
        setTimeout(done, 1200);
      });
      const voices = (synth.getVoices() || []).map((v) => ({
        name: v.name,
        lang: v.lang,
        voiceURI: v.voiceURI,
        localService: v.localService,
      }));
      return {
        available: true,
        voices,
        badge: (document.querySelector("#pronounceBadge").textContent || "").trim(),
        text: (document.querySelector("#pronounceText").textContent || "").trim(),
      };
    });
    note("REAL voices: " + (info.voices || []).map((v) => v.name + " [" + v.lang + "]").join(" | ") || "(none)");
    note("REAL badge: " + info.badge);
    note("REAL note: " + info.text);
    const arabic = (info.voices || []).filter((v) => /^ar\b/i.test(v.lang || "") || /ar-eg|arz|egypt/i.test((v.voiceURI || "") + " " + v.name));
    note("REAL arabic-related: " + (arabic.map((v) => v.name + " [" + v.lang + "]").join(" | ") || "(none)"));
    if (!info.available) {
      assert.match(info.text, /speech synthesis/i);
    } else if (!arabic.length) {
      assert.equal(info.badge, "Google Arabic (online)");
      assert.match(info.text, /not Egyptian/);
      assert.doesNotMatch(info.text, /does not call a cloud/);
    } else {
      assert.ok(info.badge === "Not Egyptian" || info.badge === "Arabic (Egypt) voice" || info.badge === "Checking voices");
      if (info.badge === "Not Egyptian") assert.match(info.text, /not Egyptian Arabic/);
      if (info.badge === "Arabic (Egypt) voice") assert.match(info.text, /not everyday Cairene/);
    }
    await shot(page, "pronounce_real_device_voices.png");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS real device disclosure matches installed voices");
  }

  // 360px: an installed ar-EG voice is still preferred over Google.
  {
    const { page, errors } = await openApp(browser, [samantha, maged, hoda], { width: 360, height: 780 });
    await translateHello(page);
    assert.equal(await page.locator("#pronounceBadge").textContent(), "Arabic (Egypt) voice");
    await page.evaluate(() => window.__holdSpeech(true));
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__speech.spoken.some((s) => s.voice && s.voice.lang === "ar-EG"));
    assert.equal(await page.evaluate(() => window.__googlePlays.length), 0);
    await assertNoXOverflow(page);
    await shot(page, "egypt_voice_preferred_360.png");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS 360px prefers ar-EG over Google");
  }

  // Long text is split into Google requests of at most 200 characters, in order.
  {
    const { page, errors } = await openApp(browser, [samantha]);
    await translateHello(page);
    const long = ("كلمة ".repeat(80)).trim();
    await page.evaluate((value) => {
      const out = document.getElementById("outputText");
      out.classList.add("has-result");
      out.textContent = value;
    }, long);
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__googlePlays.length >= 2);
    const parts = await page.evaluate(() =>
      window.__googlePlays.map((play) => {
        const q = new URL(play.src).searchParams.get("q") || "";
        return { q, referrerPolicy: play.referrerPolicy };
      })
    );
    assert.ok(parts.length >= 2);
    parts.forEach((part) => {
      assert.ok(part.q.length <= 200, "chunk " + part.q.length);
      assert.equal(part.referrerPolicy, "no-referrer");
      assert.match(part.q, /كلمة/);
    });
    assert.equal(parts.map((part) => part.q).join(" "), long);
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS Google text is chunked under 200 characters");
  }

  // Real Hear tap: the app's Audio element loads Google TTS with no Referer.
  {
    const page = await browser.newPage({ viewport: { width: 360, height: 780 } });
    const errors = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    const hits = [];
    page.on("request", (req) => {
      if (req.url().includes("translate_tts")) {
        hits.push({
          url: req.url(),
          referer: req.headers()["referer"] || req.headers()["referrer"] || "",
        });
      }
    });
    page.on("response", (res) => {
      if (res.url().includes("translate_tts")) {
        const hit = hits.find((item) => item.url === res.url() && !item.status);
        if (hit) {
          hit.status = res.status();
          hit.type = res.headers()["content-type"] || "";
        }
      }
    });
    await page.addInitScript(() => {
      const Orig = window.Audio;
      window.Audio = function SayAudio() {
        const audio = new Orig();
        const origPlay = audio.play.bind(audio);
        audio.play = function () {
          window.__sayAudio = audio;
          return origPlay();
        };
        return audio;
      };
      try {
        localStorage.clear();
      } catch (_) {
        /* ignore */
      }
    });
    await page.goto(base + "/index.html", { waitUntil: "domcontentloaded" });
    await translateHello(page);
    await page.waitForFunction(() => document.querySelector("#pronounceBadge").textContent === "Google Arabic (online)");
    await page.click("#hearBtn");
    await page.waitForFunction(() => window.__sayAudio && window.__sayAudio.readyState >= 2 && window.__sayAudio.duration > 0, null, {
      timeout: 15000,
    });
    const media = await page.evaluate(() => {
      const a = window.__sayAudio;
      return { duration: a.duration, readyState: a.readyState, referrerPolicy: a.referrerPolicy, paused: a.paused };
    });
    note(
      "AUDIO element duration=" +
        media.duration +
        " readyState=" +
        media.readyState +
        " paused=" +
        media.paused +
        " referrerPolicy=" +
        media.referrerPolicy
    );
    note("AUDIO requests " + JSON.stringify(hits.map((hit) => ({ status: hit.status, type: hit.type, referer: hit.referer || "(none)" }))));
    assert.equal(media.referrerPolicy, "no-referrer");
    assert.equal(media.paused, false);
    assert.ok(media.duration > 0.4, "duration " + media.duration);
    assert.ok(hits.some((hit) => hit.status === 200 && /audio/.test(hit.type || "")));
    assert.ok(hits.every((hit) => !hit.referer));
    assert.notEqual(await page.locator("#pronounceBadge").textContent(), "Playback failed");
    assert.equal(await page.locator("#pronounceNote").evaluate((el) => el.classList.contains("error")), false);
    await shot(page, "google_playback_real_360.png");
    assert.deepEqual(errors, []);
    await page.close();
    note("PASS real Google TTS audio plays from Hear");
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

fs.writeFileSync(path.join(artifacts, "pronounce_test_report.txt"), report.join("\n") + "\n");
console.log("ALL BROWSER CHECKS PASSED");
