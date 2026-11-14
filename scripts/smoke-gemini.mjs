import { GoogleGenAI } from "@google/genai";
// Intentionally never log provider exceptions, key, model setting, or response bodies.
if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) {
  console.error("FAIL: Gemini environment is missing.");
  process.exitCode = 1;
}
try {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 30000 },
  });
  const request = (model) =>
    ai.models.generateContent({
      model,
      contents: 'This is a fictional test. Return only JSON: {"ok":true}',
      config: { responseMimeType: "application/json", maxOutputTokens: 300 },
    });
  let response;
  try {
    response = await request(process.env.GEMINI_MODEL);
  } catch (error) {
    if (Number(error.status ?? error.code) !== 404) throw error;
    console.log(
      "NOTICE: configured model unavailable; testing the documented fallback.",
    );
    response = await request(
      process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash",
    );
  }
  if (JSON.parse(response.text).ok !== true) throw new Error("invalid");
  console.log("PASS: Gemini returned valid JSON.");
} catch (error) {
  console.error(
    "FAIL: Gemini smoke request. HTTP status:",
    Number(error.status ?? error.code) || "network/parse",
  );
  process.exitCode = 1;
}
