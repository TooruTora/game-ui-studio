/**
 * validate-manifest.mjs
 * Quartermaster v0.3 — 매니페스트 검증 코어 (L2/L3 SSOT)
 * ESM, Node>=18, 외부 의존성 0.
 *
 * export function validateManifest(manifest, catalog) → { ok, errors: [{ code, key, message }] }
 * CLI: argv[2]=매니페스트경로(없으면 stdin), argv[3]=카탈로그경로(선택). 유효=exit 0, 무효=exit 2.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// ─── 거부 코드 ───────────────────────────────────────────────────────────────
const CODES = {
  SCHEMA_VIOLATION:          'SCHEMA_VIOLATION',
  CATALOG_UNKNOWN_COMPONENT: 'CATALOG_UNKNOWN_COMPONENT',
  DUPLICATE_KEY:             'DUPLICATE_KEY',
  MISSING_REQUIRED:          'MISSING_REQUIRED',
  OVERRIDABLE_VIOLATION:     'OVERRIDABLE_VIOLATION',
  INVALID_KEY_FORMAT:        'INVALID_KEY_FORMAT',
};

// key 형식 정규식 (CONTRACT.md (i))
const KEY_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/;

// 매니페스트 최상위 필수 필드
const TOP_REQUIRED = ['screen', 'refResolution', 'elements'];

// element 필수 필드
const ELEM_REQUIRED = ['key', 'name', 'component'];

// element의 허용 필드 (schema additionalProperties:false)
const ELEM_ALLOWED = new Set([
  'key', 'name', 'component',
  'anchor', 'margin', 'layout', 'spacing', 'columns',
  'width', 'height', 'label', 'iconSlot',
  'scroll', 'repeat', 'children',
]);

// 매니페스트 최상위 허용 필드
const TOP_ALLOWED = new Set(['schemaVersion', 'screen', 'refResolution', 'elements']);

const ANCHOR_ENUM = new Set(['stretch','top','bottom','left','right','center','top-left','top-right','bottom-left','bottom-right']);
const LAYOUT_ENUM = new Set(['vertical','horizontal','grid','none']);
const SCROLL_ENUM = new Set(['vertical','horizontal','both','none']);

// 관리 오버라이드 필드 (머지플래너가 재적용하는 전체 관리 필드)
const MANAGED_FIELDS = new Set(['anchor','margin','layout','spacing','columns','width','height','label','iconSlot']);

// 콘텐츠 오버라이드 필드 (카탈로그 overridable 목록으로 게이팅되는 부품별 값).
// 구조적 레이아웃 필드(anchor/margin/layout/spacing/width/height/scroll/repeat)는
// 양 소비자가 공통 이해하는 보편 속성이므로 overridable 게이팅 대상이 아니다 (CONTRACT.md).
const CONTENT_OVERRIDE_FIELDS = new Set(['label','iconSlot']);

/**
 * 순수 검증 함수.
 * @param {object} manifest - 파싱된 매니페스트 객체
 * @param {object|null} catalog - 파싱된 카탈로그 객체 (없으면 null/undefined)
 * @returns {{ ok: boolean, errors: Array<{ code: string, key: string|null, message: string }> }}
 */
