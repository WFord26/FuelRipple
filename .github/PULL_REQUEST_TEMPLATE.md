# Pull Request

## Summary

<!-- Briefly describe what this PR does and why. -->

Closes #<!-- issue number -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / code quality
- [ ] Performance improvement
- [ ] Documentation
- [ ] Infrastructure / deployment
- [ ] Dependency update

## Areas changed

- [ ] `apps/api` — Express routes or services
- [ ] `apps/web` — React components or pages
- [ ] `packages/shared` — Zod schemas or constants
- [ ] `packages/impact-engine` — Math/calculation functions
- [ ] `packages/db` — Migrations, queries, or seeds
- [ ] `infra/` — Bicep / Azure infrastructure
- [ ] `.github/` — CI/CD or repo config
- [ ] `docs/`

## Checklist

- [ ] `npm run test` passes locally
- [ ] No new `any` types without explanatory comments
- [ ] New API response shapes are defined as Zod schemas in `packages/shared/src/schemas.ts`
- [ ] Route handlers check the two-tier cache before querying the DB
- [ ] `packages/impact-engine` changes are pure (no DB or network calls)
- [ ] DB schema changes are in a new numbered migration (not edited in place)
- [ ] New pages in `apps/web` use `React.lazy` and are wrapped in `<ErrorBoundary>`
- [ ] No auth middleware or protected routes added
- [ ] `.env` is not committed

## How to test

<!-- Step-by-step instructions for reviewers to verify the change works correctly. -->

1.
2.
3.

## Screenshots (if UI change)

<!-- Add before/after screenshots or screen recordings. -->

## Additional notes

<!-- Anything else reviewers should know: migration steps, flag day considerations, related issues, etc. -->
