# Theme Park Logbook

Theme Park Logbook is an installable, offline-ready web app for recording park visits, individual ride logs, seat coverage and lifetime statistics. Supabase provides private cross-device sync, while Vercel hosts the app.

Live app: [theme-park-logbook.vercel.app](https://theme-park-logbook.vercel.app/)

## Install the free mobile app

No app store or paid developer account is needed for this release.

### iPhone and iPad

1. Open the live app in Safari.
2. Tap Share.
3. Choose **Add to Home Screen**.
4. Tap **Add**.

### Android

1. Open the live app in Chrome.
2. Tap **Install app** when offered, or open the browser menu.
3. Choose **Install app** or **Add to Home screen**.

The installed PWA opens full-screen from its own icon. The application shell and locally stored logbook remain available offline; cloud changes sync when Supabase and an internet connection are available.

## Development

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and provide the Supabase project URL and publishable key to enable cloud sync.

Before publishing a release:

```bash
npm run release:check
```

This runs the utility tests, linting, TypeScript compilation and the production PWA build. Vercel deploys updates from the connected GitHub repository.

## Release approach

Version 1.0 uses the existing Vercel deployment as the canonical mobile release. Its web app manifest, maskable icons, Apple touch icon, standalone display mode and generated service worker make it installable without maintaining separate iOS and Android projects.

If store distribution becomes worthwhile later, the same web app can be evaluated for a thin native wrapper. That is intentionally deferred so the PWA can be tested with real park visits before taking on store accounts, review processes and platform-specific maintenance.
