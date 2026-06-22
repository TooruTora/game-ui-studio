/**
 * validate-catalog.mjs
 * Quartermaster v0.3 — 카탈로그 검증 코어
 * ESM, Node>=18, 외부 의존성 0.
 *
 * export function validateCatalog(catalog) → { ok, errors: [{ code, component, message }] }
 * CLI: argv[2]=카탈로그경로(없으면 stdin), 유효=exit 0, 무효=exit 2.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ─── 거부 코드 ───────────────────────────────────────────────────────────────
const CODES = {
  CATALOG_SCHEMA_VIOLATION:    'CATALOG_SCHEMA_VIOLATION',
  CATALOG_MISSING_UNITY:       'CATALOG_MISSING_UNITY',
  CATALOG_BAD_UNITY_PATH:      'CATALOG_BAD_UNITY_PATH',
  CATALOG_MISSING_PREVIEW_EL:  'CATALOG_MISSING_PREVIEW_EL',
};

// unity 경로 패턴 (catalog.schema.json 기준)
const UNITY_RE = /^Assets\/.*\.prefab$/;

// 카탈로그 항목 허용 최상위 필드
const ENTRY_ALLOWED = new Set(['preview', 'unity', 'overridable']);

/**
 * 순수 검증 함수.
 * @param {unknown} catalog - 파싱된 카탈로그 객체 (임의 타입 허용)
 * @returns {{ ok: boolean, errors: Array<{ code: string, component: string|null, message: string }> }}
 */
export function validateCatalog(catalog) {
  const errors = [];

  function err(code, component, message) {
    errors.push({ code, component: component ?? null, message });
  }

  // ── 1. 최상위 타입 체크 ──────────────────────────────────────────────────
  if (catalog === null || typeof catalog !== 'object' || Array.isArray(catalog)) {
    err(CODES.CATALOG_SCHEMA_VIOLATION, null, 'catalog must be a non-null object');
    return { ok: false, errors };
  }

  // ── 2. 각 컴포넌트 항목 검증 ─────────────────────────────────────────────
  for (const [component, entry] of Object.entries(catalog)) {
    // 2-a. 항목 자체가 객체여야 함
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      err(CODES.CATALOG_SCHEMA_VIOLATION, component, `component "${component}" entry must be an object`);
      continue;
    }

    // 2-b. 알 수 없는 최상위 필드 거부
    for (const field of Object.keys(entry)) {
      if (!ENTRY_ALLOWED.has(field)) {
        err(CODES.CATALOG_SCHEMA_VIOLATION, component, `unknown field "${field}" in component "${component}"`);
      }
    }

    // 2-c. unity 필수
    if (!('unity' in entry)) {
      err(CODES.CATALOG_MISSING_UNITY, component, `component "${component}" is missing required field "unity"`);
    } else if (typeof entry.unity !== 'string') {
      err(CODES.CATALOG_SCHEMA_VIOLATION, component, `component "${component}" unity must be a string`);
    } else if (!UNITY_RE.test(entry.unity)) {
      // 2-d. unity 경로 패턴
      err(CODES.CATALOG_BAD_UNITY_PATH, component, `component "${component}" unity path "${entry.unity}" does not match pattern ^Assets/.*\\.prefab$`);
    }

    // 2-e. preview.el 필수 (preview 필드가 있는 경우)
    if ('preview' in entry) {
      const preview = entry.preview;
      if (preview === null || typeof preview !== 'object' || Array.isArray(preview)) {
        err(CODES.CATALOG_SCHEMA_VIOLATION, component, `component "${component}" preview must be an object`);
      } else if (!('el' in preview)) {
        err(CODES.CATALOG_MISSING_PREVIEW_EL, component, `component "${component}" preview is missing required field "el"`);
      } else if (typeof preview.el !== 'string') {
        err(CODES.CATALOG_SCHEMA_VIOLATION, component, `component "${component}" preview.el must be a string`);
      }
    }

    // 2-f. overridable 배열 여부
    if ('overridable' in entry) {
      if (!Array.isArray(entry.overridable)) {
        err(CODES.CATALOG_SCHEMA_VIOLATION, component, `component "${component}" overridable must be an array`);
      } else {
        for (let i = 0; i < entry.overridable.length; i++) {
          if (typeof entry.overridable[i] !== 'string') {
            err(CODES.CATALOG_SCHEMA_VIOLATION, component, `component "${component}" overridable[${i}] must be a string`);
          }
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    let catalogText;

    // 카탈로그 읽기
    if (process.argv[2]) {
      catalogText = readFileSync(process.argv[2], 'utf8');
    } else {
      // stdin
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      catalogText = Buffer.concat(chunks).toString('utf8');
    }

    let catalog;
    try {
      catalog = JSON.parse(catalogText);
    } catch (e) {
      process.stdout.write(JSON.stringify({
        ok: false,
        errors: [{ code: CODES.CATALOG_SCHEMA_VIOLATION, component: null, message: `JSON parse error: ${e.message}` }],
      }, null, 2) + '\n');
      process.exit(2);
    }

    const result = validateCatalog(catalog);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.ok ? 0 : 2);
  })();
}
