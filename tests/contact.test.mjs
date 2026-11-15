// Unit test for contactRule() from js/app.js. Run: node --test tests/contact.test.mjs
// app.js is a browser IIFE, so the function is cut out between the contact-rule markers and run in a sandbox.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "js", "app.js"), "utf8");
const m = src.match(/\/\* contact-rule:start[\s\S]*?\*\/([\s\S]*?)\/\* contact-rule:end \*\//);
if (!m) throw new Error("contact-rule markers not found in js/app.js");
export const contactRule = vm.runInNewContext(m[1] + "; contactRule;");

// value → expected rule ("" = rejected)
export const CASES = [
  ["вайбер 0671234567", "phone"],
  ["ivan_pro", "telegram"],
  ["+380 (67) 123-45-67", "phone"],
  ["t.me/ivan_pro", "telegram"],
  ["@ivan_pro", "telegram"],
  ["ivan@gmail.com", "email"],
  ["тел. 067.123.45.67", "phone"],
  ["", ""],
  ["аб", ""],
  ["1234", ""],
  ["іванко", "min5"],
  ["hello", "telegram"], // also a valid Telegram username without @, so that rule answers first
  ["   аб   ", ""],
  ["привіт, наберіть мене", "min5"]
];

for (const [value, rule] of CASES) {
  test(`«${value}» → ${rule || "rejected"}`, () => assert.equal(contactRule(value), rule));
}

if (process.argv.includes("--table")) {
  console.log("| Значення | Пройшло | Правило |\n| --- | --- | --- |");
  for (const [value] of CASES) {
    const r = contactRule(value);
    console.log(`| «${value}» | ${r ? "так" : "ні"} | ${r || "порожнє / < 5 символів"} |`);
  }
}
