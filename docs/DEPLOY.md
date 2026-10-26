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

## 4. Custom domain (fitsak.com)

Status: DNS is set (four A records for the apex and `CNAME www -> laftmix-maxfit.github.io`), the `CNAME` file contains `fitsak.com`, and the base URL in `site.json` is `https://fitsak.com`.

After the `claude/custom-domain` branch is merged into `main` («пуш»):

1. Repo -> Settings -> Pages -> Custom domain: enter `fitsak.com` -> Save (or `gh api -X PUT repos/laftmix-maxfit/fitsak-studio/pages -f cname=fitsak.com`). GitHub checks DNS and issues a certificate (can take up to an hour).
2. Tick *Enforce HTTPS* once it becomes available (or `gh api -X PUT repos/laftmix-maxfit/fitsak-studio/pages -F https_enforced=true`).
3. `www.fitsak.com` redirects to `fitsak.com` automatically when the apex is the custom domain.
4. Google Search Console: add the `fitsak.com` domain property and submit `https://fitsak.com/sitemap.xml`.
5. GA4: if you filter by hostname, add `fitsak.com`.

To change the domain later: edit `CNAME`, run `node scripts/set-base-url.mjs https://new-domain`, run `node scripts/lint.mjs`.