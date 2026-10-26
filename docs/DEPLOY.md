# Deploy and domain

## 1. GitHub login and repository (once)

```bash
gh auth login
gh repo create laftmix-maxfit/fitsak-studio --public --source . --remote origin
git push -u origin claude/initial-site
```

If the repository already exists, skip `gh repo create` and run `git remote add origin https://github.com/laftmix-maxfit/fitsak-studio.git`.

## 2. GitHub Pages (after you say «пуш»)

«Пуш» = merge `claude/initial-site` into `main` and push `main`. Then enable Pages from `main`:

```bash
gh api -X POST repos/laftmix-maxfit/fitsak-studio/pages -f "source[branch]=main" -f "source[path]=/"
```

Or in the browser: repo → Settings → Pages → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → Save. The site appears at `https://laftmix-maxfit.github.io/fitsak-studio/` within a few minutes.

All asset paths are relative, so the site works both under `/fitsak-studio/` and on a custom domain at the root.

## 3. Fill in the placeholders

Edit only `js/config.js`: `GA_MEASUREMENT_ID`, `CONTACT_EMAIL`, `CONTACT_TELEGRAM` (no `@`), `CLARITY_ID` (optional). Bump `?v=` for `config.js` in all four HTML pages so browsers fetch the new file.

## 4. Custom domain (fitsak.com or fitsakstudio.com)

1. Buy the domain. Decide on the main host: `fitsak.com` (apex) or `www.fitsak.com`.
2. DNS at your registrar, for an **apex** domain, four `A` records and (optional) four `AAAA`:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |
   | CNAME | www | laftmix-maxfit.github.io |

   Check the current addresses in the GitHub docs ("Managing a custom domain for your GitHub Pages site") before adding them.
3. Tell me the domain. I will, in a separate SEO branch: create the `CNAME` file, run `node scripts/set-base-url.mjs https://fitsak.com` (updates canonical, hreflang, OG, JSON-LD, sitemap and robots), and bump `?v=`.
4. After merge: repo → Settings → Pages → Custom domain → enter the domain → Save → tick *Enforce HTTPS* once the certificate is issued (can take up to an hour).
5. In Google Search Console, add the domain property and submit `sitemap.xml`.
6. In GA4, add the new domain if you filter by hostname.
