# Agent notes

## Project

Mermaid Fixer is a free, local-only Obsidian plugin that fixes common Mermaid syntax errors in Markdown notes.

## Commands

```bash
npm install
npm test
npm run lint
npm run build
node --check main.js
```

## Release constraints

- Keep `manifest.json`, `package.json`, and `versions.json` versions aligned.
- The GitHub release tag must exactly match `manifest.json` version.
- Release assets must include `main.js`, `manifest.json`, and `styles.css`.
- Do not add `fundingUrl` unless the maintainers actually accept donations.
- Keep the Community listing payment status as Free unless paid features, paid services, donations, or third-party paid API integrations are added.
- Do not add network requests, telemetry, or external services without updating `README.md`, `PRIVACY.md`, and release metadata.

## Code constraints

- Runtime code should not use third-party libraries beyond Obsidian.
- Use the Editor API for active-file edits.
- Use `app.vault.process()` for background note writes.
- Avoid Node.js and Electron APIs unless `isDesktopOnly` is changed to `true`.
- Use Obsidian settings APIs for plugin data.
- Keep UI text in sentence case.
