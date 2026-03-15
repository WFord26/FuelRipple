# FuelRipple — Release Standard Operating Procedure

This SOP describes the end-to-end process for releasing changes to FuelRipple. Every
change — no matter how small — must follow this workflow before reaching production.

---

## Overview

```
[Unreleased work]
      │
      ▼
1. Update CHANGELOG.md
      │
      ▼
2. Bump to beta version  (npm run version:beta:patch / minor / major)
      │
      ▼
3. Push feature branch → deploy to beta environment
      │
      ▼
4. Test on beta
      │
      ▼
5. Open Pull Request against `main`
      │
      ▼
6. PR review & approval
      │
      ▼
7. Promote to release version  (npm run version:release)
      │
      ▼
8. Merge PR into `main`
      │
      ▼
9. CI: test → build → deploy to production
```

---

## Step 1 — Update CHANGELOG.md

Before touching any version numbers, document what changed.

1. Open `CHANGELOG.md`.
2. Under `## [Unreleased]`, fill in the relevant sub-sections:
   - `### Added` — new features
   - `### Changed` — changes to existing behavior
   - `### Fixed` — bug fixes
3. Be specific. Link to issues or PRs where relevant.
4. **Do not move entries out of `[Unreleased]` yet** — that happens at release time.
5. Commit the changelog update on its own, or include it with the first beta bump commit:
   ```bash
   git add CHANGELOG.md
   git commit -m "docs: update changelog for upcoming release"
   ```

---

## Step 2 — Bump to Beta Version

Choose the bump type that matches the scope of work:

| Work describes… | Command |
|---|---|
| Bug fix, chore, small improvement | `npm run version:beta:patch` |
| New feature (backwards-compatible) | `npm run version:beta:minor` |
| Breaking change | `npm run version:beta:major` |
| Only the API changed | `npm run version:beta:patch:api` |
| Only the web changed | `npm run version:beta:patch:web` |

**What this does:**
- Increments the version in `apps/api/package.json`, `apps/web/package.json`, and the
  root `package.json` (e.g., `1.0.0 → 1.0.1-beta.0`).
- Stages the changed files and creates a commit: `chore: bump version to 1.0.1-beta.0 (beta)`.

**Subsequent beta iterations** (if more fixes land after the first beta):

Running the same command again increments the beta counter:
`1.0.1-beta.0 → 1.0.1-beta.1 → …`

---

## Step 3 — Push Feature Branch & Deploy to Beta

```bash
# Push the current branch (must not be main)
git push origin HEAD
```

The branch name should follow the pattern: `feature/<topic>`, `fix/<topic>`, or
`chore/<topic>`.

Deploy to the **beta** App Service slot (or environment) from the CI pipeline or
manually via Azure CLI:

```bash
# Example: swap the staging slot if using Azure slot-based deployments
az webapp deployment slot swap \
  --resource-group rg-fuelripple-dev \
  --name app-api-fuelripple-<alias>-dev \
  --slot staging \
  --target-slot production
```

Confirm the deployed version matches the beta version number by checking
`GET /api/v1/health` (which returns the current `version` from `package.json`).

---

## Step 4 — Test on Beta

Run through the following checks on the beta environment before proceeding.

### Automated checks
```bash
# Run the full test suite locally against the beta environment
npm run test
```

### Manual smoke tests
| Area | Check |
|---|---|
| Prices | `/api/v1/prices` returns current weekly gas price data |
| Disruption | CDI endpoint responds with valid score and breakdown |
| Supply | Supply/inventory endpoints return data without 5xx errors |
| LLM | `/api/v1/llm` returns a narrative response |
| Web UI | All pages load without console errors or broken layouts |
| Charts | Price trend charts render correctly with live data |

If a defect is found:
1. Fix it on the same branch.
2. Run `npm run version:beta:patch` again to increment the beta counter.
3. Push and re-test.

Do **not** open a PR until the beta environment passes all checks.

---

## Step 5 — Open a Pull Request

1. Go to GitHub and open a PR from your feature branch **targeting `main`**.
2. Use this PR title format: `<type>: <short description> (v<version>)`
   - Example: `feat: add supply correlation chart (v1.1.0-beta.0)`
3. In the PR description, include:
   - **What changed** — a summary of the changes
   - **How to test** — steps for the reviewer to verify
   - **Changelog reference** — paste or link the relevant `CHANGELOG.md` section
   - **Beta URL** — direct link to the beta environment for live review

