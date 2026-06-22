/**
 * test/unit/validate-catalog.test.mjs
 * node:test suite for runtime/validate-catalog.mjs
 *
 * 계약: validateCatalog(catalog) → { ok, errors:[{code,component,message}] }
 * 거부 코드: CATALOG_SCHEMA_VIOLATION / CATALOG_MISSING_UNITY /
 *            CATALOG_BAD_UNITY_PATH / CATALOG_MISSING_PREVIEW_EL
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dir, '..', '..', 'examples');

import { validateCatalog } from '../../runtime/validate-catalog.mjs';

// ── helpers ───────────────────────────────────────────────────────────────────

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function hasCode(errors, code) {
  return errors.some(e => e.code === code);
}

// ── valid: examples/catalog.json ─────────────────────────────────────────────

test('examples/catalog.json → ok:true', () => {
  const catalog = loadJSON(join(examplesDir, 'catalog.json'));
  const result = validateCatalog(catalog);
  assert.equal(result.ok, true, `Expected ok:true but got errors: ${JSON.stringify(result.errors)}`);
  assert.deepEqual(result.errors, []);
});

// ── invalid: CATALOG_MISSING_UNITY ───────────────────────────────────────────

test('unity 필드 누락 → CATALOG_MISSING_UNITY', () => {
  const catalog = {
    Btn_Base: {
      preview: { el: 'button', cls: 'qm-btn-base' },
      overridable: ['label'],
      // unity 필드 없음
    },
  };
  const result = validateCatalog(catalog);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_MISSING_UNITY'),
    `Expected CATALOG_MISSING_UNITY in ${JSON.stringify(result.errors)}`);
});

// ── invalid: CATALOG_BAD_UNITY_PATH ──────────────────────────────────────────

test('unity 경로가 .prefab 아님 → CATALOG_BAD_UNITY_PATH', () => {
  const catalog = {
    Panel_Base: {
      preview: { el: 'div', cls: 'qm-panel-base' },
      unity: 'Assets/UI/Prefabs/Panel_Base.fbx',  // .prefab 아님
      overridable: [],
    },
  };
  const result = validateCatalog(catalog);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_BAD_UNITY_PATH'),
    `Expected CATALOG_BAD_UNITY_PATH in ${JSON.stringify(result.errors)}`);
});

test('unity 경로가 Assets/로 시작하지 않음 → CATALOG_BAD_UNITY_PATH', () => {
  const catalog = {
    Text_Base: {
      preview: { el: 'span', cls: 'qm-text-base' },
      unity: 'UI/Prefabs/Text_Base.prefab',  // Assets/ 미시작
      overridable: ['label'],
    },
  };
  const result = validateCatalog(catalog);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_BAD_UNITY_PATH'),
    `Expected CATALOG_BAD_UNITY_PATH in ${JSON.stringify(result.errors)}`);
});

// ── invalid: CATALOG_MISSING_PREVIEW_EL ──────────────────────────────────────

test('preview.el 누락 → CATALOG_MISSING_PREVIEW_EL', () => {
  const catalog = {
    Modal_Base: {
      preview: { cls: 'qm-modal-base' },  // el 없음
      unity: 'Assets/UI/Prefabs/Modal_Base.prefab',
      overridable: [],
    },
  };
  const result = validateCatalog(catalog);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_MISSING_PREVIEW_EL'),
    `Expected CATALOG_MISSING_PREVIEW_EL in ${JSON.stringify(result.errors)}`);
});

// ── invalid: overridable이 배열 아님 → CATALOG_SCHEMA_VIOLATION ───────────────

test('overridable이 배열 아님 → CATALOG_SCHEMA_VIOLATION', () => {
  const catalog = {
    ItemSlot: {
      preview: { el: 'div', cls: 'qm-itemslot' },
      unity: 'Assets/UI/Prefabs/ItemSlot.prefab',
      overridable: 'iconSlot',  // 문자열이어서 배열 아님
    },
  };
  const result = validateCatalog(catalog);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_SCHEMA_VIOLATION'),
    `Expected CATALOG_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});

// ── invalid: 알 수 없는 최상위 필드 → CATALOG_SCHEMA_VIOLATION ───────────────

test('알 수 없는 최상위 필드 → CATALOG_SCHEMA_VIOLATION', () => {
  const catalog = {
    Grid_Base: {
      preview: { el: 'div', cls: 'qm-grid-base' },
      unity: 'Assets/UI/Prefabs/Grid_Base.prefab',
      overridable: [],
      extra: 'not-allowed',  // schema에 없는 필드
    },
  };
  const result = validateCatalog(catalog);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_SCHEMA_VIOLATION'),
    `Expected CATALOG_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});

// ── invalid: catalog 자체가 객체 아님 → CATALOG_SCHEMA_VIOLATION ──────────────

test('catalog이 배열이면 → CATALOG_SCHEMA_VIOLATION', () => {
  const result = validateCatalog([{ Panel_Base: {} }]);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_SCHEMA_VIOLATION'),
    `Expected CATALOG_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});

test('catalog이 null이면 → CATALOG_SCHEMA_VIOLATION', () => {
  const result = validateCatalog(null);
  assert.equal(result.ok, false);
  assert.ok(hasCode(result.errors, 'CATALOG_SCHEMA_VIOLATION'),
    `Expected CATALOG_SCHEMA_VIOLATION in ${JSON.stringify(result.errors)}`);
});
