/**
 * validate-prefab-spec.mjs
 * Game UI Studio — 베이스 프리팹 스펙 검증 코어
 * ESM, Node>=18, 외부 의존성 0.
 *
 * export function validatePrefabSpec(spec) → { ok, errors:[{code, prefab, message}] }
 * CLI: argv[2]=스펙경로(없으면 stdin), 유효=exit 0, 무효=exit 2.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ─── 거부 코드 ───────────────────────────────────────────────────────────────
const CODES = {
  PREFAB_SCHEMA_VIOLATION: 'PREFAB_SCHEMA_VIOLATION',
  PREFAB_MISSING_KIND:     'PREFAB_MISSING_KIND',
  PREFAB_BAD_KIND:         'PREFAB_BAD_KIND',
  PREFAB_MISSING_SOURCE:   'PREFAB_MISSING_SOURCE',
  PREFAB_BAD_SAVE_PATH:    'PREFAB_BAD_SAVE_PATH',
  PREFAB_BAD_NINESLICE:    'PREFAB_BAD_NINESLICE',
  PREFAB_BAD_IMPORT:       'PREFAB_BAD_IMPORT',
};

const VALID_KINDS = new Set(['button', 'panel', 'scroll', 'grid', 'modal', 'text', 'slot']);
const SAVE_PATH_RE = /^Assets\/.*\.prefab$/;
const FILTER_MODE_ENUM = new Set(['Point', 'Bilinear', 'Trilinear']);
const COMPRESSION_ENUM = new Set(['None', 'LowQuality', 'NormalQuality', 'HighQuality']);

// 허용 최상위 필드 (additionalProperties:false)
const ENTRY_ALLOWED = new Set([
  'kind', 'sourceSprite', 'savePath', 'import', 'nineSlice', 'atlas', 'hierarchy', 'overridable',
]);

// import 허용 필드
const IMPORT_ALLOWED = new Set([
  'textureType', 'spriteMode', 'pixelsPerUnit', 'filterMode', 'compression', 'generateMipMaps',
]);

/**
 * 순수 검증 함수.
 * @param {unknown} spec - 파싱된 프리팹 스펙 객체 (임의 타입 허용)
 * @returns {{ ok: boolean, errors: Array<{ code: string, prefab: string|null, message: string }> }}
 */
