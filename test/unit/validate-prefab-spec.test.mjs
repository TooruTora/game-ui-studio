/**
 * test/unit/validate-prefab-spec.test.mjs
 * node:test suite for runtime/validate-prefab-spec.mjs
 *
 * 계약: validatePrefabSpec(spec) → { ok, errors:[{code,prefab,message}] }
 * 거부 코드: PREFAB_SCHEMA_VIOLATION / PREFAB_MISSING_KIND / PREFAB_BAD_KIND /
 *            PREFAB_MISSING_SOURCE / PREFAB_BAD_SAVE_PATH /
 *            PREFAB_BAD_NINESLICE / PREFAB_BAD_IMPORT
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dir, '..', '..', 'examples');

import { validatePrefabSpec } from '../../runtime/validate-prefab-spec.mjs';

// ── helpers ───────────────────────────────────────────────────────────────────

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function hasCode(errors, code) {
  return errors.some(e => e.code === code);
}

function minValid() {
  return {
    kind: 'button',
    sourceSprite: 'Assets/UI/Source/btn.png',
    savePath: 'Assets/UI/Prefabs/Btn.prefab',
  };
}

// ── valid: examples/prefab-spec.json ─────────────────────────────────────────

test('examples/prefab-spec.json → ok:true', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, true, `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
});

// ── invalid: PREFAB_MISSING_KIND ─────────────────────────────────────────────

test('kind 필드 누락 → PREFAB_MISSING_KIND', () => {
  const spec = { Btn: { sourceSprite: 'Assets/UI/Source/btn.png', savePath: 'Assets/UI/Prefabs/Btn.prefab' } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_MISSING_KIND'),
    `Expected PREFAB_MISSING_KIND in ${JSON.stringify(result.errors)}`);
});

// ── invalid: PREFAB_BAD_KIND ─────────────────────────────────────────────────

test('kind 값이 enum 외 → PREFAB_BAD_KIND', () => {
  const spec = { Btn: { ...minValid(), kind: 'widget' } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_KIND'),
    `Expected PREFAB_BAD_KIND in ${JSON.stringify(result.errors)}`);
});

// ── invalid: PREFAB_MISSING_SOURCE ───────────────────────────────────────────

test('sourceSprite 필드 누락 → PREFAB_MISSING_SOURCE', () => {
  const spec = { Btn: { kind: 'button', savePath: 'Assets/UI/Prefabs/Btn.prefab' } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_MISSING_SOURCE'),
    `Expected PREFAB_MISSING_SOURCE in ${JSON.stringify(result.errors)}`);
});

// ── invalid: PREFAB_BAD_SAVE_PATH ────────────────────────────────────────────

test('savePath가 .prefab 아님 → PREFAB_BAD_SAVE_PATH', () => {
  const spec = { Btn: { ...minValid(), savePath: 'Assets/UI/Prefabs/Btn.fbx' } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_SAVE_PATH'),
    `Expected PREFAB_BAD_SAVE_PATH in ${JSON.stringify(result.errors)}`);
});

test('savePath가 Assets/로 시작하지 않음 → PREFAB_BAD_SAVE_PATH', () => {
  const spec = { Btn: { ...minValid(), savePath: 'UI/Prefabs/Btn.prefab' } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_SAVE_PATH'),
    `Expected PREFAB_BAD_SAVE_PATH in ${JSON.stringify(result.errors)}`);
});

// ── invalid: PREFAB_BAD_NINESLICE ────────────────────────────────────────────

test('nineSlice.border가 3개 → PREFAB_BAD_NINESLICE', () => {
  const spec = { Btn: { ...minValid(), nineSlice: { border: [10, 10, 10] } } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_NINESLICE'),
    `Expected PREFAB_BAD_NINESLICE in ${JSON.stringify(result.errors)}`);
});

test('nineSlice.border에 음수 → PREFAB_BAD_NINESLICE', () => {
  const spec = { Btn: { ...minValid(), nineSlice: { border: [10, -1, 10, 10] } } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_NINESLICE'),
    `Expected PREFAB_BAD_NINESLICE in ${JSON.stringify(result.errors)}`);
});

// ── invalid: PREFAB_BAD_IMPORT ───────────────────────────────────────────────

test('import.filterMode 잘못된 값 → PREFAB_BAD_IMPORT', () => {
  const spec = { Btn: { ...minValid(), import: { filterMode: 'Anisotropic' } } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_IMPORT'),
    `Expected PREFAB_BAD_IMPORT in ${JSON.stringify(result.errors)}`);
});

test('import.compression 잘못된 값 → PREFAB_BAD_IMPORT', () => {
  const spec = { Btn: { ...minValid(), import: { compression: 'Ultra' } } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_BAD_IMPORT'),
    `Expected PREFAB_BAD_IMPORT in ${JSON.stringify(result.errors)}`);
});

// ── invalid: 알 수 없는 필드 → PREFAB_SCHEMA_VIOLATION ───────────────────────

test('알 수 없는 최상위 필드 → PREFAB_SCHEMA_VIOLATION', () => {
  const spec = { Btn: { ...minValid(), unknownField: 'bad' } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_SCHEMA_VIOLATION'),
    `Expected PREFAB_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});

// ── invalid: spec 자체가 객체 아님 ───────────────────────────────────────────

test('spec이 배열이면 → PREFAB_SCHEMA_VIOLATION', () => {
  const result = validatePrefabSpec([{ Btn: {} }]);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_SCHEMA_VIOLATION'),
    `Expected PREFAB_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});

test('spec이 null이면 → PREFAB_SCHEMA_VIOLATION', () => {
  const result = validatePrefabSpec(null);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'PREFAB_SCHEMA_VIOLATION'),
    `Expected PREFAB_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});

// ── valid: nineSlice:null 허용 ────────────────────────────────────────────────

test('nineSlice:null 이면 ok:true', () => {
  const spec = { Txt: { ...minValid(), kind: 'text', nineSlice: null } };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, true,
    `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
});

// ── valid: import 정상 값 ────────────────────────────────────────────────────

test('import 모든 필드 정상 → ok:true', () => {
  const spec = {
    Btn: {
      ...minValid(),
      import: {
        textureType: 'Sprite',
        spriteMode: 'Single',
        pixelsPerUnit: 100,
        filterMode: 'Point',
        compression: 'NormalQuality',
        generateMipMaps: false,
      },
    },
  };
  const result = validatePrefabSpec(spec);
  assert.equal(result.ok, true,
    `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
});