> **Rule:** Do not merge your own PR. A second set of eyes is required.

---

## Step 6 — PR Review & Approval

The reviewer must:

- [ ] Pull the branch locally and run `npm run test`
- [ ] Verify the beta environment (Step 4 checks above)
- [ ] Review code for adherence to the patterns in `.github/copilot-instructions.md`:
  - Shared types from `@fuelripple/shared`
  - Two-tier cache used in routes
  - `getKnex()` used for DB access (no raw `knex()`)
  - No auth middleware added
  - New web pages are lazy-loaded with `<ErrorBoundary>`
- [ ] Confirm `CHANGELOG.md` `[Unreleased]` section is filled in
- [ ] Approve the PR or request changes

Resolve all review comments before proceeding to Step 7.

---

## Step 7 — Promote to Release Version

Before merging, strip the beta suffix to produce the final stable version.

```bash
# On your feature branch, with all review comments resolved:
npm run version:release
```

This converts `1.0.1-beta.N → 1.0.1` in all three `package.json` files and commits:
`chore: release v1.0.1`.

Also move the `CHANGELOG.md` `[Unreleased]` entries to a dated release section:

```markdown
## [1.0.1] - YYYY-MM-DD

### Added
...
```

Commit the changelog update:
```bash
git add CHANGELOG.md
git commit -m "docs: finalize changelog for v1.0.1"
git push origin HEAD
```

---

## Step 8 — Merge PR into `main`

1. Ensure all CI checks are green on the PR.
2. Use **Squash and Merge** (preferred) or **Merge Commit** — never Rebase and Merge.
3. Delete the feature branch after merging.

---

## Step 9 — CI: Test → Build → Deploy to Production

Merging to `main` triggers the CI pipeline automatically:

| Stage | Description |
|---|---|
| **Test** | `npm run test` across all workspaces |
| **Build** | `npm run build` (Turbo builds `apps/api` and `apps/web`) |
| **Deploy API** | Docker image built → pushed to Azure Container Registry → deployed to API App Service |
| **Deploy Web** | Vite production build → deployed to Web App Service or static hosting |

Monitor the pipeline. If any stage fails:
1. Do **not** roll back immediately — investigate the failure first.
2. If the failure is environment-specific (infra/config), fix via hotfix branch following
   this same SOP starting at Step 1.
3. If the build itself is broken, revert the merge commit on `main` and re-open the PR.

Verify the production deployment:
```bash
# Check the health endpoint for the released version number
curl https://<prod-url>/api/v1/health
```

---

## Quick Reference

```bash
# 1. Document your changes
#    Edit CHANGELOG.md [Unreleased] section

# 2. Beta bump (patch example)
npm run version:beta:patch

# 3. Push branch
git push origin HEAD

# 4. Test on beta environment (manual + npm run test)

# 5. Open PR on GitHub targeting main

# 6. Reviewer approves

# 7. Promote to stable
npm run version:release
#    Move CHANGELOG [Unreleased] → [x.y.z] - YYYY-MM-DD
git add CHANGELOG.md && git commit -m "docs: finalize changelog for vX.Y.Z"
git push origin HEAD

# 8. Squash-merge PR into main on GitHub

# 9. Confirm CI passes and production deploy succeeds
```

---

## Hotfix Process

For critical production bugs that cannot wait for a full release cycle:

1. Branch from `main`: `git checkout -b fix/critical-issue main`
2. Apply the fix.
3. Follow this SOP from Step 1, using `version:beta:patch` (or `version:beta:patch:api` /
   `version:beta:patch:web` if only one app is affected).
4. Expedite the PR review — one approval is still required.
5. Merge and confirm production deployment.

---

## Version Number Reference

| Situation | Command | Example result |
|---|---|---|
| Bug fix / chore | `version:beta:patch` | `1.0.1-beta.0` |
| New feature | `version:beta:minor` | `1.1.0-beta.0` |
| Breaking change | `version:beta:major` | `2.0.0-beta.0` |
| Additional beta iteration | Same command again | `1.0.1-beta.1` |
| Promote to stable | `version:release` | `1.0.1` |
| Stable patch (no beta) | `version:patch` | `1.0.1` |
| API only | `version:beta:patch:api` | api: `1.0.1-beta.0` |
| Web only | `version:beta:patch:web` | web: `1.0.1-beta.0` |
