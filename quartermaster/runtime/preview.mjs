/**
 * preview.mjs
 * Quartermaster v0.3 — 매니페스트 → HTML 프리뷰 렌더러
 * ESM, Node>=18, 외부 의존성 0.
 * 순수·결정적: 동일 입력 → 동일 출력. 시간/랜덤 사용 금지.
 *
 * export function renderPreview(manifest, catalog) → { html: string }
 * CLI: argv[2]=매니페스트경로 → stdout에 HTML
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ─── CSS 인라인 (자기완결 HTML) ───────────────────────────────────────────────
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;padding:16px}
.qm-canvas{position:relative;background:#16213e;border:1px solid #0f3460;margin:0 auto}
.qm-el{position:relative;display:flex;flex-direction:column}
.qm-el--stretch{align-self:stretch;flex:1 1 auto}
.qm-el--top{align-self:flex-start;justify-content:flex-start}
.qm-el--bottom{align-self:flex-end;justify-content:flex-end}
.qm-el--left{justify-content:flex-start;align-items:flex-start}
.qm-el--right{justify-content:flex-end;align-items:flex-end}
.qm-el--center{align-self:center;justify-content:center;align-items:center}
.qm-el--top-left{justify-content:flex-start;align-items:flex-start}
.qm-el--top-right{justify-content:flex-start;align-items:flex-end}
.qm-el--bottom-left{justify-content:flex-end;align-items:flex-start}
.qm-el--bottom-right{justify-content:flex-end;align-items:flex-end}
.qm-layout--vertical{flex-direction:column}
.qm-layout--horizontal{flex-direction:row;flex-wrap:wrap}
.qm-layout--grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr))}
.qm-layout--grid-cols{display:grid}
.qm-layout--none{display:block}
.qm-scroll{overflow:auto}
.qm-scroll--vertical{overflow-y:auto;overflow-x:hidden}
.qm-scroll--horizontal{overflow-x:auto;overflow-y:hidden}
.qm-scroll--both{overflow:auto}
.qm-repeat-badge{font-size:10px;background:#0f3460;color:#e94560;border-radius:3px;padding:1px 4px;margin-bottom:4px;display:inline-block}
.qm-label{font-size:12px;padding:4px 8px;background:#0f3460;border-radius:3px;margin-top:2px}
.qm-icon-slot{font-size:10px;color:#a0a0b0;padding:2px 4px}
.qm-key{font-size:9px;color:#555;position:absolute;top:2px;left:2px;pointer-events:none;z-index:10}
.qm-component-tag{font-size:10px;background:#e94560;color:#fff;border-radius:2px;padding:1px 4px;display:inline-block;margin-bottom:2px}
.qm-el-inner{border:1px dashed #0f3460;border-radius:4px;padding:6px;position:relative;min-height:24px;min-width:40px}
button.qm-el-inner{cursor:default;background:#1a4a7a}
input.qm-el-inner{background:#0d2137;border-style:solid}
.qm-repeat-item{border:1px dotted #334;border-radius:3px;padding:4px;margin:2px}
`;

// ─── 앵커 → CSS 클래스 매핑 ──────────────────────────────────────────────────
const ANCHOR_CLASS = {
  stretch:      'qm-el--stretch',
  top:          'qm-el--top',
  bottom:       'qm-el--bottom',
  left:         'qm-el--left',
  right:        'qm-el--right',
  center:       'qm-el--center',
  'top-left':   'qm-el--top-left',
  'top-right':  'qm-el--top-right',
  'bottom-left':'qm-el--bottom-left',
  'bottom-right':'qm-el--bottom-right',
};

// HTML 이스케이프 (결정적)
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * element 하나를 HTML 문자열로 렌더링 (재귀).
 */
