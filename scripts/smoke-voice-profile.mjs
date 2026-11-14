import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const messages = [
  {
    role: "user",
    content:
      "For a fictional character: I'm Dana, 26, living in Astana. I study engineering, enjoy travelling, hiking and cooking, and I'm looking for a serious relationship with someone who shares my values.",
  },
];
async function turn() {
  const res = await fetch(base + "/api/ai/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      adultConfirmed: true,
      processingConsent: true,
      mode: "demo",
    }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${result.code}`);
  return result;
}
try {
  const first = await turn();
  assert.equal(first.source, "gemini");
  assert.equal(first.draft.age, 26);
  assert.equal(first.draft.city, "Astana");
  assert.equal(first.draft.gender, null);
  assert.deepEqual(first.draft.preferences.genders, []);
  for (const key of ["minAge", "maxAge", "locationMode", "strictIntent"])
    assert.equal(first.draft.preferences[key], null);
  assert.equal(first.readyForReview, false);
  console.log(
    "PASS: live Gemini extracts a reviewed fictional voice-style description without inventing missing gender or partner preferences.",
  );
  messages.push(
    { role: "assistant", content: first.message },
    {
      role: "user",
      content:
        "I am a woman, interested in men ages 21 to 35 in Astana only. I want long-term, and require that same relationship intention. I don't smoke. Kindness and curiosity matter to me.",
    },
  );
  const final = await turn();
  assert.equal(final.draft.gender, "woman");
  assert.deepEqual(final.draft.preferences.genders, ["man"]);
  assert.equal(final.draft.preferences.minAge, 21);
  assert.equal(final.draft.preferences.maxAge, 35);
  assert.equal(final.draft.preferences.locationMode, "local");
  assert.equal(final.draft.preferences.strictIntent, true);
  console.log(
    "PASS: a focused follow-up supplies the missing explicit partner preferences. No audio or credentials logged.",
  );
} catch (e) {
  console.error("FAIL: voice-profile smoke:", e.message);
  process.exitCode = 1;
}
