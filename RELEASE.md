# Release checklist

Use this checklist for the initial Obsidian Community release.

## Community listing

Mermaid Fixer is intended to be listed as **Free**:

- No paid features.
- No license checks or subscriptions.
- No developer-operated service.
- No donations or funding link.
- No third-party paid API integrations.

Suggested listing metadata:

```json
{
  "id": "mermaid-fixer",
  "name": "Mermaid Fixer",
  "author": "By Bondie Labs",
  "description": "Repair Mermaid diagrams and Markdown tables in your notes.",
  "repo": "fyaic/Mermaid-Fixer-Plugin"
}
```

## Required repository files

- `README.md`
- `LICENSE`
- `PRIVACY.md`
- `manifest.json`
- `versions.json`
- `styles.css`

Do not commit `main.js` to the repository. Obsidian downloads the bundled file from the GitHub release assets.

## Required GitHub release assets

For each release, upload these binary attachments:

- `main.js`
- `manifest.json`
- `styles.css`

The GitHub release tag must match `manifest.json` version exactly. The current release tag is `1.1.3`.

Automated releases should generate GitHub artifact attestations for all release assets so users can verify that the downloaded files were built from this repository.

## Pre-release verification

```bash
npm ci
npm test
npm run lint
npm run build
node --check main.js
```

After the GitHub Actions release workflow finishes, verify artifact attestations for the release assets:

```bash
gh attestation verify main.js -R fyaic/Mermaid-Fixer-Plugin
gh attestation verify manifest.json -R fyaic/Mermaid-Fixer-Plugin
gh attestation verify styles.css -R fyaic/Mermaid-Fixer-Plugin
```

Also run a manual Obsidian smoke test in a fresh vault:

- Install the plugin folder.
- Enable the plugin.
- Open the settings tab.
- Confirm both commands appear in the command palette.
- Run `Fix current file` on a note with a broken Mermaid block.
- Run `Fix current file` on a note with a broken Markdown table.
- Run `Fix whole vault` on a small test vault containing Mermaid-only and table-only issues.
- Confirm the whole-vault scan progress modal appears before the result summary.
- Confirm the no-issue state says `All Mermaid and table are good.`
- Confirm diff preview and cancel/apply flows work.

## Submission

1. Push the source to a public GitHub repository.
2. Commit the accurate `manifest.json` to the default branch.
3. Create a GitHub release whose tag matches the manifest version.
4. Upload `main.js`, `manifest.json`, and `styles.css` to the release.
5. Sign in at `community.obsidian.md`.
6. Link the GitHub account.
7. Submit the plugin URL from the Community dashboard.
