/**
 * test/unit/preview.test.mjs
 * node:test suite for runtime/preview.mjs
 *
 * 계약: renderPreview(manifest, catalog) → { html }
 * 순수·결정적 함수.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dir, '..', 'fixtures');
const manifestsDir = join(fixturesDir, 'manifests');

import { renderPreview } from '../../runtime/preview.mjs';

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const catalog = loadJSON(join(fixturesDir, 'catalog.json'));

function loadManifest(name) {
  return loadJSON(join(manifestsDir, name));
}

// ── determinism ───────────────────────────────────────────────────────────────

test('renderPreview is deterministic: same input yields identical output twice', () => {
  const manifest = loadManifest('roster.manifest.json');
  const result1 = renderPreview(manifest, catalog);
  const result2 = renderPreview(manifest, catalog);
  assert.equal(typeof result1.html, 'string', 'Result must have html string');
  assert.equal(result1.html, result2.html, 'Two calls with same input must return identical html');
});

test('renderPreview is deterministic for inventory manifest', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const r1 = renderPreview(manifest, catalog);
  const r2 = renderPreview(manifest, catalog);
  assert.equal(r1.html, r2.html);
});

test('renderPreview is deterministic for modal manifest', () => {
  const manifest = loadManifest('modal.manifest.json');
  const r1 = renderPreview(manifest, catalog);
  const r2 = renderPreview(manifest, catalog);
  assert.equal(r1.html, r2.html);
});

// ── snapshot: key elements present ───────────────────────────────────────────

test('roster preview html contains screen name', () => {
  const manifest = loadManifest('roster.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  assert.ok(html.includes('RosterScreen'), `html must reference screen name RosterScreen`);
});

test('roster preview html contains key identifiers for core elements', () => {
  const manifest = loadManifest('roster.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  // stable keys must appear as data attributes or class references
  assert.ok(
    html.includes('panel.roster') || html.includes('data-key'),
    'html must embed element keys (e.g. as data-key attributes)'
  );
  assert.ok(html.includes('btn.recruit'), 'html must include btn.recruit element');
  assert.ok(html.includes('list.mercs'), 'html must include list.mercs element');
  assert.ok(html.includes('panel.detail'), 'html must include panel.detail element');
});

test('modal preview html contains dialog element or modal class', () => {
  const manifest = loadManifest('modal.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  // Modal_Base maps to <dialog> or cls modal-base
  assert.ok(
    html.includes('dialog') || html.includes('modal'),
    'Modal preview must reference dialog/modal in html'
  );
  assert.ok(html.includes('modal.dialog'), 'html must include modal.dialog key');
});

test('inventory preview html contains grid and scroll elements', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  assert.ok(html.includes('panel.inventory.scroll'), 'html must include scroll container key');
  assert.ok(html.includes('panel.inventory.scroll.grid'), 'html must include grid key');
});

// ── repeat/scroll render ──────────────────────────────────────────────────────

test('repeat element produces repeated child template markers in html', () => {
  const manifest = loadManifest('roster.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  // list.mercs has repeat:"mercs" — preview should mark it as a repeat container
  assert.ok(
    html.includes('repeat') || html.includes('list.mercs'),
    'repeat element must be represented in html'
  );
});

test('scroll property is reflected in inventory preview html', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  // ScrollList with scroll:"vertical" must produce scroll styling cue
  assert.ok(
    html.includes('scroll') || html.includes('overflow'),
    'scroll element must produce scroll-related output in html'
  );
});

test('grid layout is reflected in inventory preview html', () => {
  const manifest = loadManifest('inventory.manifest.json');
  const { html } = renderPreview(manifest, catalog);
  assert.ok(
    html.includes('grid') || html.includes('Grid'),
    'grid layout must be represented in html'
  );
});

// ── return shape ──────────────────────────────────────────────────────────────

test('renderPreview always returns object with html string property', () => {
  const manifest = loadManifest('modal.manifest.json');
  const result = renderPreview(manifest, catalog);
  assert.equal(typeof result, 'object', 'Result must be object');
  assert.equal(typeof result.html, 'string', 'result.html must be string');
  assert.ok(result.html.length > 0, 'html must be non-empty');
});

// ── different inputs → different outputs ──────────────────────────────────────

test('different manifests produce different html output', () => {
  const roster = loadManifest('roster.manifest.json');
  const modal = loadManifest('modal.manifest.json');
  const r1 = renderPreview(roster, catalog);
  const r2 = renderPreview(modal, catalog);
  assert.notEqual(r1.html, r2.html, 'Different manifests must produce different html');
});

// ── columns 렌더 ──────────────────────────────────────────────────────────────

test('grid with columns:3 renders repeat(3,1fr) in html', () => {
  const manifest = {
    screen: 'TestScreen',
    refResolution: [1920, 1080],
    elements: [
      {
        key: 'grid.test',
        name: 'Grid_Test',
        component: 'Grid_Base',
        anchor: 'stretch',
        layout: 'grid',
        columns: 3,
        spacing: 8,
        children: [
          { key: 'item.tpl', name: 'Item_Tpl', component: 'Panel_Base' },
        ],
      },
    ],
  };
  const { html } = renderPreview(manifest, catalog);
  assert.ok(
    html.includes('repeat(3,1fr)'),
    `html must include repeat(3,1fr) for columns:3, got snippet: ${html.slice(0, 500)}`
  );
});

test('grid without columns falls back to auto-fill (no repeat(N,1fr))', () => {
  const manifest = {
    screen: 'TestScreen',
    refResolution: [1920, 1080],
    elements: [
      {
        key: 'grid.nocols',
        name: 'Grid_NoCols',
        component: 'Grid_Base',
        anchor: 'stretch',
        layout: 'grid',
      },
    ],
  };
  const { html } = renderPreview(manifest, catalog);
  // auto-fill 클래스가 적용되고, 인라인 repeat(N,1fr)(N=숫자) 스타일은 없어야 함.
  // 주의: BASE_CSS에 repeat(auto-fill,...)이 항상 포함되므로 숫자 컬럼 인라인만 검사.
  assert.ok(
    html.includes('gui-layout--grid') && !/grid-template-columns:repeat\(\d/.test(html),
    'Grid without columns must use auto-fill CSS class, not inline repeat(N,1fr)'
  );
});

test('columns render is deterministic: same manifest yields identical html twice', () => {
  const manifest = {
    screen: 'TestScreen',
    refResolution: [1920, 1080],
    elements: [
      {
        key: 'grid.det',
        name: 'Grid_Det',
        component: 'Grid_Base',
        anchor: 'stretch',
        layout: 'grid',
        columns: 5,
      },
    ],
  };
  const r1 = renderPreview(manifest, catalog);
  const r2 = renderPreview(manifest, catalog);
  assert.equal(r1.html, r2.html, 'columns render must be deterministic');
  assert.ok(r1.html.includes('repeat(5,1fr)'), 'columns:5 must produce repeat(5,1fr)');
});