export function validatePrefabSpec(spec) {
  const errors = [];

  function err(code, prefab, message) {
    errors.push({ code, prefab: prefab ?? null, message });
  }

  // ── 1. 최상위 타입 체크 ──────────────────────────────────────────────────
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    err(CODES.PREFAB_SCHEMA_VIOLATION, null, 'prefab spec must be a non-null object');
    return { ok: false, errors };
  }

  // ── 2. 각 프리팹 항목 검증 ───────────────────────────────────────────────
  for (const [name, entry] of Object.entries(spec)) {
    // 2-a. 항목 자체가 객체여야 함
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      err(CODES.PREFAB_SCHEMA_VIOLATION, name, `prefab "${name}" entry must be an object`);
      continue;
    }

    // 2-b. 알 수 없는 필드 거부
    for (const field of Object.keys(entry)) {
      if (!ENTRY_ALLOWED.has(field)) {
        err(CODES.PREFAB_SCHEMA_VIOLATION, name, `unknown field "${field}" in prefab "${name}"`);
      }
    }

    // 2-c. kind 필수 + enum
    if (!('kind' in entry)) {
      err(CODES.PREFAB_MISSING_KIND, name, `prefab "${name}" is missing required field "kind"`);
    } else if (typeof entry.kind !== 'string') {
      err(CODES.PREFAB_SCHEMA_VIOLATION, name, `prefab "${name}" kind must be a string`);
    } else if (!VALID_KINDS.has(entry.kind)) {
      err(CODES.PREFAB_BAD_KIND, name, `prefab "${name}" kind "${entry.kind}" must be one of: ${[...VALID_KINDS].join(', ')}`);
    }

    // 2-d. sourceSprite 필수 string
    if (!('sourceSprite' in entry)) {
      err(CODES.PREFAB_MISSING_SOURCE, name, `prefab "${name}" is missing required field "sourceSprite"`);
    } else if (typeof entry.sourceSprite !== 'string') {
      err(CODES.PREFAB_SCHEMA_VIOLATION, name, `prefab "${name}" sourceSprite must be a string`);
    }

    // 2-e. savePath 필수 + 패턴
    if (!('savePath' in entry)) {
      err(CODES.PREFAB_BAD_SAVE_PATH, name, `prefab "${name}" is missing required field "savePath"`);
    } else if (typeof entry.savePath !== 'string') {
      err(CODES.PREFAB_SCHEMA_VIOLATION, name, `prefab "${name}" savePath must be a string`);
    } else if (!SAVE_PATH_RE.test(entry.savePath)) {
      err(CODES.PREFAB_BAD_SAVE_PATH, name, `prefab "${name}" savePath "${entry.savePath}" does not match pattern ^Assets/.*\\.prefab$`);
    }

    // 2-f. nineSlice 검증 (있으면 border 4정수≥0)
    if ('nineSlice' in entry && entry.nineSlice !== null) {
      const ns = entry.nineSlice;
      if (typeof ns !== 'object' || Array.isArray(ns)) {
        err(CODES.PREFAB_BAD_NINESLICE, name, `prefab "${name}" nineSlice must be an object or null`);
      } else {
        const border = ns.border;
        if (!Array.isArray(border) || border.length !== 4) {
          err(CODES.PREFAB_BAD_NINESLICE, name, `prefab "${name}" nineSlice.border must be an array of exactly 4 integers`);
        } else {
          for (let i = 0; i < 4; i++) {
            if (!Number.isInteger(border[i]) || border[i] < 0) {
              err(CODES.PREFAB_BAD_NINESLICE, name, `prefab "${name}" nineSlice.border[${i}] must be a non-negative integer, got ${border[i]}`);
            }
          }
        }
      }
    }

    // 2-g. import 검증 (있으면 filterMode·compression enum 확인)
    if ('import' in entry) {
      const imp = entry.import;
      if (imp === null || typeof imp !== 'object' || Array.isArray(imp)) {
        err(CODES.PREFAB_BAD_IMPORT, name, `prefab "${name}" import must be an object`);
      } else {
        // 알 수 없는 필드 거부
        for (const field of Object.keys(imp)) {
          if (!IMPORT_ALLOWED.has(field)) {
            err(CODES.PREFAB_BAD_IMPORT, name, `unknown field "${field}" in prefab "${name}" import`);
          }
        }

        if ('filterMode' in imp && !FILTER_MODE_ENUM.has(imp.filterMode)) {
          err(CODES.PREFAB_BAD_IMPORT, name, `prefab "${name}" import.filterMode "${imp.filterMode}" must be one of: ${[...FILTER_MODE_ENUM].join(', ')}`);
        }

        if ('compression' in imp && !COMPRESSION_ENUM.has(imp.compression)) {
          err(CODES.PREFAB_BAD_IMPORT, name, `prefab "${name}" import.compression "${imp.compression}" must be one of: ${[...COMPRESSION_ENUM].join(', ')}`);
        }

        if ('pixelsPerUnit' in imp) {
          if (typeof imp.pixelsPerUnit !== 'number' || imp.pixelsPerUnit < 1) {
            err(CODES.PREFAB_BAD_IMPORT, name, `prefab "${name}" import.pixelsPerUnit must be a number >= 1, got ${imp.pixelsPerUnit}`);
          }
        }

        if ('generateMipMaps' in imp && typeof imp.generateMipMaps !== 'boolean') {
          err(CODES.PREFAB_BAD_IMPORT, name, `prefab "${name}" import.generateMipMaps must be a boolean`);
        }
      }
    }

    // 2-h. overridable 배열 여부
    if ('overridable' in entry) {
      if (!Array.isArray(entry.overridable)) {
        err(CODES.PREFAB_SCHEMA_VIOLATION, name, `prefab "${name}" overridable must be an array`);
      } else {
        for (let i = 0; i < entry.overridable.length; i++) {
          if (typeof entry.overridable[i] !== 'string') {
            err(CODES.PREFAB_SCHEMA_VIOLATION, name, `prefab "${name}" overridable[${i}] must be a string`);
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
    let specText;

    if (process.argv[2]) {
      specText = readFileSync(process.argv[2], 'utf8');
    } else {
      // stdin
      const chunks = [];
      for await (const chunk of process.stdin) chunks.push(chunk);
      specText = Buffer.concat(chunks).toString('utf8');
    }

    let spec;
    try {
      spec = JSON.parse(specText);
    } catch (e) {
      process.stdout.write(JSON.stringify({
        ok: false,
        errors: [{ code: CODES.PREFAB_SCHEMA_VIOLATION, prefab: null, message: `JSON parse error: ${e.message}` }],
      }, null, 2) + '\n');
      process.exit(2);
    }

    const result = validatePrefabSpec(spec);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.ok ? 0 : 2);
  })();
}
