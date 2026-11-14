import { GoogleGenAI } from "@google/genai";
// Read-only model inventory. Listing is not proof of Live entitlement/quota.
try {
  if (!process.env.GEMINI_API_KEY) throw new Error("not configured");
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 20000 },
  });
  const page = await ai.models.list({ config: { pageSize: 100 } });
  let configuredListed = false,
    liveModelsAdvertised = 0;
  for await (const m of page) {
    const name = m.name?.replace(/^models\//, "");
    if (name === process.env.GEMINI_MODEL) configuredListed = true;
    if (/live|native-audio/.test(name ?? "")) liveModelsAdvertised++;
  }
  console.log(
    JSON.stringify({
      configuredModelListed: configuredListed,
      liveModelsAdvertised,
      liveConnectionVerified: false,
      implementation:
        "browser speech recognition + reviewed text to server-side Gemini; text fallback",
      rawAudioRetained: false,
    }),
  );
} catch (e) {
  console.error(
    "Voice capability inventory unavailable. HTTP status:",
    Number(e.status ?? e.code) || "network/configuration",
  );
  process.exitCode = 1;
}
