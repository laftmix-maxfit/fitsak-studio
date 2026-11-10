# AGENTS.md — Fitsak Studio

Static site: HTML + CSS + vanilla JS, no build step. Hosted on GitHub Pages from `main`.
English is the root (`/`), Ukrainian is `/ua/`. Both must stay identical in content and structure. Pages: `/`, `/ua/`, `/sites/` and `/ua/sites/` (turnkey websites landing; its consultation form lives in the native `<dialog id="consult-dialog">`, with the no-JS fallback section `#contact-fallback`), `/privacy/`, `/ua/privacy/`.

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
| GA ID, email, Telegram, Clarity ID, Fiverr URL, Web3Forms key | `js/config.js` (the Web3Forms key is public by design). The Web3Forms key is also in the hidden fields of the 4 forms (`index.html`, `ua/index.html`, `sites/index.html`, `ua/sites/index.html`): change it in all five places together |
| Base URL for canonical/hreflang/OG/JSON-LD/sitemap/robots | `site.json`, applied with `node scripts/set-base-url.mjs <https-url>` |
| Rule check (forbidden APIs, `?v=`, canonical) | `node scripts/lint.mjs` |
| New page = add it to the `pages` and `urls` lists in `scripts/set-base-url.mjs` (base URL rewrite + sitemap) | `scripts/set-base-url.mjs` |
| Deploy and domain steps | `docs/DEPLOY.md` |
| Custom domain | `CNAME` file (`fitsak.com`); change it together with `site.json` |

## Analytics

GA4 (`gtag.js`) loads only when `GA_MEASUREMENT_ID` is a real ID (not `G-XXXXXXXXXX`) **and** the visitor has accepted; no gtag snippet in HTML, no events are queued before consent. Consent Mode v2: all storage `denied` by default (`url_passthrough` on); after Accept `analytics_storage`, `ad_storage` and `ad_user_data` become `granted`, `ad_personalization` always stays `denied`; Reject after load sets them back to `denied`. Choice is stored in `localStorage` key `fs_consent`. `?internal=1` stores `fs_internal=1`; while it is set, `traffic_type: "internal"` is added to the GA config and to **every** event; `?internal=0` clears it. `?debug=1` stores `fs_debug=1` in sessionStorage and adds `debug_mode: true` to the GA config (DebugView). First-touch `utm_*` and `gclid` from the URL are kept in sessionStorage (`fs_utm_*`, `fs_gclid`, never overwritten) and sent with the audit form. Microsoft Clarity loads only if `CLARITY_ID` is set **and** consent is granted.

Every event is sent only if `typeof gtag === "function"`, inside try/catch, with no personal data, and always carries `page_language` (`en` or `ua`).

