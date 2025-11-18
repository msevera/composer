# Snail (Chrome extension)

Vite + React + Tailwind popup that talks to the Smail GraphQL API. It checks whether the user already has a Better-Auth session (`me` query). If yes, the popup shows a “quick note” composer (textarea + send button). If not, it renders a compact sign-in form.

## Development

```bash
cd extension
npm install
npm run dev
```

The dev server runs at http://localhost:5173. The popup layout is fixed to 360×480px to match Chrome’s default extension window.

### Environment

```
VITE_API_URL=http://localhost:4000/graphql
VITE_AUTH_URL=http://localhost:4000/api/auth
```

Create `.env.local` (or export the variable) when your API isn’t running on the default URL.

## Building & loading the extension

```bash
npm run build
```

The production bundle is emitted into `extension/dist`. Load it into Chrome:

1. Open `chrome://extensions`
2. Enable “Developer mode”
3. Click **Load unpacked**
4. Select `~/Projects/smail/extension/dist`

`public/manifest.json` and the icon set are copied automatically during the build.

### Gmail overlay

- `public/gmail-content.js` is injected on `https://mail.google.com/*`. It mounts a quick-note bar that floats at the bottom center of the screen whenever the extension detects an authenticated session.
- Authentication state is synced via `chrome.storage.local.snailAuthenticated`, which the popup updates every time Better Auth reports a session.
- To trust your unpacked extension, add its Chrome origin to the API env:  
  `CHROME_EXTENSION_ORIGINS=chrome-extension://<your-extension-id>`

## What ships in this bundle

- Vite build with `base: './'` so the popup works when served from `chrome-extension://`
- Tailwind-powered UI with cards for “session info” and “sign in”
- Apollo Client configured with cookies (`credentials: 'include'`) so it reuses the Better-Auth session cookie from the Smail API
- GraphQL operations:
  - `GetCurrentUser` → decides whether to show the note composer or the sign-in form
  - `SendQuickNote` → lightweight mutation that hits the API (currently logs on the backend)
- Better Auth client (`better-auth/react`) for email/password auth plus session management shared with Gmail pages

Feel free to expand the popup with additional mutations/queries or add background scripts/service workers as needed. The CSP in `public/manifest.json` is intentionally strict (`script-src 'self'`) because Vite’s build produces separate JS files without inline code. If you later add inline scripts, you’ll need to supply hashes or adopt a non-inline approach.
