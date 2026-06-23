/**
 * prefab-guide.mjs
 * Game UI Studio — 베이스 프리팹 셋업 가이드 생성기
 * ESM, Node>=18, 외부 의존성 0.
 *
 * export function buildGuide(spec) → { markdown }
 * export function buildPrefabSection(name, entry) → string
 * CLI: argv[2]=스펙경로 → stdout에 markdown.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// kind별 기본 계층 힌트 (hierarchy 미지정 시)
const DEFAULT_HIERARCHY_HINT = {
  button: '- **Root** — Image (9-slice), Button\n  - **Label** — Text',
  panel:  '- **Root** — Image',
  scroll: '- **Root** — ScrollRect, Mask\n  - **Content** — (콘텐츠 자식 배치)',
  grid:   '- **Root** — GridLayoutGroup',
  modal:  '- **Root** — Image\n  - (자식 요소 배치)',
  text:   '- **Root** — Text',
  slot:   '- **Root** — Image',
};

/**
 * 단일 프리팹 섹션 마크다운 생성 (순수·결정적).
 * @param {string} name - 프리팹명
 * @param {object} entry - 스펙 항목
 * @returns {string}
 */
export function buildPrefabSection(name, entry) {
  const lines = [];
  let step = 1;

  // ── 소스 스프라이트 임포트 세팅 ─────────────────────────────────────────
  const imp = entry.import ?? {};
  const textureType    = imp.textureType    ?? 'Sprite';
  const spriteMode     = imp.spriteMode     ?? 'Single';
  const pixelsPerUnit  = imp.pixelsPerUnit  ?? 100;
  const filterMode     = imp.filterMode     ?? 'Bilinear';
  const compression    = imp.compression    ?? 'None';
  const generateMipMaps = imp.generateMipMaps ?? false;

  lines.push(`### ${step++}. 소스 스프라이트 임포트 세팅`);
  lines.push('');
  lines.push(`Project 창에서 \`${entry.sourceSprite}\`를 선택한 후 Inspector에서 아래와 같이 설정합니다.`);
  lines.push('');
  lines.push(`| 항목 | 값 |`);
  lines.push(`|------|----|`);
  lines.push(`| Texture Type | ${textureType} |`);
  lines.push(`| Sprite Mode | ${spriteMode} |`);
  lines.push(`| Pixels Per Unit | ${pixelsPerUnit} |`);
  lines.push(`| Filter Mode | ${filterMode} |`);
  lines.push(`| Compression | ${compression} |`);
  lines.push(`| Generate Mip Maps | ${generateMipMaps ? 'on' : 'off'} |`);
  lines.push('');
  lines.push('설정 후 **Apply** 버튼을 클릭합니다.');
  lines.push('');

  // ── 9-slice 보더 (nineSlice 있을 때만) ─────────────────────────────────
  if (entry.nineSlice != null) {
    const [left, bottom, right, top] = entry.nineSlice.border;
    lines.push(`### ${step++}. 9-slice 보더 설정`);
    lines.push('');
    lines.push('Inspector 상단의 **Sprite Editor** 버튼을 클릭하여 Sprite Editor를 엽니다.');
    lines.push('');
    lines.push('Border 값을 아래와 같이 입력합니다.');
    lines.push('');
    lines.push(`| L (Left) | B (Bottom) | R (Right) | T (Top) |`);
    lines.push(`|----------|------------|-----------|---------|`);
    lines.push(`| ${left} | ${bottom} | ${right} | ${top} |`);
    lines.push('');
    lines.push('**Apply** 후 Sprite Editor를 닫습니다.');
    lines.push('');
  }

  // ── Sprite Atlas (atlas 있을 때만) ─────────────────────────────────────
  if (entry.atlas != null) {
    lines.push(`### ${step++}. Sprite Atlas 등록`);
    lines.push('');
    lines.push(`Sprite Atlas \`${entry.atlas}\`를 열고(없으면 새로 생성) Objects for Packing 목록에 \`${entry.sourceSprite}\`를 추가합니다.`);
    lines.push('');
    lines.push('**Pack Preview** 버튼으로 아틀라스를 갱신합니다.');
    lines.push('');
  }

  // ── 프리팹 계층 생성 ────────────────────────────────────────────────────
  lines.push(`### ${step++}. 프리팹 계층 생성`);
  lines.push('');

  if (Array.isArray(entry.hierarchy) && entry.hierarchy.length > 0) {
    lines.push('아래 계층 구조대로 GameObject를 생성하고 컴포넌트를 부착합니다.');
    lines.push('');

    // 트리 구조로 표시 (parent 기준 정렬)
    const roots = entry.hierarchy.filter(h => !h.parent);
    const children = entry.hierarchy.filter(h => h.parent);

    function renderNode(node, depth) {
      const indent = '  '.repeat(depth);
      const componentsStr = node.components.join(', ');
      let line = `${indent}- **${node.node}** — ${componentsStr}`;
      if (node.note) line += `\n${indent}  > ${node.note}`;
      lines.push(line);

      const nodeChildren = children.filter(c => c.parent === node.node);
      for (const child of nodeChildren) {
        renderNode(child, depth + 1);
      }
    }

    for (const root of roots) {
      renderNode(root, 0);
    }
  } else {
    lines.push(`kind \`${entry.kind}\` 기본 계층 구성:`);
    lines.push('');
    lines.push(DEFAULT_HIERARCHY_HINT[entry.kind] ?? '- **Root** — (컴포넌트 직접 구성)');
  }

  lines.push('');

  // ── 프리팹 저장 ─────────────────────────────────────────────────────────
  lines.push(`### ${step++}. 프리팹 저장`);
  lines.push('');
  lines.push(`Hierarchy 창의 루트 오브젝트를 \`${entry.savePath}\` 경로로 드래그하거나,`);
  lines.push(`**Assets > Create > Prefab** 으로 저장합니다.`);
  lines.push('');
  lines.push(`저장 경로: \`${entry.savePath}\``);
  lines.push('');

  return lines.join('\n');
}