| Event | Parameters | Fires when |
| --- | --- | --- |
| `cta_click` | `cta_location` (main pages: `header_audit`, `header_sites`, `hero_audit`, `hero_case`, `hero_proof`, `sticky_audit`; /sites/: `header_consult`, `sites_hero`, `sites_pricing_landing`, `sites_pricing_site`, `sites_pricing_support`, `sites_case`, `sticky_consult`), `page_language` | Click on an element with `data-cta` |
| `case_view` | `page_language` | Case section (`#case`) at least 50% visible, or filling half the screen. Once per page view |
| `service_click` | `service_name` (`audit`, `deep_audit`, `analytics`, `repair`, `landing`, `ads`; same as `data-package` and the form select), `page_language` | Click on a service card button |
| `contact_click` | `channel` (`fiverr`, `email`, `telegram`, `email_copy`), `page_language` | Click on a contact button; `email_copy` after a successful copy |
| `scroll_depth` | `percent` (25, 50, 75), `page_language` | Page scrolled to that depth, once each |
| `section_view` | `section_name` (`hero`, `problem`, `case`, `services`, `examples`, `how`, `about`, `audit`, `contact`), `page_language` | Section visible as for `case_view`, once each (`examples` = "Tracking examples" block, `audit` = audit request form; /sites/ adds `included`, `pricing`, `faq`; its `contact` section is `#contact-fallback`) |
| `audit_form_start` | `form_package` (`audit`, `deep_audit`, `analytics`, `repair`, `landing`, `ads`, `site`, `support`, `consult`), `form_type` (`audit` or `consult`), `page_language` | First real interaction (focus or typing) in the audit or consultation form. The only form-start event: GA4 Enhanced measurement also sends its own `form_start`; keep "Form interactions" off in GA4. Once per page view; programmatic focus from a package button does not count |
| `consult_open` | `cta_location` (the opener's `data-cta`), `form_package` (the package preselected by the opener), `page_language` | The consultation dialog is opened by a `data-open-consult` button on /sites/. No personal data |
| `generate_lead` | `form_package`, `form_type` (`audit` or `consult`), `lead_id` (`L` + time + 4 chars, also in the lead email), `lead_source` (`utm_source` or `direct`), `page_language` | Audit or consultation form accepted by Web3Forms. Never carries name, website, contact, business or message |
| `language_switch` | `to_language` (`en`, `ua`), `page_language` (language being left) | Click on a language link |
| `outbound_click` | `link_domain`, `page_language` | Click on an http(s) link to another host (domain only, never the full URL) |

Package buttons (`data-package` with an `href="#id"`) pick the package in the form of the current page (`#audit`) and scroll to it. Buttons with `data-open-consult` (+ `data-package`, `href="#contact-fallback"`) open the consultation dialog instead: package preselected, focus on the name field, page scroll locked (`body.is-dialog-open`, sticky button hidden); closing (×, Esc, backdrop) returns focus to the opener and keeps typed data; after a sent request the form is reset on the next open. The main-page "Landing page + analytics" card links to `sites/` instead and only sends `service_click`. `?package=X` in an external link preselects the package once on load and scrolls to the form, only for forms placed on the page (not for the dialog). Package values are the same in every form: `audit`, `deep_audit`, `analytics`, `repair`, `landing`, `ads`, `site`, `support`, `consult`. Any `form[data-form-type]` is handled by the same code in `app.js` (`data-subject` = mail subject prefix; the consultation form also sends `preferred` and `business`). Sent leads go through Web3Forms (`WEB3FORMS_KEY`); no personal data is stored in the repo.

### Forms without JavaScript

Every `<form>` has `method="post"`, `action="https://api.web3forms.com/submit"`, `accept-charset="UTF-8"` and static hidden fields `access_key`, `subject` (ends with `(no-JS)`), `from_name`, `redirect` (`<base>/<this page>/?sent=1`), so a submit before or without `app.js` is delivered natively instead of going to the URL as a GET. `app.js` still calls `preventDefault()` and sends its own explicit JSON payload (hidden inputs are not read or validated). On `?sent=1` it hides the form, shows the success text without a request number (the consultation dialog opens with it) and removes `sent` from the URL; no `generate_lead` is sent for it. Checked on 2026-11-10: with the current Web3Forms plan the `redirect` field was ignored (the visitor lands on Web3Forms' own success page, `https://api.web3forms.com/submit/success`), so `?sent=1` only appears if that changes; the lead is still delivered and the URL carries no data. At the very start, before GA is initialised, `app.js` removes the whole query if it contains `name`, `contact`, `website`, `message` or `business`, so personal data never reaches `page_location`. Each form has a `<noscript>` note with the Telegram handle. On /sites/ and /ua/sites/ the consultation form lives in a `<dialog>` that cannot be opened without JS, so `#contact-fallback` also contains a second copy of it inside `<noscript>` (ids prefixed `n-`, same hidden fields, `required` for native validation); the page buttons jump there without JS. The Telegram button in `#contact-fallback` has a static `https://t.me/studiofits` href (JS sets the same value from `js/config.js`): if the handle changes, change it in `js/config.js`, the fallback link and the `<noscript>` notes of the pages together. Email controls carry `.js-only` and are hidden without JS (`<noscript><style>` in the head).

When adding an event, add a row here in the same change.
