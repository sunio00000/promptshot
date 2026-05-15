# Promptshot Release Guide

Manual steps to publish a new version of Promptshot to the VS Code Marketplace.

> **Status**: First-time setup needed for v0.1.0 (no publisher yet).

## Pre-release Checklist

Before publishing, verify all of these:

- [ ] `pnpm -r build` succeeds on all 3 OS (Windows checked locally; macOS/Linux via GitHub Actions `.github/workflows/ci.yml`)
- [ ] `pnpm -r test` passes — core unit tests (29) + vscode-ext integration tests (2)
- [ ] `pnpm samples` regenerates `docs/samples/*.png` without errors
- [ ] All 5 commands work in Extension Development Host (F5 in `packages/vscode-ext`)
- [ ] Image clipboard works — paste into Paint/Slack
- [ ] Markdown clipboard works — paste into a text editor
- [ ] Korean text renders correctly (no tofu)
- [ ] `mac-light` and `mac-dark` themes both produce sensible output
- [ ] `CHANGELOG.md` has an entry for this version
- [ ] `packages/vscode-ext/icon.png` is final (or accepted as placeholder)
- [ ] `packages/vscode-ext/README.md` is up to date (Marketplace listing)
- [ ] `LICENSE` exists at workspace root
- [ ] `packages/vscode-ext/package.json` has `version` bumped and `publisher` set
- [ ] Git working tree clean

## Step 1 — Publisher Setup (first time only)

1. Visit https://dev.azure.com and create a Personal Access Token with **Marketplace > Manage** scope:
   - Organization: All accessible
   - Scopes: Custom defined → Marketplace → Manage
   - Expiration: 90 days minimum
   - **Save the token** — it cannot be viewed again
2. Decide on a publisher name. Suggestions:
   - `sunio`, `bluehole-sunio`, or a Marketplace-unique identifier
3. Register the publisher (in browser): https://marketplace.visualstudio.com/manage
4. Update `packages/vscode-ext/package.json`:
   - Change `"publisher": "TBD-set-before-publish"` to your real publisher ID
5. Log in via `vsce`:
   ```bash
   pnpm -C packages/vscode-ext exec vsce login <publisher-name>
   ```
   Paste the PAT when prompted.
6. Commit the publisher change:
   ```bash
   git add packages/vscode-ext/package.json
   git commit -m "chore(vscode-ext): set publisher ID"
   ```

## Step 2 — Build & Local Test

```bash
pnpm install --frozen-lockfile
pnpm -r build
pnpm -r test
pnpm -C packages/vscode-ext package
```

This produces `packages/vscode-ext/promptshot-<version>.vsix`. Verify it installs locally:
- In VS Code: Extensions → ⋯ → "Install from VSIX…" → select the file
- Test all 5 commands once more

## Step 3 — Version Bump & Tag

```bash
# Edit packages/vscode-ext/package.json: bump "version" to 0.1.0
# Edit CHANGELOG.md: change "[0.1.0] — Unreleased" to "[0.1.0] — YYYY-MM-DD"
git add packages/vscode-ext/package.json CHANGELOG.md
git commit -m "release: 0.1.0"
git tag v0.1.0
```

## Step 4 — Publish

```bash
pnpm -C packages/vscode-ext exec vsce publish
```

Verify on `https://marketplace.visualstudio.com/items?itemName=<publisher>.promptshot`:
- README renders correctly
- icon shows
- categories/keywords are correct
- Install button works

Push the tag:
```bash
git push --tags
git push
```

## Step 5 — Post-Release Documentation

Add ADR #N to `docs/DECISIONS.md`:
```
## #N — Initial release v0.1.0

- **Date**: YYYY-MM-DD
- **Status**: Active

### Context
First public release.

### Decision
Published to Marketplace as <publisher>.promptshot @ v0.1.0.

### Consequences
- Public discovery via Marketplace
- Subsequent releases follow this same checklist
- Known limitations (placeholder icon, missing Cursor support, etc.) tracked in CHANGELOG
```
