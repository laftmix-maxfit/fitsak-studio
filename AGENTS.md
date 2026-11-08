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
| GA ID, email, Telegram, Clarity ID, Fiverr URL, Web3Forms key | `js/config.js` (only place; the Web3Forms key is public by design) |
| Base URL for canonical/hreflang/OG/JSON-LD/sitemap/robots | `site.json`, applied with `node scripts/set-base-url.mjs <https-url>` |
| Rule check (forbidden APIs, `?v=`, canonical) | `node scripts/lint.mjs` |
| Deploy and domain steps | `docs/DEPLOY.md` |
| Custom domain | `CNAME` file (`fitsak.com`); change it together with `site.json` |

## Analytics

GA4 (`gtag.js`) loads only when `GA_MEASUREMENT_ID` is a real ID (not `G-XXXXXXXXXX`) **and** the visitor has accepted; no gtag snippet in HTML, no events are queued before consent. Consent Mode v2: all storage `denied` by default (`url_passthrough` on); after Accept `analytics_storage`, `ad_storage` and `ad_user_data` become `granted`, `ad_personalization` always stays `denied`; Reject after load sets them back to `denied`. Choice is stored in `localStorage` key `fs_consent`. `?internal=1` stores `fs_internal=1`; while it is set, `traffic_type: "internal"` is added to the GA config and to **every** event; `?internal=0` clears it. `?debug=1` stores `fs_debug=1` in sessionStorage and adds `debug_mode: true` to the GA config (DebugView). First-touch `utm_*` and `gclid` from the URL are kept in sessionStorage (`fs_utm_*`, `fs_gclid`, never overwritten) and sent with the audit form. Microsoft Clarity loads only if `CLARITY_ID` is set **and** consent is granted.

Every event is sent only if `typeof gtag === "function"`, inside try/catch, with no personal data, and always carries `page_language` (`en` or `ua`).

| Event | Parameters | Fires when |
| --- | --- | --- |
| `cta_click` | `cta_location` (`header_audit`, `hero_audit`, `hero_case`, `hero_proof`, `sticky_audit`), `page_language` | Click on an element with `data-cta` |
| `case_view` | `page_language` | Case section (`#case`) at least 50% visible, or filling half the screen. Once per page view |
| `service_click` | `service_name` (`audit`, `analytics`, `repair`, `landing`, `ads`; same as `data-package` and the form select), `page_language` | Click on a service card button |
| `contact_click` | `channel` (`fiverr`, `email`, `telegram`, `email_copy`), `page_language` | Click on a contact button; `email_copy` after a successful copy |
| `scroll_depth` | `percent` (25, 50, 75), `page_language` | Page scrolled to that depth, once each |
| `section_view` | `section_name` (`hero`, `problem`, `case`, `services`, `examples`, `how`, `about`, `audit`, `contact`), `page_language` | Section visible as for `case_view`, once each (`examples` = "Tracking examples" block, `audit` = audit request form) |
| `audit_form_start` | `form_package` (`audit`, `analytics`, `repair`, `landing`, `ads`), `page_language` | First real interaction (focus or typing) in the audit form. Once per page view; programmatic focus from a package button does not count |
| `generate_lead` | `form_package`, `lead_id` (`L` + time + 4 chars, also in the lead email), `lead_source` (`utm_source` or `direct`), `page_language` | Audit form accepted by Web3Forms. Never carries name, website, contact or message |
| `language_switch` | `to_language` (`en`, `ua`), `page_language` (language being left) | Click on a language link |
| `outbound_click` | `link_domain`, `page_language` | Click on an http(s) link to another host (domain only, never the full URL) |

Package buttons (`data-package`, e.g. service cards) pick the package in the form and scroll to `#audit`; `?package=X` in an external link does the same once on load. Sent leads go through Web3Forms (`WEB3FORMS_KEY`); no personal data is stored in the repo.

When adding an event, add a row here in the same change.
