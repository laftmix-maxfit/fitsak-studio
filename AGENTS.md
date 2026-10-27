# AGENTS.md — Fitsak Studio

Static site: HTML + CSS + vanilla JS, no build step. Hosted on GitHub Pages from `main`.
English is the root (`/`), Ukrainian is `/ua/`. Both must stay identical in content and structure.

## Rules

1. One task = one branch. Never work directly on `main`.
2. "Push" (або «пуш») only on the owner's explicit command. It means: merge the working branch into `main` and push `main`. Nothing else goes to `main`.
3. Cache busting: every CSS/JS reference has `?v=N`. Bump `N` in all pages when that file changes.
4. No `innerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`. Build DOM with `createElement` and `textContent`.
5. No secrets, tokens or personal data in the repo. `js/config.js` holds only public IDs and placeholders.
6. Mobile at 360–400 px is mandatory: one column, no horizontal scroll, contact button within reach.
7. Do not change `<title>`, meta tags, canonical, hreflang or sitemap unless the task is about SEO.
8. Honest report at the end of every task: what was verified, what was not, and the steps for the owner.

## Places to know

| What | Where |
| --- | --- |
| GA ID, email, Telegram, Clarity ID, Fiverr URL | `js/config.js` (only place) |
| Base URL for canonical/hreflang/OG/JSON-LD/sitemap/robots | `site.json`, applied with `node scripts/set-base-url.mjs <https-url>` |
| Rule check (forbidden APIs, `?v=`, canonical) | `node scripts/lint.mjs` |
| Deploy and domain steps | `docs/DEPLOY.md` |
| Custom domain | `CNAME` file (`fitsak.com`); change it together with `site.json` |

## Analytics

GA4 (`gtag.js`) loads only when `GA_MEASUREMENT_ID` is a real ID (not `G-XXXXXXXXXX`) **and** the visitor has accepted; no gtag snippet in HTML, no events are queued before consent. Consent Mode v2: all storage `denied` by default; only `analytics_storage` can become `granted` after Accept. Choice is stored in `localStorage` key `fs_consent`. `?internal=1` stores `fs_internal=1` and adds `traffic_type: "internal"` to the GA config; `?internal=0` clears it. Microsoft Clarity loads only if `CLARITY_ID` is set **and** consent is granted.

Every event is sent only if `typeof gtag === "function"`, inside try/catch, with no personal data, and always carries `page_language` (`en` or `ua`).

| Event | Parameters | Fires when |
| --- | --- | --- |
| `cta_click` | `cta_location` (`header_contact`, `hero_case`, `hero_contact`, `hero_proof`, `sticky_contact`), `page_language` | Click on an element with `data-cta` |
| `case_view` | `page_language` | Case section (`#case`) at least 50% visible, or filling half the screen. Once per page view |
| `service_click` | `service_name` (`ga4_lead_tracking`, `google_ads_audit`, `fast_landing_page`), `page_language` | Click on a service card button |
| `contact_click` | `channel` (`fiverr`, `email`, `telegram`, `email_copy`), `page_language` | Click on a contact button; `email_copy` after a successful copy |
| `scroll_depth` | `percent` (25, 50, 75), `page_language` | Page scrolled to that depth, once each |
| `section_view` | `section_name` (`hero`, `problem`, `case`, `services`, `examples`, `how`, `about`, `contact`), `page_language` | Section visible as for `case_view`, once each (`examples` = "Tracking examples" block) |
| `language_switch` | `to_language` (`en`, `ua`), `page_language` (language being left) | Click on a language link |
| `outbound_click` | `link_domain`, `page_language` | Click on an http(s) link to another host (domain only, never the full URL) |

When adding an event, add a row here in the same change.
