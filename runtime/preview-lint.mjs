/**
 * preview-lint.mjs
 * Game UI Studio v0.3 — 매니페스트 레이아웃 깨짐 경고 (비차단 lint)
 * ESM, Node>=18, 외부 의존성 0.
 *
 * export function lintPreview(manifest, catalog) → { warnings: [{ code, key, message }] }
 * CLI: argv[2]=매니페스트경로, argv[3]=카탈로그경로(선택). 항상 exit 0(비차단).
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ─── 경고 코드 ───────────────────────────────────────────────────────────────
export const LINT_CODES = {
  LINT_UNKNOWN_COMPONENT:  'LINT_UNKNOWN_COMPONENT',
  LINT_FIXED_OVERFLOW:     'LINT_FIXED_OVERFLOW',
  LINT_REPEAT_NO_TEMPLATE: 'LINT_REPEAT_NO_TEMPLATE',
  LINT_GRID_NO_COLUMNS:    'LINT_GRID_NO_COLUMNS',
  LINT_MISSING_ANCHOR:     'LINT_MISSING_ANCHOR',
};

/**
 * 순수 lint 함수.
 * @param {object} manifest - 파싱된 매니페스트 객체
 * @param {object|null} catalog - 파싱된 카탈로그 객체 (없으면 null/undefined)
 * @returns {{ warnings: Array<{ code: string, key: string|null, message: string }> }}
 */
export function lintPreview(manifest, catalog) {
  const warnings = [];

  function warn(code, key, message) {
    warnings.push({ code, key: key ?? null, message });
  }

  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.elements)) {
    return { warnings };
  }

  // 최상위 elements 순회
  for (const el of manifest.elements) {
    lintElement(el, catalog, warn, true);
  }

  return { warnings };
}

/**
 * 단일 element 재귀 lint.
 * @param {object} el - element 객체
 * @param {object|null} catalog - 카탈로그
 * @param {Function} warn - warn(code, key, message)
 * @param {boolean} isTopLevel - 최상위 element 여부
 */
function lintElement(el, catalog, warn, isTopLevel) {
  if (!el || typeof el !== 'object') return;

  const key = typeof el.key === 'string' ? el.key : null;

  // LINT_UNKNOWN_COMPONENT: catalog가 주어졌는데 component가 미등재
  if (catalog && typeof catalog === 'object' && el.component) {
    if (!(el.component in catalog)) {
      warn(
        LINT_CODES.LINT_UNKNOWN_COMPONENT,
        key,
        `component "${el.component}" is not registered in catalog (preview may be degraded)`
      );
    }
  }

  // LINT_MISSING_ANCHOR: 최상위 element에 anchor 없음
  if (isTopLevel && !el.anchor) {
    warn(
      LINT_CODES.LINT_MISSING_ANCHOR,
      key,
      `top-level element "${key}" has no anchor — layout position is ambiguous`
    );
  }

  // LINT_GRID_NO_COLUMNS: layout=grid인데 columns 없음
  if (el.layout === 'grid' && el.columns === undefined) {
    warn(
      LINT_CODES.LINT_GRID_NO_COLUMNS,
      key,
      `element "${key}" has layout=grid but no columns — falling back to auto-fill`
    );
  }

  // LINT_REPEAT_NO_TEMPLATE: repeat 있는데 children이 비어있음
  if (el.repeat !== undefined) {
    const hasTemplate = Array.isArray(el.children) && el.children.length > 0;
    if (!hasTemplate) {
      warn(
        LINT_CODES.LINT_REPEAT_NO_TEMPLATE,
        key,
        `element "${key}" has repeat but no children template (children[0] is missing)`
      );
    }
  }

  // LINT_FIXED_OVERFLOW: 자식 고정 width/height 합이 부모 고정 치수 초과
  if (
    (el.width !== undefined || el.height !== undefined) &&
    Array.isArray(el.children) &&
    el.children.length > 0
  ) {
    const parentW = el.width;
    const parentH = el.height;

    // layout=vertical: 자식 height 합산
    if (el.layout === 'vertical' && parentH !== undefined) {
      let totalH = 0;
      let allFixed = true;
      for (const child of el.children) {
        if (child && child.height !== undefined) {
          totalH += child.height;
        } else {
          allFixed = false;
          break;
        }
      }
      if (allFixed && totalH > parentH) {
        warn(
          LINT_CODES.LINT_FIXED_OVERFLOW,
          key,
          `element "${key}" (height:${parentH}) children fixed height sum ${totalH} exceeds parent — overflow risk`
        );
      }
    }

    // layout=horizontal: 자식 width 합산
    if (el.layout === 'horizontal' && parentW !== undefined) {
      let totalW = 0;
      let allFixed = true;
      for (const child of el.children) {
        if (child && child.width !== undefined) {
          totalW += child.width;
        } else {
          allFixed = false;
          break;
        }
      }
      if (allFixed && totalW > parentW) {
        warn(
          LINT_CODES.LINT_FIXED_OVERFLOW,
          key,
          `element "${key}" (width:${parentW}) children fixed width sum ${totalW} exceeds parent — overflow risk`
        );
      }
    }
  }

  // 재귀: children
  if (Array.isArray(el.children)) {
    for (const child of el.children) {
      lintElement(child, catalog, warn, false);
    }
  }
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    process.stderr.write('Usage: node preview-lint.mjs <manifest.json> [catalog.json]\n');
    process.exit(0);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`[preview-lint] manifest parse error: ${e.message}\n`);
    process.exit(0);
  }

  let catalog = null;
  if (process.argv[3]) {
    try {
      catalog = JSON.parse(readFileSync(process.argv[3], 'utf8'));
    } catch (e) {
      process.stderr.write(`[preview-lint] catalog parse error: ${e.message}\n`);
    }
  }

  const { warnings } = lintPreview(manifest, catalog);

  if (warnings.length === 0) {
    process.stdout.write('[preview-lint] no warnings\n');
  } else {
    for (const w of warnings) {
      process.stdout.write(`[${w.code}] key=${w.key ?? '(root)'} — ${w.message}\n`);
    }
  }

  process.stderr.write(`[preview-lint] ${warnings.length} warning(s)\n`);
  process.exit(0);
}
