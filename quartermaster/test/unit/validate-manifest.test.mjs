/**
 * test/unit/validate-manifest.test.mjs
 * node:test suite for runtime/validate-manifest.mjs
 *
 * 계약: validateManifest(manifest, catalog) → { ok, errors:[{code,key,message}] }
 * 거부 코드: SCHEMA_VIOLATION / CATALOG_UNKNOWN_COMPONENT / DUPLICATE_KEY /
 *            MISSING_REQUIRED / OVERRIDABLE_VIOLATION / INVALID_KEY_FORMAT
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dir, '..', 'fixtures');
const manifestsDir = join(fixturesDir, 'manifests');

// Runtime import — will fail if runtime worker hasn't delivered the file yet.
// CI gate: this import MUST succeed before tests run.
import { validateManifest } from '../../runtime/validate-manifest.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const catalog = loadJSON(join(fixturesDir, 'catalog.json'));

function loadManifest(name) {
  return loadJSON(join(manifestsDir, name));
}

// ── valid fixtures ────────────────────────────────────────────────────────────

test('roster.manifest.json → ok:true', () => {
  const manifest = loadManifest('roster.manifest.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, true, `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
});

test('inventory.manifest.json → ok:true', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, true, `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
});

test('modal.manifest.json → ok:true', () => {
  const manifest = loadManifest('modal.manifest.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, true, `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
});

// ── invalid: CATALOG_UNKNOWN_COMPONENT ───────────────────────────────────────

test('invalid-unknown-component.json → CATALOG_UNKNOWN_COMPONENT', () => {
  const manifest = loadManifest('invalid-unknown-component.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const err = result.errors.find(e => e.code === 'CATALOG_UNKNOWN_COMPONENT');
  assert.ok(err, `Expected CATALOG_UNKNOWN_COMPONENT error, got: ${JSON.stringify(result.errors)}`);
  assert.ok(err.key, 'Error must include key field');
  assert.ok(typeof err.message === 'string' && err.message.length > 0, 'Error must include message');
});

// ── invalid: DUPLICATE_KEY ────────────────────────────────────────────────────

test('invalid-dup-key.json → DUPLICATE_KEY', () => {
  const manifest = loadManifest('invalid-dup-key.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const err = result.errors.find(e => e.code === 'DUPLICATE_KEY');
  assert.ok(err, `Expected DUPLICATE_KEY error, got: ${JSON.stringify(result.errors)}`);
  assert.ok(err.key, 'Error must include key field');
  assert.equal(err.key, 'panel.alpha', 'Duplicate key must be reported');
});

// ── invalid: MISSING_REQUIRED ─────────────────────────────────────────────────

test('invalid-missing-required.json → MISSING_REQUIRED or SCHEMA_VIOLATION', () => {
  const manifest = loadManifest('invalid-missing-required.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const hasMissing = result.errors.some(
    e => e.code === 'MISSING_REQUIRED' || e.code === 'SCHEMA_VIOLATION'
  );
  assert.ok(hasMissing, `Expected MISSING_REQUIRED or SCHEMA_VIOLATION, got: ${JSON.stringify(result.errors)}`);
});

// ── invalid: INVALID_KEY_FORMAT ───────────────────────────────────────────────

test('invalid-bad-key-format.json → INVALID_KEY_FORMAT or SCHEMA_VIOLATION', () => {
  const manifest = loadManifest('invalid-bad-key-format.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const hasBadKey = result.errors.some(
    e => e.code === 'INVALID_KEY_FORMAT' || e.code === 'SCHEMA_VIOLATION'
  );
  assert.ok(hasBadKey, `Expected INVALID_KEY_FORMAT or SCHEMA_VIOLATION, got: ${JSON.stringify(result.errors)}`);
});

// ── invalid: SCHEMA_VIOLATION (refResolution wrong length) ───────────────────

test('invalid-schema.json → SCHEMA_VIOLATION', () => {
  const manifest = loadManifest('invalid-schema.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const err = result.errors.find(e => e.code === 'SCHEMA_VIOLATION');
  assert.ok(err, `Expected SCHEMA_VIOLATION, got: ${JSON.stringify(result.errors)}`);
});

// ── key position reporting ────────────────────────────────────────────────────

test('errors include key field when element key is identifiable', () => {
  const manifest = loadManifest('invalid-unknown-component.json');
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  for (const err of result.errors) {
    // errors that relate to a specific element must carry key
    if (err.code !== 'SCHEMA_VIOLATION') {
      assert.ok(typeof err.key === 'string', `Error missing key field: ${JSON.stringify(err)}`);
    }
  }
});

// ── recursive children validation ────────────────────────────────────────────

test('nested children with unknown component are caught recursively', () => {
  const manifest = {
    schemaVersion: 1,
    screen: 'NestedScreen',
    refResolution: [1920, 1080],
    elements: [
      {
        key: 'panel.root',
        name: 'Panel_Root',
        component: 'Panel_Base',
        children: [
          {
            key: 'panel.root.child',
            name: 'Panel_Child',
            component: 'Ghost_Component_XYZ',
          }
        ]
      }
    ]
  };
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const err = result.errors.find(e => e.code === 'CATALOG_UNKNOWN_COMPONENT');
  assert.ok(err, `Expected CATALOG_UNKNOWN_COMPONENT in nested child`);
  assert.equal(err.key, 'panel.root.child');
});

test('duplicate key in nested children is caught recursively', () => {
  const manifest = {
    schemaVersion: 1,
    screen: 'NestedDupScreen',
    refResolution: [1920, 1080],
    elements: [
      {
        key: 'panel.root',
        name: 'Panel_Root',
        component: 'Panel_Base',
        children: [
          {
            key: 'panel.shared',
            name: 'Panel_A',
            component: 'Panel_Base',
          },
          {
            key: 'panel.shared',
            name: 'Panel_B',
            component: 'Panel_Base',
          }
        ]
      }
    ]
  };
  const result = validateManifest(manifest, catalog);
  assert.equal(result.ok, false);
  const err = result.errors.find(e => e.code === 'DUPLICATE_KEY');
  assert.ok(err, 'Expected DUPLICATE_KEY for nested duplicate');
  assert.equal(err.key, 'panel.shared');
});

// ── no catalog: skip CATALOG_UNKNOWN_COMPONENT check ─────────────────────────

test('without catalog argument, unknown component is not flagged', () => {
  const manifest = loadManifest('invalid-unknown-component.json');
  const result = validateManifest(manifest, null);
  // Should only flag schema-level issues, not catalog issues
  const hasCatalogErr = result.errors.some(e => e.code === 'CATALOG_UNKNOWN_COMPONENT');
  assert.equal(hasCatalogErr, false, 'Without catalog, CATALOG_UNKNOWN_COMPONENT must not fire');
});