export function validateManifest(manifest, catalog) {
  const errors = [];

  function err(code, key, message) {
    errors.push({ code, key: key ?? null, message });
  }

  // ── 1. 최상위 타입 체크 ──────────────────────────────────────────────────
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    err(CODES.SCHEMA_VIOLATION, null, 'manifest must be an object');
    return { ok: false, errors };
  }

  // ── 2. 추가 속성 검사 (최상위) ──────────────────────────────────────────
  for (const k of Object.keys(manifest)) {
    if (!TOP_ALLOWED.has(k)) {
      err(CODES.SCHEMA_VIOLATION, null, `unknown top-level field: "${k}"`);
    }
  }

  // ── 3. 필수 필드 ────────────────────────────────────────────────────────
  for (const f of TOP_REQUIRED) {
    if (!(f in manifest)) {
      err(CODES.MISSING_REQUIRED, null, `missing required field: "${f}"`);
    }
  }

  // ── 4. screen 검증 ──────────────────────────────────────────────────────
  if ('screen' in manifest) {
    if (typeof manifest.screen !== 'string') {
      err(CODES.SCHEMA_VIOLATION, null, 'screen must be a string');
    } else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(manifest.screen)) {
      err(CODES.SCHEMA_VIOLATION, null, `screen "${manifest.screen}" does not match pattern ^[A-Za-z][A-Za-z0-9_]*$`);
    }
  }

  // ── 5. refResolution 검증 ───────────────────────────────────────────────
  if ('refResolution' in manifest) {
    const rr = manifest.refResolution;
    if (!Array.isArray(rr) || rr.length !== 2) {
      err(CODES.SCHEMA_VIOLATION, null, 'refResolution must be an array of exactly 2 integers');
    } else {
      for (let i = 0; i < 2; i++) {
        if (!Number.isInteger(rr[i]) || rr[i] < 1) {
          err(CODES.SCHEMA_VIOLATION, null, `refResolution[${i}] must be an integer >= 1, got ${rr[i]}`);
        }
      }
    }
  }

  // ── 6. schemaVersion 검증 ───────────────────────────────────────────────
  if ('schemaVersion' in manifest) {
    if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) {
      err(CODES.SCHEMA_VIOLATION, null, `schemaVersion must be an integer >= 1, got ${manifest.schemaVersion}`);
    }
  }

  // ── 7. elements 배열 검증 (재귀) ────────────────────────────────────────
  const seenKeys = new Set();

  if ('elements' in manifest) {
    if (!Array.isArray(manifest.elements)) {
      err(CODES.SCHEMA_VIOLATION, null, 'elements must be an array');
    } else {
      for (const el of manifest.elements) {
        validateElement(el, catalog, errors, seenKeys);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * 단일 element 재귀 검증 (children 포함).
 */
function validateElement(el, catalog, errors, seenKeys) {
  function err(code, key, message) {
    errors.push({ code, key: key ?? null, message });
  }

  if (el === null || typeof el !== 'object' || Array.isArray(el)) {
    err(CODES.SCHEMA_VIOLATION, null, 'element must be an object');
    return;
  }

  // 추가 속성 검사
  for (const k of Object.keys(el)) {
    if (!ELEM_ALLOWED.has(k)) {
      err(CODES.SCHEMA_VIOLATION, el.key ?? null, `unknown field "${k}" in element`);
    }
  }

  // 필수 필드
  for (const f of ELEM_REQUIRED) {
    if (!(f in el)) {
      err(CODES.MISSING_REQUIRED, el.key ?? null, `element missing required field: "${f}"`);
    }
  }

  const elKey = typeof el.key === 'string' ? el.key : null;

  // key 형식
  if ('key' in el) {
    if (typeof el.key !== 'string') {
      err(CODES.SCHEMA_VIOLATION, elKey, 'element key must be a string');
    } else {
      if (!KEY_RE.test(el.key)) {
        err(CODES.INVALID_KEY_FORMAT, el.key, `key "${el.key}" does not match pattern ^[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)*$`);
      }
      // 중복 key 검사 (전체 트리)
      if (seenKeys.has(el.key)) {
        err(CODES.DUPLICATE_KEY, el.key, `duplicate key "${el.key}" in manifest tree`);
      } else {
        seenKeys.add(el.key);
      }
    }
  }

  // name 검증
  if ('name' in el) {
    if (typeof el.name !== 'string') {
      err(CODES.SCHEMA_VIOLATION, elKey, 'element name must be a string');
    } else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(el.name)) {
      err(CODES.SCHEMA_VIOLATION, elKey, `name "${el.name}" does not match pattern ^[A-Za-z][A-Za-z0-9_]*$`);
    }
  }

  // component 검증
  if ('component' in el) {
    if (typeof el.component !== 'string') {
      err(CODES.SCHEMA_VIOLATION, elKey, 'element component must be a string');
    } else {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(el.component)) {
        err(CODES.SCHEMA_VIOLATION, elKey, `component "${el.component}" does not match pattern ^[A-Za-z][A-Za-z0-9_]*$`);
      }
      // 카탈로그 검사
      if (catalog && typeof catalog === 'object') {
        if (!(el.component in catalog)) {
          err(CODES.CATALOG_UNKNOWN_COMPONENT, elKey, `component "${el.component}" not found in catalog`);
        } else {
          // overridable 위반: 매니페스트에 오버라이드 필드가 있는데 카탈로그 overridable 목록에 없으면 위반
          const entry = catalog[el.component];
          const allowed = Array.isArray(entry.overridable) ? new Set(entry.overridable) : null;
          if (allowed !== null) {
            for (const mf of CONTENT_OVERRIDE_FIELDS) {
              if (mf in el && !allowed.has(mf)) {
                err(CODES.OVERRIDABLE_VIOLATION, elKey, `field "${mf}" is not overridable for component "${el.component}"`);
              }
            }
          }
        }
      }
    }
  }

  // anchor enum
  if ('anchor' in el) {
    if (typeof el.anchor !== 'string' || !ANCHOR_ENUM.has(el.anchor)) {
      err(CODES.SCHEMA_VIOLATION, elKey, `anchor "${el.anchor}" must be one of: ${[...ANCHOR_ENUM].join(', ')}`);
    }
  }

  // margin
  if ('margin' in el) {
    const m = el.margin;
    if (!Array.isArray(m) || m.length !== 4) {
      err(CODES.SCHEMA_VIOLATION, elKey, 'margin must be an array of exactly 4 numbers');
    } else {
      for (let i = 0; i < 4; i++) {
        if (typeof m[i] !== 'number') {
          err(CODES.SCHEMA_VIOLATION, elKey, `margin[${i}] must be a number, got ${typeof m[i]}`);
        }
      }
    }
  }

  // layout enum
  if ('layout' in el) {
    if (typeof el.layout !== 'string' || !LAYOUT_ENUM.has(el.layout)) {
      err(CODES.SCHEMA_VIOLATION, elKey, `layout "${el.layout}" must be one of: ${[...LAYOUT_ENUM].join(', ')}`);
    }
  }

  // spacing
  if ('spacing' in el) {
    if (typeof el.spacing !== 'number' || el.spacing < 0) {
      err(CODES.SCHEMA_VIOLATION, elKey, `spacing must be a number >= 0, got ${el.spacing}`);
    }
  }

  // columns (grid 레이아웃 열 개수)
  if ('columns' in el) {
    if (!Number.isInteger(el.columns) || el.columns < 1) {
      err(CODES.SCHEMA_VIOLATION, elKey, `columns must be an integer >= 1, got ${el.columns}`);
    }
  }

  // width
  if ('width' in el) {
    if (typeof el.width !== 'number' || el.width < 0) {
      err(CODES.SCHEMA_VIOLATION, elKey, `width must be a number >= 0, got ${el.width}`);
    }
  }

  // height
  if ('height' in el) {
    if (typeof el.height !== 'number' || el.height < 0) {
      err(CODES.SCHEMA_VIOLATION, elKey, `height must be a number >= 0, got ${el.height}`);
    }
  }

  // label
  if ('label' in el && typeof el.label !== 'string') {
    err(CODES.SCHEMA_VIOLATION, elKey, 'label must be a string');
  }

  // iconSlot
  if ('iconSlot' in el && typeof el.iconSlot !== 'string') {
    err(CODES.SCHEMA_VIOLATION, elKey, 'iconSlot must be a string');
  }

  // scroll enum
  if ('scroll' in el) {
    if (typeof el.scroll !== 'string' || !SCROLL_ENUM.has(el.scroll)) {
      err(CODES.SCHEMA_VIOLATION, elKey, `scroll "${el.scroll}" must be one of: ${[...SCROLL_ENUM].join(', ')}`);
    }
  }

  // repeat: integer >= 0 or string
  if ('repeat' in el) {
    const r = el.repeat;
    const validInt = Number.isInteger(r) && r >= 0;
    const validStr = typeof r === 'string';
    if (!validInt && !validStr) {
      err(CODES.SCHEMA_VIOLATION, elKey, `repeat must be an integer >= 0 or a string, got ${typeof r}`);
    }
  }

  // children 재귀
  if ('children' in el) {
    if (!Array.isArray(el.children)) {
      err(CODES.SCHEMA_VIOLATION, elKey, 'children must be an array');
    } else {
      for (const child of el.children) {
        validateElement(child, catalog, errors, seenKeys);
      }
    }
  }
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    let manifestText;
    let catalogObj = null;

    // 매니페스트 읽기
    if (process.argv[2]) {
      manifestText = readFileSync(process.argv[2], 'utf8');
    } else {
      // stdin
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      // Write hook: stdin은 도구입력 JSON({ path, content }) 또는 raw 매니페스트 JSON
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      if (parsed && typeof parsed === 'object' && 'content' in parsed) {
        // Write hook 도구입력 형태: { path, content }
        manifestText = typeof parsed.content === 'string'
          ? parsed.content
          : JSON.stringify(parsed.content);
      } else {
        manifestText = raw;
      }
    }

    // 카탈로그 읽기 (선택)
    if (process.argv[3]) {
      try {
        catalogObj = JSON.parse(readFileSync(process.argv[3], 'utf8'));
      } catch (e) {
        process.stderr.write(`[validate-manifest] catalog parse error: ${e.message}\n`);
      }
    }

    let manifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch (e) {
      process.stdout.write(JSON.stringify({ ok: false, errors: [{ code: CODES.SCHEMA_VIOLATION, key: null, message: `JSON parse error: ${e.message}` }] }, null, 2) + '\n');
      process.exit(2);
    }

    const result = validateManifest(manifest, catalogObj);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.ok ? 0 : 2);
  })();
}
