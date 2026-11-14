import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbidden = files.filter(
  (path) => /^\.env(\.|$)/.test(path) && path !== ".env.example",
);
const key = process.env.GEMINI_API_KEY;
if (!key)
  throw new Error(
    "Load the existing .env.local to run the secret scan. Values are never printed.",
  );
for (const path of files) {
  if (readFileSync(path).includes(Buffer.from(key))) forbidden.push(path);
}
if (forbidden.length) {
  console.error(
    "FAIL: secret-bearing or environment files would be tracked:",
    [...new Set(forbidden)].join(", "),
  );
  process.exitCode = 1;
} else
  console.log(
    "PASS: no local environment files or configured Gemini key in tracked files.",
  );
