# ANI Mobile Agent Instructions

- Reply in Chinese unless technical literals are clearer in English.
- This is an independent Git repository under the ANI meta workspace. Commit
  mobile code changes here, not in the parent workspace repository.
- The app is Expo / React Native. Prefer existing stores, API helpers, theme
  tokens, and component patterns over new abstractions.
- Do not commit secrets, local build artifacts, `.expo/`, `dist/`, `web-build/`,
  `test-results/`, native build outputs, or generated release bundles.
- Expo's base TypeScript config enables `allowJs`; generated JS bundles can
  crash `tsc` with `RangeError: Maximum call stack size exceeded`. If typecheck
  fails that way, first confirm generated output is excluded rather than chasing
  app source blindly.
- After mobile changes, run focused checks when practical:
  `npx tsc --noEmit`, `npm test`, and for Android release safety
  `npx expo export --platform android --output-dir /tmp/ani-android-release-check`.
- For Android production APK startup issues, keep OTA checks best-effort after
  the root layout mounts; avoid reintroducing first-frame blocking native update
  checks.
- Mobile parity with Web should be selective: keep runtime chat, settings,
  onboarding, diagnostics, and forwarding workflows aligned; leave landing,
  dense admin, and long-form docs surfaces to Web/docs unless product explicitly
  asks for an in-app mobile surface.
