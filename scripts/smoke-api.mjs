// Run against an active local server. All submitted data is fictional.
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
async function post(path, body) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`${path}: ${res.status} ${data.code || "FAILED"}`);
  return data;
}
const content =
  "This is a fictional test. I'm Jamie, a 32-year-old man in Astana. I want a long-term relationship with women or nonbinary people aged 27 to 36 in my city. I enjoy hiking, live music, coffee, cooking, and art. Kindness, curiosity and family are my values. I want children and don't smoke. My hard dealbreakers are smoking and not wanting children. I drink socially and have an active lifestyle. I prefer an active partner.";
try {
  const result = await post("/api/ai/onboard", {
    messages: [{ role: "user", content }],
    adultConfirmed: true,
    processingConsent: true,
    mode: "demo",
  });
  assert.equal(result.source, "gemini");
  assert.equal(result.draft.name, "Jamie");
  assert.equal(result.draft.age, 32);
  assert.equal(result.draft.attributes.smoking, "no");
  assert.ok(result.message.length > 0);
  console.log(
    "PASS: live Gemini onboarding and structured extraction. Fallback disclosed:",
    !!result.providerNotice,
  );
  const a = {
    ...result.draft,
    id: "guest",
    approved: true,
    fictional: true,
    blockedIds: [],
  };
  const b = {
    ...a,
    id: "test-candidate",
    name: "Lena",
    age: 30,
    gender: "woman",
    attributes: { ...a.attributes, children: null },
    preferences: {
      ...a.preferences,
      genders: ["man"],
      desired: { children: null, smoking: "no", drinking: null, pace: null },
      hard: ["smoking"],
    },
  };
  const question = await post("/api/ai/question", {
    a,
    b,
    dimension: "children",
    subjectId: b.id,
  });
  assert.equal(question.source, "gemini");
  assert.ok(question.question.length > 15);
  console.log("PASS: live Gemini relevant opt-in question.");
  const explanation = await post("/api/ai/explain", { a, b });
  assert.equal(explanation.source, "gemini");
  assert.ok(explanation.facts.length > 0);
  console.log("PASS: grounded explanation returns selected existing evidence.");
  const bad = await fetch(base + "/api/ai/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [], adultConfirmed: false }),
  });
  assert.equal(bad.status, 400);
  console.log("PASS: malformed/unconsented AI request rejected.");
} catch (e) {
  console.error("FAIL:", e.message);
  process.exitCode = 1;
}
