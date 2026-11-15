// One browser run of the audit form on /ua/. Run: node tests/form.e2e.mjs
// Clarity and Google requests are aborted; Web3Forms is mocked, so no real lead is ever sent.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
const server = createServer(async (req, res) => {
  let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (p.endsWith("\\") || p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(root, p));
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

let browser;
try { browser = await chromium.launch(); } catch { browser = await chromium.launch({ channel: "chrome" }); }
const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
await page.route(/clarity\.ms|google-analytics\.com|googletagmanager\.com/, (r) => r.abort());

let mode = "http"; // what the mocked Web3Forms does next
const sent = [];
await page.route("https://api.web3forms.com/**", (r) => {
  sent.push(r.request().postDataJSON());
  if (mode === "http") return r.fulfill({ status: 500, contentType: "application/json", body: '{"success":false}' });
  if (mode === "network") return r.abort();
  return r.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
});

// gtag.js is blocked, so the events stay in dataLayer exactly as app.js queued them
const events = async () => page.evaluate(() => (window.dataLayer || [])
  .map((a) => Array.prototype.slice.call(a)).filter((a) => a[0] === "event").map((a) => ({ name: a[1], ...a[2] })));
const of = (list, name) => list.filter((e) => e.name === name);

const NAME = "Тест Тестенко", SITE = "example.com", CONTACT = "вайбер 0671234567";
try {
  await page.goto(base + "/ua/");
  await page.locator("#consent button").first().click().catch(() => {}); // the banner must not cover the form
  const submit = page.locator("#audit form [type=submit]");

  // 1. empty form
  await submit.click();
  let ev = await events();
  assert.equal(of(ev, "form_submit_click").length, 1);
  assert.deepEqual(of(ev, "form_error").map((e) => `${e.field}:${e.error_type}`), ["name:required", "website:required", "contact:required"]);
  assert.equal(await page.locator("#f-contact-err").textContent(), "Залиште телефон, @нік у Telegram або email — так я зможу відповісти");

  // 2. contact too short
  await page.fill("#f-name", NAME);
  await page.fill("#f-website", SITE);
  await page.fill("#f-contact", "аб");
  await submit.click();
  ev = await events();
  assert.deepEqual(of(ev, "form_error").slice(3).map((e) => `${e.field}:${e.error_type}`), ["contact:too_short"]);
  assert.equal(sent.length, 0, "nothing is sent while a field is invalid");

  // 3. valid contact, Web3Forms answers 500
  await page.fill("#f-contact", CONTACT);
  await submit.click();
  await page.locator("#audit .form-error a").first().waitFor();
  ev = await events();
  assert.deepEqual(of(ev, "form_submit_error").map((e) => e.reason), ["http"]);
  assert.equal(of(ev, "form_error").length, 4, "no new field errors");

  // 4. network failure
  mode = "network";
  await submit.click();
  await page.waitForFunction(() => (window.dataLayer || []).filter((a) => a[1] === "form_submit_error").length === 2);
  ev = await events();
  assert.deepEqual(of(ev, "form_submit_error").map((e) => e.reason), ["http", "network"]);

  // 5. success
  mode = "ok";
  await submit.click();
  await page.locator("#audit .form-success.is-shown").waitFor();
  ev = await events();
  assert.equal(of(ev, "generate_lead").length, 1);
  assert.equal(of(ev, "form_submit_click").length, 5);
  assert.equal(sent[sent.length - 1].contact, CONTACT);

  // analytics never carries field values
  const dump = JSON.stringify(ev);
  for (const secret of [NAME, SITE, CONTACT, "0671234567"]) assert.ok(!dump.includes(secret), `event data contains «${secret}»`);
  for (const e of [...of(ev, "form_submit_click"), ...of(ev, "form_error"), ...of(ev, "form_submit_error")]) {
    assert.equal(e.form_type, "audit");
    assert.equal(e.page_language, "ua");
  }
  console.log("e2e ok:", ev.filter((e) => /^form_|generate_lead/.test(e.name)).map((e) => e.name + (e.field ? `(${e.field}:${e.error_type})` : e.reason ? `(${e.reason})` : "")).join(", "));
} finally {
  await browser.close();
  server.close();
}