function renderElement(el, catalog) {
  // 카탈로그에서 preview 정보 조회
  const catEntry = catalog && catalog[el.component];
  const preview = catEntry && catEntry.preview;
  const htmlTag = (preview && preview.el) || 'div';
  const extraCls = (preview && preview.cls) ? ` ${esc(preview.cls)}` : '';

  // 클래스 목록 구성
  const classes = ['qm-el-inner'];
  if (el.component) classes.push(`qm-comp--${esc(el.component.toLowerCase())}`);
  if (extraCls) classes.push(preview.cls);

  // 인라인 스타일
  const styles = [];
  if (el.width !== undefined)  styles.push(`width:${el.width}px`);
  if (el.height !== undefined) styles.push(`height:${el.height}px`);
  if (el.margin && el.margin.length === 4) {
    styles.push(`margin:${el.margin[1]}px ${el.margin[2]}px ${el.margin[3]}px ${el.margin[0]}px`);
  }
  if (el.spacing !== undefined) {
    styles.push(`gap:${el.spacing}px`);
  }

  const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
  const classAttr = ` class="${classes.join(' ')}"`;

  // 내부 콘텐츠 조각
  let inner = '';

  // key 태그 (디버그용 레이블)
  if (el.key) {
    inner += `<span class="qm-key">${esc(el.key)}</span>`;
  }

  // component 태그
  if (el.component) {
    inner += `<span class="qm-component-tag">${esc(el.component)}</span>`;
  }

  // label 오버라이드
  if (el.label !== undefined) {
    inner += `<span class="qm-label">${esc(el.label)}</span>`;
  }

  // iconSlot 오버라이드
  if (el.iconSlot !== undefined) {
    inner += `<span class="qm-icon-slot">[icon:${esc(el.iconSlot)}]</span>`;
  }

  // repeat 표현
  if (el.repeat !== undefined) {
    const repeatLabel = typeof el.repeat === 'number'
      ? `repeat ×${el.repeat}`
      : `repeat:${esc(String(el.repeat))}`;
    inner += `<span class="qm-repeat-badge">${repeatLabel}</span>`;

    // children[0]을 반복 템플릿으로 표시 (repeat N인 경우 N회, 최대 5회 표시)
    if (Array.isArray(el.children) && el.children.length > 0) {
      const tpl = el.children[0];
      const count = typeof el.repeat === 'number' ? Math.min(el.repeat, 5) : 2;
      for (let i = 0; i < count; i++) {
        inner += `<div class="qm-repeat-item">${renderElement(tpl, catalog)}</div>`;
      }
      // 나머지 children (repeat 템플릿 제외)
      for (let i = 1; i < el.children.length; i++) {
        inner += renderElement(el.children[i], catalog);
      }
    }
  } else if (Array.isArray(el.children)) {
    for (const child of el.children) {
      inner += renderElement(child, catalog);
    }
  }

  // 래퍼 div 클래스 (레이아웃/앵커/스크롤)
  const wrapClasses = ['qm-el'];
  if (el.anchor && ANCHOR_CLASS[el.anchor]) wrapClasses.push(ANCHOR_CLASS[el.anchor]);
  if (el.layout) {
    if (el.layout === 'grid' && el.columns !== undefined) {
      wrapClasses.push('qm-layout--grid-cols');
    } else {
      wrapClasses.push(`qm-layout--${el.layout}`);
    }
  }
  if (el.scroll && el.scroll !== 'none') wrapClasses.push(`qm-scroll qm-scroll--${el.scroll}`);

  const wrapStyle = [];
  if (el.layout === 'vertical') wrapStyle.push('display:flex;flex-direction:column');
  else if (el.layout === 'horizontal') wrapStyle.push('display:flex;flex-direction:row;flex-wrap:wrap');
  else if (el.layout === 'grid' && el.columns !== undefined) {
    wrapStyle.push(`display:grid;grid-template-columns:repeat(${el.columns},1fr)`);
  }
  if (el.spacing !== undefined && (el.layout === 'vertical' || el.layout === 'horizontal')) {
    wrapStyle.push(`gap:${el.spacing}px`);
  }
  if (el.spacing !== undefined && el.layout === 'grid') {
    wrapStyle.push(`gap:${el.spacing}px`);
  }

  const wrapStyleAttr = wrapStyle.length ? ` style="${wrapStyle.join(';')}"` : '';
  const wrapClassAttr = ` class="${wrapClasses.join(' ')}"`;

  return `<div${wrapClassAttr}${wrapStyleAttr}><${htmlTag}${classAttr}${styleAttr}>${inner}</${htmlTag}></div>`;
}

/**
 * 순수 렌더 함수.
 * @param {object} manifest - 파싱된 매니페스트
 * @param {object|null} catalog - 파싱된 카탈로그 (없으면 null)
 * @returns {{ html: string }}
 */
export function renderPreview(manifest, catalog) {
  const screen = manifest.screen || 'Screen';
  const [w, h] = Array.isArray(manifest.refResolution) ? manifest.refResolution : [1920, 1080];

  let elementsHtml = '';
  if (Array.isArray(manifest.elements)) {
    for (const el of manifest.elements) {
      elementsHtml += renderElement(el, catalog);
    }
  }

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quartermaster Preview — ${esc(screen)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<h2 style="margin-bottom:12px;font-size:14px;color:#a0a0b0">
  Quartermaster Preview &mdash; <strong style="color:#e0e0e0">${esc(screen)}</strong>
  <span style="font-size:11px;color:#555;margin-left:8px">${w}&times;${h}</span>
</h2>
<div class="qm-canvas" style="width:${Math.min(w, 1200)}px;min-height:${Math.round(h * Math.min(w,1200)/w)}px">
${elementsHtml}
</div>
</body>
</html>`;

  return { html };
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    process.stderr.write('Usage: node preview.mjs <manifest.json> [catalog.json]\n');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let catalog = null;
  if (process.argv[3]) {
    catalog = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  }
  const { html } = renderPreview(manifest, catalog);
  process.stdout.write(html);
}
