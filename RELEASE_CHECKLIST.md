# Markly — Play Store release checklist

- [ ] **Verify preview APK on device** — permission gate on first launch, "Markly" gallery album, share chooser, wax-seal icon + themed variant, splash
- [ ] **Back up signing keystore** — copy `credentials/` + `credentials.json` to Google Drive / password manager (losing them jeopardizes updates)
- [ ] **Privacy policy screen in the hamburger menu**
- [ ] **Host privacy policy at a public URL** — required by Play Console (GitHub Pages needs a public repo, or use the portfolio site)
- [ ] **Store listing assets** — real screenshots on brand-colour cards with captions (no AI-generated screens), 512×512 icon, 1024×500 feature graphic
- [ ] **Play Console setup** — listing text, Data Safety form (declare *no data collected*; no accounts → no account-deletion page required), content rating, target audience, policy URL
- [ ] **Production build + submit** — `npx eas-cli build --platform android --profile production`, enable Play App Signing, submit for review

Notes:
- Account deletion page: **not required** — Play's rule only applies to apps with user account creation. Markly has no accounts/server.
- Package ID `com.markly.app` is permanent after first Play upload.
