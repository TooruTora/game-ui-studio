/**
 * test/unit/prefab-guide.test.mjs
 * node:test suite for runtime/prefab-guide.mjs
 *
 * 계약: buildGuide(spec) → { markdown }
 *       buildPrefabSection(name, entry) → string
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dir, '..', '..', 'examples');

import { buildGuide, buildPrefabSection } from '../../runtime/prefab-guide.mjs';

// ── helpers ───────────────────────────────────────────────────────────────────

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ── 결정성: 동일 입력 2회 동일 출력 ─────────────────────────────────────────

test('buildGuide 결정성 — 동일 입력 2회 동일 출력', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const first = buildGuide(spec);
  const second = buildGuide(spec);
  assert.equal(first.markdown, second.markdown, 'buildGuide must be deterministic');
});

test('buildPrefabSection 결정성 — 동일 입력 2회 동일 출력', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const name = 'Btn_Base';
  const first = buildPrefabSection(name, spec[name]);
  const second = buildPrefabSection(name, spec[name]);
  assert.equal(first, second, 'buildPrefabSection must be deterministic');
});

// ── 헤더 포함 확인 ───────────────────────────────────────────────────────────

test('가이드 헤더에 "Game UI Studio — 베이스 프리팹 셋업 가이드" 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('Game UI Studio — 베이스 프리팹 셋업 가이드'),
    'Header not found in guide');
});

test('가이드 헤더에 프리팹 개수 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const count = Object.keys(spec).length;
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes(`${count}개`),
    `Expected "${count}개" in guide header`);
});

// ── 각 프리팹명 포함 확인 ────────────────────────────────────────────────────

test('가이드에 Panel_Base 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('Panel_Base'), 'Panel_Base not found in guide');
});

test('가이드에 Btn_Base 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('Btn_Base'), 'Btn_Base not found in guide');
});

test('가이드에 ScrollList 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('ScrollList'), 'ScrollList not found in guide');
});

test('가이드에 Grid_Base 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('Grid_Base'), 'Grid_Base not found in guide');
});

test('가이드에 Modal_Base 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('Modal_Base'), 'Modal_Base not found in guide');
});

test('가이드에 Text_Base 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('Text_Base'), 'Text_Base not found in guide');
});

test('가이드에 ItemSlot 섹션 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('ItemSlot'), 'ItemSlot not found in guide');
});

// ── nineSlice 있는 프리팹에 Border 값 포함 ──────────────────────────────────

test('Panel_Base 섹션에 Border 값 포함 (9-slice 있음)', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const section = buildPrefabSection('Panel_Base', spec['Panel_Base']);
  assert.ok(section.includes('Border') || section.includes('border'),
    'Border step not found for Panel_Base');
  // border = [20,20,20,20]
  assert.ok(section.includes('20'), 'Border value 20 not found for Panel_Base');
});

test('Btn_Base 섹션에 Border 값 12 포함 (9-slice 있음)', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const section = buildPrefabSection('Btn_Base', spec['Btn_Base']);
  assert.ok(section.includes('12'), 'Border value 12 not found for Btn_Base');
});

test('ItemSlot 섹션에 Border 값 4 포함 (9-slice 있음)', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const section = buildPrefabSection('ItemSlot', spec['ItemSlot']);
  assert.ok(section.includes('4'), 'Border value 4 not found for ItemSlot');
});

// ── nineSlice:null 인 Text_Base는 Border 단계 미포함 ─────────────────────────

test('Text_Base 섹션에 9-slice Border 단계 미포함 (nineSlice:null)', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  assert.equal(spec['Text_Base'].nineSlice, null, 'Text_Base.nineSlice should be null');
  const section = buildPrefabSection('Text_Base', spec['Text_Base']);
  assert.ok(!section.includes('9-slice 보더 설정'), 'Border step should NOT appear for Text_Base');
});

// ── savePath 포함 확인 ────────────────────────────────────────────────────────

test('각 프리팹 섹션에 savePath 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  for (const [name, entry] of Object.entries(spec)) {
    const section = buildPrefabSection(name, entry);
    assert.ok(section.includes(entry.savePath),
      `savePath "${entry.savePath}" not found in section for ${name}`);
  }
});

// ── 카탈로그 동기화 푸터 포함 ────────────────────────────────────────────────

test('가이드 마지막에 카탈로그 동기화 푸터 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('catalog-sync'),
    'catalog-sync footer not found in guide');
});

test('가이드 푸터에 savePath/unity 경로 일치 안내 포함', () => {
  const spec = loadJSON(join(examplesDir, 'prefab-spec.json'));
  const { markdown } = buildGuide(spec);
  assert.ok(markdown.includes('catalog.json'),
    'catalog.json reference not found in guide footer');
});
