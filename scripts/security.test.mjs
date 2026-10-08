import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => /\.(?:[cm]?[jt]sx?|jsonc?|html|yml|yaml)$/.test(file));
const files = await Promise.all(tracked.map(async (file) => [file, await readFile(file, "utf8")]));
const joined = files.map(([file, source]) => `\n/* ${file} */\n${source}`).join("");

assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(joined), "Private key committed");
assert(!/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/.test(joined), "Telegram bot token-shaped secret committed");
for (const [file, source] of files.filter(([file]) => /^(?:src|server)\//.test(file))) {
  assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source), `Dynamic code execution in ${file}`);
  assert(!/dangerouslySetInnerHTML|\.innerHTML\s*=/.test(source), `Unsafe HTML injection in ${file}`);
}
const vite = await readFile("vite.config.ts", "utf8");
assert(vite.includes("object-src 'none'"), "CSP must block plugins/objects");
assert(vite.includes("form-action 'none'"), "CSP must block form exfiltration");
assert(!vite.includes("unsafe-eval"), "CSP must not allow eval");
const worker = await readFile("server/worker.mjs", "utf8");
assert(/diff\s*\|=\s*expected\[i\]\s*\^\s*actual\[i\]/.test(worker), "Telegram authentication must use a constant-time comparison");
assert(worker.includes("X-Telegram-Bot-Api-Secret-Token"), "Telegram webhook secret gate missing");
console.log("PASS security gate: no committed key/token shapes, dynamic code or HTML injection; strict CSP and Telegram auth/webhook guards present");
