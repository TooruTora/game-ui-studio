/**
 * test/unit/merge-planner.test.mjs
 * node:test suite for runtime/merge-planner.mjs
 *
 * 계약: planMerge(existingTree, manifest) → { ops:[{type:'add'|'override', key}] }
 * 규칙: 멱등(동일 입력 2회 → 2번째 ops 빈배열), remove 연산 절대 미발생.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dir, '..', 'fixtures');
const manifestsDir = join(fixturesDir, 'manifests');

import { planMerge } from '../../runtime/merge-planner.mjs';

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadManifest(name) {
  return loadJSON(join(manifestsDir, name));
}

// ── helper: flatten all keys from manifest elements recursively ───────────────

function collectKeys(elements, keys = []) {
  for (const el of elements ?? []) {
    keys.push(el.key);
    if (el.children) collectKeys(el.children, keys);
  }
  return keys;
}

// ── empty existing tree → all ops are 'add' ───────────────────────────────────

test('empty existingTree → all manifest keys get add ops', () => {
  const manifest = loadManifest('roster.manifest.json');
  const allKeys = collectKeys(manifest.elements);
  const { ops } = planMerge({}, manifest);

  assert.ok(Array.isArray(ops), 'ops must be array');
  assert.ok(ops.length > 0, 'ops must be non-empty for non-empty manifest');

  const addOps = ops.filter(o => o.type === 'add');
  assert.equal(addOps.length, ops.length, 'All ops must be type add when tree is empty');

  // Every manifest key must appear in ops
  for (const key of allKeys) {
    assert.ok(
      ops.some(o => o.key === key),
      `Key ${key} must appear in ops`
    );
  }
});

test('empty existingTree with inventory manifest → all add ops', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const { ops } = planMerge({}, manifest);
  assert.ok(ops.every(o => o.type === 'add'), 'All ops must be add');
});

test('empty existingTree with modal manifest → all add ops', () => {
  const manifest = loadManifest('modal.manifest.json');
  const { ops } = planMerge({}, manifest);
  assert.ok(ops.every(o => o.type === 'add'), 'All ops must be add');
});

// ── managed field change → override op ───────────────────────────────────────

test('existing tree with changed managed field → override op for that key', () => {
  const manifest = loadManifest('roster.manifest.json');

  // Simulate: tree already has btn.recruit but with old label
  const existingTree = {
    'btn.recruit': {
      component: 'Btn_Base',
      label: '구 라벨',          // managed field differs
      height: 60,
      width: 200,
    }
  };

  const { ops } = planMerge(existingTree, manifest);
  const overrideOp = ops.find(o => o.key === 'btn.recruit' && o.type === 'override');
  assert.ok(overrideOp, 'Changed managed field must produce override op');
});

test('existing tree with all keys unchanged → no ops (idempotent)', () => {
  const manifest = loadManifest('modal.manifest.json');

  // First pass: start from empty tree, collect all keys
  const { ops: firstOps } = planMerge({}, manifest);
  assert.ok(firstOps.length > 0);

  // Simulate that first pass was applied: build a tree that matches manifest exactly
  const appliedTree = {};
  function buildTree(elements) {
    for (const el of elements ?? []) {
      appliedTree[el.key] = { ...el };
      if (el.children) buildTree(el.children);
    }
  }
  buildTree(manifest.elements);

  // Second pass with same manifest → ops must be empty (idempotent)
  const { ops: secondOps } = planMerge(appliedTree, manifest);
  assert.deepEqual(secondOps, [], `Second pass must yield empty ops, got: ${JSON.stringify(secondOps)}`);
});

// ── idempotent: roster manifest ───────────────────────────────────────────────

test('roster manifest idempotency: second planMerge yields empty ops', () => {
  const manifest = loadManifest('roster.manifest.json');

  // Build applied tree from first pass
  const appliedTree = {};
  function flatten(elements) {
    for (const el of elements ?? []) {
      appliedTree[el.key] = { ...el };
      if (el.children) flatten(el.children);
    }
  }
  flatten(manifest.elements);

  const { ops } = planMerge(appliedTree, manifest);
  assert.deepEqual(ops, [], `Idempotent second pass must have zero ops, got: ${JSON.stringify(ops)}`);
});

// ── remove never occurs ───────────────────────────────────────────────────────

test('planMerge never produces remove ops — empty tree', () => {
  const manifest = loadManifest('roster.manifest.json');
  const { ops } = planMerge({}, manifest);
  const removeOps = ops.filter(o => o.type === 'remove');
  assert.deepEqual(removeOps, [], 'remove ops must never be produced');
});

test('planMerge never produces remove ops — tree has extra keys not in manifest', () => {
  const manifest = loadManifest('modal.manifest.json');
  const existingTree = {
    'orphan.key.one': { component: 'Panel_Base' },
    'orphan.key.two': { component: 'Btn_Base' },
  };
  const { ops } = planMerge(existingTree, manifest);
  const removeOps = ops.filter(o => o.type === 'remove');
  assert.deepEqual(removeOps, [], 'remove ops must not appear even when tree has extra keys');
});

test('planMerge never produces remove ops — large inventory manifest', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const existingTree = {
    'stale.panel.x': { component: 'Panel_Base' },
  };
  const { ops } = planMerge(existingTree, manifest);
  const removeOps = ops.filter(o => o.type === 'remove');
  assert.deepEqual(removeOps, [], 'remove ops must never be produced');
});

// ── op shape contract ─────────────────────────────────────────────────────────

test('each op has type and key fields', () => {
  const manifest = loadManifest('roster.manifest.json');
  const { ops } = planMerge({}, manifest);
  for (const op of ops) {
    assert.ok(typeof op.type === 'string', `op.type must be string: ${JSON.stringify(op)}`);
    assert.ok(op.type === 'add' || op.type === 'override', `op.type must be add or override: ${op.type}`);
    assert.ok(typeof op.key === 'string', `op.key must be string: ${JSON.stringify(op)}`);
    assert.ok(op.key.length > 0, 'op.key must be non-empty');
  }
});

// ── planMerge return shape ────────────────────────────────────────────────────

test('planMerge returns object with ops array', () => {
  const manifest = loadManifest('modal.manifest.json');
  const result = planMerge({}, manifest);
  assert.equal(typeof result, 'object', 'planMerge must return object');
  assert.ok(Array.isArray(result.ops), 'result.ops must be array');
});
