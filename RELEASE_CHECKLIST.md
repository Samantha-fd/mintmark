# Markly — Play Store release checklist

## 1. Before anything else

- [ ] **Back up signing keystore** — copy `credentials/` + `credentials.json` to Google Drive / password manager (losing them jeopardizes updates)
- [ ] **Check Play account testing requirement** — personal accounts created after 13 Nov 2023 must run a closed test with **12+ testers opted in for 14 consecutive days** before production access. Older/organization accounts are exempt. This decides the whole timeline.
- [ ] **Verify build on device** — permission gate on first launch, "Markly" gallery album, share chooser, wax-seal icon + themed variant, splash

## 2. Privacy policy

- [x] Privacy policy screen in the hamburger menu (`src/app/(drawer)/privacy.tsx`) — accurate: app makes no network calls at all
- [x] **Hosted at a public URL** (2026-07-10): `https://portfolio-website-xi-inky.vercel.app/markly/privacy` — paste this into Play Console. Source lives in the portfolio repo (`markly/privacy/index.html`); keep the URL alive. A dedicated Markly site can replace it later (the Play Console URL is editable anytime).

## 3. Store listing assets

- [ ] 2–8 phone screenshots — REAL app screenshots framed on brand-colour cards with short benefit captions (Duolingo style). Never AI-generated screens (previously rejected for this).
- [ ] 512×512 app icon (render from `brand/`)
- [ ] 1024×500 feature graphic
- [ ] Listing text: app name (30 chars), short description (80 chars), full description (4000 chars)

## 4. Play Console — one-time forms (App content section)

- [ ] **Data safety form** — declare *no data collected, no data shared* (required even when collecting nothing)
- [ ] **Privacy policy URL** — from step 2
- [ ] **Content rating questionnaire** (IARC) — should come out "Everyone"
- [ ] **Target audience** — pick 13+ or 18+; don't tick "appeals to children" (avoids the stricter Families policy)
- [ ] **App access** — declare "all functionality available without special access" (no login, so no test credentials needed)
- [ ] **Ads declaration** — no ads
- [ ] **Photo and Video Permissions declaration** — manifest includes `READ_MEDIA_IMAGES`; justify as core functionality (user picks photos to watermark, saves stamped photos to gallery). Google may ask for this form when the first build is uploaded.
- [ ] Government app / news app / financial features / health declarations — all "no"
- [ ] Category (Photography), public contact email, countries, free app
- [ ] Advertising ID: declare app does not use it (if Play flags an AD_ID permission mismatch from a library, add it to `android.blockedPermissions`)

## 5. Testing tracks → production

One AAB serves all tracks — upload once, then **promote the same release** between tracks. Only build again when code changes (versionCode auto-increments via `appVersionSource: "remote"`).

- [ ] Upload AAB to **Internal testing** (instant, up to 100 testers) — sanity check the installed build
- [ ] Promote to **Closed testing** — add testers by email list; if the 12-tester/14-day rule applies (see step 1), this runs for 2 weeks
- [ ] (Optional) Open testing — public opt-in link; skippable for a small app
- [ ] Apply for / promote to **Production**, submit for review

## Notes

- Account deletion page: **not required** — Play's rule only applies to apps with user account creation. Markly has no accounts/server.
- Package ID `com.markly.app` is permanent after first Play upload.
- First AAB upload enrolls the app in **Play App Signing** — Google holds the app signing key; the local keystore becomes the upload key. Still back it up.
- "Free" is permanent on Play — a free app can never become paid (in-app purchases would still be possible).
- Project now lives under `@samanthamasara1234/markly` (EAS projectId `e7ad425b-2ce0-458b-963c-21d309660daa`).
