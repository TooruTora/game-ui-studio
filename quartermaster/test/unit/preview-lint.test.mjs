/**
 * test/unit/preview-lint.test.mjs
 * node:test suite for runtime/preview-lint.mjs
 *
 * 각 LINT_* 코드를 인라인 매니페스트로 유발하고,
 * 정상 매니페스트는 경고 0임을 검증한다.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintPreview, LINT_CODES } from '../../runtime/preview-lint.mjs';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 기본 유효 매니페스트 골격 */
function makeManifest(elements) {
  return { screen: 'TestScreen', refResolution: [1920, 1080], elements };
}

/** 기본 카탈로그 (Panel_Base, Btn_Base만 포함) */
const CATALOG = {
  Panel_Base: { preview: { el: 'div', cls: 'panel-base' }, unity: 'x', overridable: [] },
  Btn_Base:   { preview: { el: 'button', cls: 'btn-base' }, unity: 'x', overridable: ['label'] },
  Grid_Base:  { preview: { el: 'div', cls: 'grid-base' }, unity: 'x', overridable: [] },
};

function hasCode(warnings, code) {
  return warnings.some(w => w.code === code);
}

// ─── LINT_UNKNOWN_COMPONENT ───────────────────────────────────────────────────

test('LINT_UNKNOWN_COMPONENT: catalog 주어졌는데 미등재 컴포넌트 → 경고 발생', () => {
  const manifest = makeManifest([
    { key: 'panel.a', name: 'Panel_A', component: 'Ghost_Widget', anchor: 'stretch' },
  ]);
  const { warnings } = lintPreview(manifest, CATALOG);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_UNKNOWN_COMPONENT),
    `warnings must include LINT_UNKNOWN_COMPONENT, got: ${JSON.stringify(warnings)}`
  );
  const w = warnings.find(w => w.code === LINT_CODES.LINT_UNKNOWN_COMPONENT);
  assert.equal(w.key, 'panel.a');
});

test('LINT_UNKNOWN_COMPONENT: catalog 없으면 미등재 컴포넌트도 경고 없음', () => {
  const manifest = makeManifest([
    { key: 'panel.a', name: 'Panel_A', component: 'Ghost_Widget', anchor: 'stretch' },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_UNKNOWN_COMPONENT),
    'No LINT_UNKNOWN_COMPONENT without catalog'
  );
});

test('LINT_UNKNOWN_COMPONENT: 등재된 컴포넌트는 경고 없음', () => {
  const manifest = makeManifest([
    { key: 'panel.a', name: 'Panel_A', component: 'Panel_Base', anchor: 'stretch' },
  ]);
  const { warnings } = lintPreview(manifest, CATALOG);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_UNKNOWN_COMPONENT),
    'Known component must not warn'
  );
});

// ─── LINT_FIXED_OVERFLOW ──────────────────────────────────────────────────────