/**
 * 전체 가이드 마크다운 생성 (순수·결정적).
 * @param {object} spec - 파싱된 프리팹 스펙 객체
 * @returns {{ markdown: string }}
 */
export function buildGuide(spec) {
  const prefabNames = Object.keys(spec);
  const count = prefabNames.length;

  const sections = [];

  // ── 헤더 ────────────────────────────────────────────────────────────────
  sections.push('# Game UI Studio — 베이스 프리팹 셋업 가이드');
  sections.push('');
  sections.push(`총 **${count}개** 베이스 프리팹을 순서대로 설정합니다.`);
  sections.push('각 섹션의 단계를 Unity에서 직접 따라 하십시오. 미적 판단(색상, 크기 등)은 사람이 결정합니다.');
  sections.push('');
  sections.push('---');
  sections.push('');

  // ── 각 프리팹 섹션 ──────────────────────────────────────────────────────
  for (let i = 0; i < prefabNames.length; i++) {
    const name = prefabNames[i];
    const entry = spec[name];

    sections.push(`## ${i + 1}. ${name}`);
    sections.push('');
    sections.push(buildPrefabSection(name, entry));
    sections.push('---');
    sections.push('');
  }

  // ── 공통 푸터 ───────────────────────────────────────────────────────────
  sections.push('## 완료 후 카탈로그 동기화');
  sections.push('');
  sections.push('모든 베이스 프리팹 제작이 완료되면 **catalog-sync**를 실행하여 카탈로그에 등록합니다.');
  sections.push('');
  sections.push('```');
  sections.push('node runtime/catalog-sync.mjs');
  sections.push('```');
  sections.push('');
  sections.push('> **중요:** 각 프리팹의 `savePath`가 `examples/catalog.json`의 `unity` 경로와 정확히 일치해야 합니다.');
  sections.push('> 불일치 시 매니페스트→프리팹 파이프라인에서 컴포넌트를 찾지 못합니다.');
  sections.push('');

  return { markdown: sections.join('\n') };
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    let specText;

    if (process.argv[2]) {
      specText = readFileSync(process.argv[2], 'utf8');
    } else {
      process.stderr.write('[prefab-guide] 사용법: node runtime/prefab-guide.mjs <prefab-spec-path>\n');
      process.exit(1);
    }

    let spec;
    try {
      spec = JSON.parse(specText);
    } catch (e) {
      process.stderr.write(`[prefab-guide] JSON parse error: ${e.message}\n`);
      process.exit(1);
    }

    const { markdown } = buildGuide(spec);
    process.stdout.write(markdown + '\n');
  })();
}
