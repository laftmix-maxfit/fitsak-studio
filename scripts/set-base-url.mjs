// Usage: node scripts/set-base-url.mjs https://fitsak.com
// site.json holds the one base URL. This script rewrites it in every HTML file
// (canonical, hreflang, og:*, JSON-LD) and regenerates sitemap.xml and robots.txt.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteFile = join(root, "site.json");
const site = JSON.parse(readFileSync(siteFile, "utf8"));
const oldBase = site.baseUrl.replace(/\/+$/, "");
const arg = process.argv[2];
const newBase = (arg || oldBase).replace(/\/+$/, "");

if (!/^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(newBase)) {
  console.error("Base URL must start with https:// and have no spaces");
  process.exit(1);
}

const pages = [
  { file: "index.html", path: "/", alt: "/ua/" },
  { file: "ua/index.html", path: "/ua/", alt: "/" },
  { file: "privacy/index.html", path: "/privacy/", alt: "/ua/privacy/" },
  { file: "ua/privacy/index.html", path: "/ua/privacy/", alt: "/privacy/" }
];

for (const p of pages) {
  const f = join(root, p.file);
  const html = readFileSync(f, "utf8").split(oldBase).join(newBase);
  writeFileSync(f, html);
}

const lastmod = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: "/", en: "/", uk: "/ua/" },
  { loc: "/ua/", en: "/", uk: "/ua/" },
  { loc: "/privacy/", en: "/privacy/", uk: "/ua/privacy/" },
  { loc: "/ua/privacy/", en: "/privacy/", uk: "/ua/privacy/" }
];
const entry = (u) => `  <url>
    <loc>${newBase}${u.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${newBase}${u.en}"/>
    <xhtml:link rel="alternate" hreflang="uk" href="${newBase}${u.uk}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${newBase}${u.en}"/>
  </url>`;
writeFileSync(join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(entry).join("\n")}
</urlset>
`);
writeFileSync(join(root, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${newBase}/sitemap.xml\n`);

site.baseUrl = newBase;
writeFileSync(siteFile, JSON.stringify(site, null, 2) + "\n");
console.log(`Base URL: ${oldBase} -> ${newBase}`);
