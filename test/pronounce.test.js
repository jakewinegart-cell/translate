const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../pronounce.js");

function voice(partial) {
  return Object.assign(
    { name: "", lang: "", voiceURI: "", localService: false, default: false },
    partial
  );
}

test("ar-EG voices count as Arabic (Egypt) locale, not a colloquial guarantee", () => {
  for (const sample of [
    voice({ name: "Microsoft Hoda", lang: "ar-EG", voiceURI: "Microsoft Hoda - Arabic (Egypt)" }),
    voice({ name: "Microsoft Salma Online (Natural) - Arabic (Egypt)", lang: "ar-EG" }),
    voice({ name: "Microsoft Shakir", lang: "ar-eg" }),
  ]) {
    const info = policy.classifyVoice(sample);
    assert.equal(info.tier, "egyptian-locale");
    assert.equal(info.egyptianLocale, true);
  }
  const said = policy.disclosure({
    voicesKnown: true,
    pick: policy.pickEgyptianVoice([
      voice({ name: "Microsoft Hoda", lang: "ar-EG" }),
    ]),
  });
  assert.equal(said.badge, "Arabic (Egypt) voice");
  assert.match(said.text, /Microsoft Hoda \(ar-EG\)/);
  assert.match(said.text, /Modern Standard Arabic/);
  assert.match(said.text, /not everyday Cairene/);
  assert.doesNotMatch(said.badge, /Not Egyptian/);
  assert.doesNotMatch(said.text, /Egyptian voice/);
});

test("generic Arabic is never labeled Egyptian", () => {
  const samples = [
    voice({ name: "Maged", lang: "ar-SA", voiceURI: "com.apple.voice.compact.ar-SA.Maged" }),
    voice({ name: "Hala", lang: "ar-AE" }),
    voice({ name: "Google العربية", lang: "ar-XA", voiceURI: "Google العربية" }),
    voice({ name: "Arabic", lang: "ar" }),
    voice({ name: "Naayf", lang: "ar-SA" }),
    voice({ name: "Samantha", lang: "en-US" }),
    voice({ name: "Egyptian Arabic", lang: "en-US", voiceURI: "en-US-Egyptian Arabic" }),
  ];
  for (const sample of samples) {
    const info = policy.classifyVoice(sample);
    assert.notEqual(info.tier, "egyptian-locale", sample.name + " " + sample.lang);
    const said = policy.disclosure({
      voicesKnown: true,
      pick: { voice: sample, tier: info.tier === "other" ? "none" : info.tier, info },
    });
    if (info.tier === "arabic-other") {
      assert.equal(said.badge, "Not Egyptian");
      assert.match(said.text, /not Egyptian Arabic/);
      assert.match(said.text, new RegExp(policy.DIALECT_LIMITS.notEgyptian.replace(/[().]/g, "\\$&")));
      assert.match(said.text, /Install an Arabic \(Egypt\) voice/);
      assert.doesNotMatch(said.text, /Closest voice on this device/);
      assert.doesNotMatch(said.text, /Egypt-locale/);
    }
  }
  assert.equal(policy.classifyVoice(samples[0]).tier, "arabic-other");
  assert.match(policy.regionLabel("ar-SA"), /Saudi Arabia/);
  assert.match(policy.regionLabel("ar-XA"), /generic multi-region/);
  assert.equal(policy.classifyVoice(samples[5]).tier, "other");
  assert.equal(policy.classifyVoice(samples[6]).tier, "other");
});

test("arz and ar-eg ids count when the language tag is generic or empty", () => {
  const android = voice({
    name: "ar-eg-x-arz-local",
    lang: "",
    voiceURI: "com.google.android.tts:ar-eg-x-arz-local",
  });
  assert.equal(policy.classifyVoice(android).tier, "egyptian-locale");
  const genericNamed = voice({ name: "Arabic Egypt", lang: "ar", voiceURI: "ar" });
  assert.equal(policy.classifyVoice(genericNamed).tier, "egyptian-locale");
});

test("a specific non-Egypt tag stays not Egyptian unless the id carries ar-eg or arz", () => {
  const wrongName = voice({ name: "Egypt", lang: "ar-SA", voiceURI: "ar-SA-Egypt" });
  assert.equal(policy.classifyVoice(wrongName).tier, "arabic-other");
  const idWins = voice({ name: "Google", lang: "ar-XA", voiceURI: "ar-eg-x-arz-network" });
  assert.equal(policy.classifyVoice(idWins).tier, "egyptian-locale");
});

test("picker prefers an Egypt-locale voice over Saudi, Gulf, and generic Arabic", () => {
  const maged = voice({ name: "Maged", lang: "ar-SA", default: true, localService: true });
  const hala = voice({ name: "Hala", lang: "ar-AE", localService: true });
  const google = voice({ name: "Google العربية", lang: "ar-XA" });
  const hoda = voice({ name: "Microsoft Hoda", lang: "ar-EG", localService: false });
  const pick = policy.pickEgyptianVoice([maged, hala, google, hoda]);
  assert.equal(pick.voice, hoda);
  assert.equal(pick.tier, "egyptian-locale");
  const fallback = policy.pickEgyptianVoice([maged, hala, google]);
  assert.equal(fallback.tier, "arabic-other");
  assert.notEqual(fallback.voice.lang, "ar-EG");
  const none = policy.pickEgyptianVoice([voice({ name: "Samantha", lang: "en-US" })]);
  assert.equal(none.voice, null);
  assert.equal(none.tier, "none");
});

test("disclosure for missing voices does not offer a non-Arabic voice", () => {
  const pending = policy.disclosure({ voicesKnown: false, pick: { voice: null, tier: "none" } });
  assert.equal(pending.level, "pending");
  assert.match(pending.text, /Audio plays only after you tap/);
  const missing = policy.disclosure({ voicesKnown: true, pick: { voice: null, tier: "none" } });
  assert.equal(missing.badge, "No Arabic voice");
  assert.match(missing.text, /A non-Arabic voice is not used/);
  const dead = policy.disclosure({ speechUnavailable: true, voicesKnown: true });
  assert.match(dead.text, /no speech synthesis/);
  assert.match(dead.text, /Translation still works/);
});

test("slow replay is slower than normal and stays in a safe speech rate", () => {
  assert.ok(policy.RATE_SLOW < policy.RATE_NORMAL);
  assert.ok(policy.RATE_SLOW >= 0.5);
  assert.ok(policy.RATE_NORMAL <= 1);
  assert.match(policy.DIALECT_LIMITS.slow, /two-thirds/);
  assert.match(policy.DIALECT_LIMITS.deviceOnly, /does not call a cloud or paid voice/);
});
