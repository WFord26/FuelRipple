#!/usr/bin/env node
/**
 * Version bump script for FuelRipple
 *
 * Usage:
 *   node scripts/bump-version.js [type] [target]
 *
 * Types:
 *   patch        1.0.0 → 1.0.1
 *   minor        1.0.0 → 1.1.0
 *   major        1.0.0 → 2.0.0
 *   pre-patch    1.0.0 → 1.0.1-beta.0   (already on beta → bump beta counter)
 *   pre-minor    1.0.0 → 1.1.0-beta.0
 *   pre-major    1.0.0 → 2.0.0-beta.0
 *   release      1.0.1-beta.0 → 1.0.1   (promote beta to stable)
 *
 * Targets:
 *   all (default), web, api
 *
 * Examples:
 *   node scripts/bump-version.js pre-patch          # → 1.0.1-beta.0 for web + api + root
 *   node scripts/bump-version.js pre-minor api      # → 1.1.0-beta.0 for api + root
 *   node scripts/bump-version.js release            # strip beta suffix from web + api + root
 *   node scripts/bump-version.js patch              # → 1.0.1 for web + api + root
 *
 * Always writes the root package.json version to match the highest resulting
 * version, then stages all modified files and commits.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, '..');

const PKG_PATHS = {
  web: path.join(ROOT, 'apps', 'web', 'package.json'),
  api: path.join(ROOT, 'apps', 'api', 'package.json'),
  root: path.join(ROOT, 'package.json'),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readPkg(pkgPath) {
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
}

function writePkg(pkgPath, pkg) {
  // Preserve trailing newline; JSON.stringify always produces compact output
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

/**
 * Parse a semver string (with optional -beta.N pre-release).
 * Returns { major, minor, patch, betaN } where betaN is undefined for stable.
 */
function parseSemver(version) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
  if (!m) throw new Error(`Invalid semver "${version}" in package.json`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    betaN: m[4] !== undefined ? Number(m[4]) : undefined,
  };
}

/**
 * Increment a semver string by the given type.
 * @param {string} version  Current semver (e.g. "1.2.3" or "1.2.3-beta.0")
 * @param {'major'|'minor'|'patch'|'pre-major'|'pre-minor'|'pre-patch'|'release'} type
 * @returns {string} New semver string
 */
function bumpVersion(version, type) {
  const { major, minor, patch, betaN } = parseSemver(version);

  switch (type) {
    case 'patch':   return `${major}.${minor}.${patch + 1}`;
    case 'minor':   return `${major}.${minor + 1}.0`;
    case 'major':   return `${major + 1}.0.0`;

    case 'pre-patch':
      if (betaN !== undefined) return `${major}.${minor}.${patch}-beta.${betaN + 1}`;
      return `${major}.${minor}.${patch + 1}-beta.0`;

    case 'pre-minor':
      if (betaN !== undefined) return `${major}.${minor}.${patch}-beta.${betaN + 1}`;
      return `${major}.${minor + 1}.0-beta.0`;

    case 'pre-major':
      if (betaN !== undefined) return `${major}.${minor}.${patch}-beta.${betaN + 1}`;
      return `${major + 1}.0.0-beta.0`;

    case 'release':
      if (betaN === undefined) {
        throw new Error(`"${version}" is not a pre-release — nothing to promote. Did you mean patch/minor/major?`);
      }
      return `${major}.${minor}.${patch}`;

    default:
      throw new Error(`Unknown bump type "${type}". Use patch, minor, major, pre-patch, pre-minor, pre-major, or release.`);
  }
}

/**
 * Compare two semver strings (supports -beta.N).
 * Returns positive if a > b, negative if a < b, 0 if equal.
 * A stable release is always higher than its own beta (1.0.1 > 1.0.1-beta.0).
 */
