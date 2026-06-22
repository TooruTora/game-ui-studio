/**
 * merge-planner.mjs
 * Quartermaster v0.3 — 머지 플래너 (add/override 계획, remove 없음 — M4 범위)
 * ESM, Node>=18, 외부 의존성 0.
 * 멱등·결정적: 동일 매니페스트 2회 → 두번째 ops 빈배열.
 *
 * export function planMerge(existingTree, manifest) → { ops: [{ type, key, ... }] }
 * export function flattenManifest(manifest) → [{ key, managedFields }]
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// 머지 플래너가 관리하는 필드 (CONTRACT.md 관리 오버라이드 필드)
const MANAGED_FIELD_NAMES = [
  'anchor', 'margin', 'layout', 'spacing', 'columns',
  'width', 'height', 'label', 'iconSlot',
];

/**
 * 매니페스트를 평탄화해 { key, managedFields } 배열 반환.
 * managedFields: { fieldName → value } (존재하는 필드만 포함)
 *
 * @param {object} manifest - 파싱된 매니페스트
 * @returns {Array<{ key: string, managedFields: object }>}
 */
export function flattenManifest(manifest) {
  const result = [];
  if (!manifest || !Array.isArray(manifest.elements)) return result;
  for (const el of manifest.elements) {
    flattenElement(el, result);
  }
  return result;
}

function flattenElement(el, result) {
  if (!el || typeof el !== 'object') return;
  const managedFields = {};
  for (const f of MANAGED_FIELD_NAMES) {
    if (f in el) managedFields[f] = el[f];
  }
  result.push({ key: el.key, managedFields });
  if (Array.isArray(el.children)) {
    for (const child of el.children) {
      flattenElement(child, result);
    }
  }
}

/**
 * 두 managedFields 객체가 동일한지 비교 (결정적 JSON 비교).
 */
function managedFieldsEqual(a, b) {
  // 두 객체의 키 집합 동일 + 값 동일 (deep equal via JSON — 값은 단순 스칼라/배열)
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i++) {
    if (keysA[i] !== keysB[i]) return false;
  }
  // 값 비교 (JSON 직렬화로 결정적 비교)
  for (const k of keysA) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}

/**
 * 머지 계획 생성.
 *
 * @param {object|null} existingTree
 *   {key→node} 맵 형태. node는 { key, managedFields } 형태.
 *   없거나 null이면 전부 add.
 * @param {object} manifest - 파싱된 매니페스트
 * @returns {{ ops: Array<{ type: 'add'|'override', key: string, managedFields: object, [prev]: object }> }}
 */
export function planMerge(existingTree, manifest) {
  const ops = [];
  const flat = flattenManifest(manifest);
  const tree = existingTree && typeof existingTree === 'object' ? existingTree : {};

  for (const { key, managedFields } of flat) {
    if (!(key in tree)) {
      // 신규 → add
      ops.push({ type: 'add', key, managedFields });
    } else {
      // 기존 → 관리 필드 변경 여부 비교.
      // 기존 노드는 두 형태를 모두 지원: (1) { managedFields:{...} } 사전정규화 형태,
      // (2) 관리필드가 최상위에 있는 raw 노드(프리팹 트리에서 읽은 자연 형태).
      // 후자는 매니페스트 element와 동일하게 MANAGED_FIELD_NAMES로 추출(대칭).
      const existing = tree[key];
      let existingFields;
      if (existing && typeof existing === 'object' && existing.managedFields) {
        existingFields = existing.managedFields;
      } else if (existing && typeof existing === 'object') {
        existingFields = {};
        for (const f of MANAGED_FIELD_NAMES) {
          if (f in existing) existingFields[f] = existing[f];
        }
      } else {
        existingFields = {};
      }
      if (!managedFieldsEqual(managedFields, existingFields)) {
        ops.push({ type: 'override', key, managedFields, prev: existingFields });
      }
      // 동일하면 ops에 추가하지 않음 (멱등)
    }
  }

  return { ops };
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifestPath = process.argv[2];
  const existingPath = process.argv[3];
  if (!manifestPath) {
    process.stderr.write('Usage: node merge-planner.mjs <manifest.json> [existingTree.json]\n');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let existingTree = null;
  if (existingPath) {
    existingTree = JSON.parse(readFileSync(existingPath, 'utf8'));
  }
  const result = planMerge(existingTree, manifest);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