test('LINT_FIXED_OVERFLOW: horizontal 부모 width < 자식 width 합 → 경고 발생', () => {
  const manifest = makeManifest([
    {
      key: 'row.a', name: 'Row_A', component: 'Panel_Base', anchor: 'stretch',
      layout: 'horizontal', width: 200,
      children: [
        { key: 'btn.x', name: 'Btn_X', component: 'Btn_Base', width: 120 },
        { key: 'btn.y', name: 'Btn_Y', component: 'Btn_Base', width: 120 },
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_FIXED_OVERFLOW),
    `warnings must include LINT_FIXED_OVERFLOW, got: ${JSON.stringify(warnings)}`
  );
  const w = warnings.find(w => w.code === LINT_CODES.LINT_FIXED_OVERFLOW);
  assert.equal(w.key, 'row.a');
});

test('LINT_FIXED_OVERFLOW: vertical 부모 height < 자식 height 합 → 경고 발생', () => {
  const manifest = makeManifest([
    {
      key: 'col.a', name: 'Col_A', component: 'Panel_Base', anchor: 'stretch',
      layout: 'vertical', height: 100,
      children: [
        { key: 'btn.x', name: 'Btn_X', component: 'Btn_Base', height: 60 },
        { key: 'btn.y', name: 'Btn_Y', component: 'Btn_Base', height: 60 },
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_FIXED_OVERFLOW),
    `warnings must include LINT_FIXED_OVERFLOW, got: ${JSON.stringify(warnings)}`
  );
});

test('LINT_FIXED_OVERFLOW: 자식 합이 부모 이내이면 경고 없음', () => {
  const manifest = makeManifest([
    {
      key: 'row.a', name: 'Row_A', component: 'Panel_Base', anchor: 'stretch',
      layout: 'horizontal', width: 300,
      children: [
        { key: 'btn.x', name: 'Btn_X', component: 'Btn_Base', width: 100 },
        { key: 'btn.y', name: 'Btn_Y', component: 'Btn_Base', width: 100 },
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_FIXED_OVERFLOW),
    'No overflow when sum fits parent'
  );
});

test('LINT_FIXED_OVERFLOW: 자식 중 width 미지정 있으면 경고 없음 (불확정)', () => {
  const manifest = makeManifest([
    {
      key: 'row.a', name: 'Row_A', component: 'Panel_Base', anchor: 'stretch',
      layout: 'horizontal', width: 100,
      children: [
        { key: 'btn.x', name: 'Btn_X', component: 'Btn_Base', width: 80 },
        { key: 'btn.y', name: 'Btn_Y', component: 'Btn_Base' }, // width 없음
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_FIXED_OVERFLOW),
    'Indeterminate child width must not trigger overflow warning'
  );
});

// ─── LINT_REPEAT_NO_TEMPLATE ──────────────────────────────────────────────────

test('LINT_REPEAT_NO_TEMPLATE: repeat 있는데 children 없음 → 경고 발생', () => {
  const manifest = makeManifest([
    {
      key: 'list.a', name: 'List_A', component: 'Panel_Base', anchor: 'stretch',
      repeat: 5,
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_REPEAT_NO_TEMPLATE),
    `warnings must include LINT_REPEAT_NO_TEMPLATE, got: ${JSON.stringify(warnings)}`
  );
  const w = warnings.find(w => w.code === LINT_CODES.LINT_REPEAT_NO_TEMPLATE);
  assert.equal(w.key, 'list.a');
});

test('LINT_REPEAT_NO_TEMPLATE: repeat 있는데 children 빈 배열 → 경고 발생', () => {
  const manifest = makeManifest([
    {
      key: 'list.b', name: 'List_B', component: 'Panel_Base', anchor: 'stretch',
      repeat: 'items', children: [],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_REPEAT_NO_TEMPLATE),
    'Empty children with repeat must warn'
  );
});

test('LINT_REPEAT_NO_TEMPLATE: repeat + children[0] 있으면 경고 없음', () => {
  const manifest = makeManifest([
    {
      key: 'list.c', name: 'List_C', component: 'Panel_Base', anchor: 'stretch',
      repeat: 3,
      children: [
        { key: 'item.tpl', name: 'Item_Tpl', component: 'Panel_Base' },
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_REPEAT_NO_TEMPLATE),
    'Repeat with template child must not warn'
  );
});

// ─── LINT_GRID_NO_COLUMNS ─────────────────────────────────────────────────────

test('LINT_GRID_NO_COLUMNS: layout=grid + columns 없음 → 경고 발생', () => {
  const manifest = makeManifest([
    {
      key: 'grid.a', name: 'Grid_A', component: 'Grid_Base', anchor: 'stretch',
      layout: 'grid',
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_GRID_NO_COLUMNS),
    `warnings must include LINT_GRID_NO_COLUMNS, got: ${JSON.stringify(warnings)}`
  );
  const w = warnings.find(w => w.code === LINT_CODES.LINT_GRID_NO_COLUMNS);
  assert.equal(w.key, 'grid.a');
});

test('LINT_GRID_NO_COLUMNS: layout=grid + columns 있으면 경고 없음', () => {
  const manifest = makeManifest([
    {
      key: 'grid.b', name: 'Grid_B', component: 'Grid_Base', anchor: 'stretch',
      layout: 'grid', columns: 4,
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_GRID_NO_COLUMNS),
    'Grid with columns must not warn'
  );
});

test('LINT_GRID_NO_COLUMNS: layout=vertical은 해당 경고 없음', () => {
  const manifest = makeManifest([
    {
      key: 'col.a', name: 'Col_A', component: 'Panel_Base', anchor: 'stretch',
      layout: 'vertical',
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_GRID_NO_COLUMNS),
    'Non-grid layout must not trigger LINT_GRID_NO_COLUMNS'
  );
});

// ─── LINT_MISSING_ANCHOR ──────────────────────────────────────────────────────

test('LINT_MISSING_ANCHOR: 최상위 element에 anchor 없음 → 경고 발생', () => {
  const manifest = makeManifest([
    { key: 'panel.a', name: 'Panel_A', component: 'Panel_Base' },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_MISSING_ANCHOR),
    `warnings must include LINT_MISSING_ANCHOR, got: ${JSON.stringify(warnings)}`
  );
  const w = warnings.find(w => w.code === LINT_CODES.LINT_MISSING_ANCHOR);
  assert.equal(w.key, 'panel.a');
});

test('LINT_MISSING_ANCHOR: 최상위 element에 anchor 있으면 경고 없음', () => {
  const manifest = makeManifest([
    { key: 'panel.a', name: 'Panel_A', component: 'Panel_Base', anchor: 'stretch' },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_MISSING_ANCHOR),
    'Top-level element with anchor must not warn'
  );
});

test('LINT_MISSING_ANCHOR: 비최상위(children) anchor 없어도 경고 없음', () => {
  const manifest = makeManifest([
    {
      key: 'panel.a', name: 'Panel_A', component: 'Panel_Base', anchor: 'stretch',
      children: [
        { key: 'btn.x', name: 'Btn_X', component: 'Btn_Base' }, // anchor 없음
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    !hasCode(warnings, LINT_CODES.LINT_MISSING_ANCHOR),
    'Non-top-level element without anchor must not warn'
  );
});

// ─── 정상 매니페스트 경고 0 ───────────────────────────────────────────────────

test('정상 매니페스트: 경고 0 (anchor+catalog+columns+repeat+template 모두 충족)', () => {
  const manifest = makeManifest([
    {
      key: 'panel.main', name: 'Panel_Main', component: 'Panel_Base', anchor: 'stretch',
      layout: 'vertical', spacing: 8,
      children: [
        {
          key: 'grid.items', name: 'Grid_Items', component: 'Grid_Base',
          layout: 'grid', columns: 3, spacing: 4,
          repeat: 9,
          children: [
            { key: 'item.tpl', name: 'Item_Tpl', component: 'Panel_Base' },
          ],
        },
        {
          key: 'btn.confirm', name: 'Btn_Confirm', component: 'Btn_Base',
          label: '확인', width: 120, height: 48,
        },
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, CATALOG);
  assert.equal(
    warnings.length, 0,
    `Expected 0 warnings for clean manifest, got: ${JSON.stringify(warnings)}`
  );
});

// ─── 재귀 검사: 깊은 children도 탐지 ────────────────────────────────────────

test('LINT_GRID_NO_COLUMNS: 깊은 children 내 grid도 탐지', () => {
  const manifest = makeManifest([
    {
      key: 'panel.root', name: 'Panel_Root', component: 'Panel_Base', anchor: 'stretch',
      layout: 'vertical',
      children: [
        {
          key: 'panel.inner', name: 'Panel_Inner', component: 'Panel_Base',
          layout: 'vertical',
          children: [
            {
              key: 'grid.deep', name: 'Grid_Deep', component: 'Grid_Base',
              layout: 'grid', // columns 없음
            },
          ],
        },
      ],
    },
  ]);
  const { warnings } = lintPreview(manifest, null);
  assert.ok(
    hasCode(warnings, LINT_CODES.LINT_GRID_NO_COLUMNS),
    'Deep grid without columns must trigger LINT_GRID_NO_COLUMNS'
  );
  const w = warnings.find(w => w.code === LINT_CODES.LINT_GRID_NO_COLUMNS);
  assert.equal(w.key, 'grid.deep');
});

// ─── 빈 매니페스트 / 방어 ─────────────────────────────────────────────────────

test('elements 없는 매니페스트: 경고 0 (크래시 없음)', () => {
  const { warnings } = lintPreview({ screen: 'X', refResolution: [1920, 1080], elements: [] }, null);
  assert.equal(warnings.length, 0);
});

test('null 매니페스트: 경고 0 (크래시 없음)', () => {
  const { warnings } = lintPreview(null, null);
  assert.equal(warnings.length, 0);
});