function semverCompare(a, b) {
  const parse = v => {
    const { major, minor, patch, betaN } = parseSemver(v);
    // Infinity means no pre-release (stable), so stable > any beta of same core
    return [major, minor, patch, betaN !== undefined ? betaN : Infinity];
  };
  const ap = parse(a);
  const bp = parse(b);
  for (let i = 0; i < 4; i++) {
    if (ap[i] !== bp[i]) return ap[i] - bp[i];
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Parse arguments
// ---------------------------------------------------------------------------
const VALID_TYPES = ['patch', 'minor', 'major', 'pre-patch', 'pre-minor', 'pre-major', 'release'];
const VALID_TARGETS = ['web', 'api', 'all'];

const args = process.argv.slice(2);
const bumpType = args[0] || 'patch';
const target = args[1] || 'all';

if (!VALID_TYPES.includes(bumpType)) {
  console.error(`\nError: bump type must be one of: ${VALID_TYPES.join(', ')} (got "${bumpType}")`);
  console.error('Usage: node scripts/bump-version.js [patch|minor|major|pre-patch|pre-minor|pre-major|release] [web|api|all]\n');
  process.exit(1);
}

if (!VALID_TARGETS.includes(target)) {
  console.error(`\nError: target must be one of: ${VALID_TARGETS.join(', ')} (got "${target}")`);
  console.error('Usage: node scripts/bump-version.js [patch|minor|major|pre-patch|pre-minor|pre-major|release] [web|api|all]\n');
  process.exit(1);
}

const appTargets = target === 'all' ? ['web', 'api'] : [target];

// ---------------------------------------------------------------------------
// Perform bumps
// ---------------------------------------------------------------------------
const actionLabel = bumpType === 'release' ? 'Releasing (promoting beta → stable)' : `Bumping ${bumpType}`;
console.log(`\n${actionLabel} for: ${appTargets.join(', ')} + root\n`);

const changes = [];

for (const name of appTargets) {
  const pkgPath = PKG_PATHS[name];
  const pkg = readPkg(pkgPath);
  const oldVersion = pkg.version;
  const newVersion = bumpVersion(oldVersion, bumpType);
  pkg.version = newVersion;
  writePkg(pkgPath, pkg);
  changes.push({ name, pkgPath, oldVersion, newVersion });
}

// Root version = highest of the bumped versions (or bump it independently if
// only one app was targeted, keeping it in sync with that app).
const highestNew = changes.reduce((acc, c) => {
  return semverCompare(c.newVersion, acc) > 0 ? c.newVersion : acc;
}, '0.0.0');

const rootPkg = readPkg(PKG_PATHS.root);
const oldRootVersion = rootPkg.version;
rootPkg.version = highestNew;
writePkg(PKG_PATHS.root, rootPkg);

// ---------------------------------------------------------------------------
// Print summary
// ---------------------------------------------------------------------------
const separator = '─'.repeat(52);
console.log(separator);
for (const { name, oldVersion, newVersion } of changes) {
  console.log(`  @fuelripple/${name.padEnd(4)}  ${oldVersion.padEnd(10)} → ${newVersion}`);
}
console.log(`  root          ${oldRootVersion.padEnd(10)} → ${highestNew}`);
console.log(separator);

// ---------------------------------------------------------------------------
// Git: stage changed files and commit
// ---------------------------------------------------------------------------
const relPaths = [
  ...changes.map(c => path.relative(ROOT, c.pkgPath).replace(/\\/g, '/')),
  'package.json',
];

const commitMsg = bumpType === 'release'
  ? `chore: release v${highestNew}`
  : bumpType.startsWith('pre-')
    ? `chore: bump version to ${highestNew} (beta)`
    : `chore: bump version to ${highestNew}`;

try {
  execSync(`git -C "${ROOT}" add ${relPaths.map(f => `"${f}"`).join(' ')}`, {
    stdio: 'inherit',
  });
  execSync(`git -C "${ROOT}" commit -m "${commitMsg}"`, { stdio: 'inherit' });
  console.log(`\nCommitted: ${commitMsg}\n`);
} catch {
  console.warn('\nWarning: file(s) updated but git stage/commit failed.');
  console.warn('You may need to commit manually:\n');
  console.warn(`  git add ${relPaths.join(' ')}`);
  console.warn(`  git commit -m "${commitMsg}"\n`);
}
