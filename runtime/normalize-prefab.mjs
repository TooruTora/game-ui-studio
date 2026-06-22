/**
 * normalize-prefab.mjs
 * Game UI Studio v0.3 — Unity 프리팹 YAML 정규화기
 * ESM, Node>=18, 외부 의존성 0.
 * 결정적: 동일 입력 → 동일 출력. 표준 YAML 라이브러리 없이 라인 기반 MVP 구현.
 *
 * export function normalizePrefab(yamlText, keyMap) → string
 * export function roundFloats(text, precision=3) → string
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * 부동소수를 허용오차로 반올림 (라인 기반, 결정적).
 * "1.000001" → "1" / "3.14159265" → "3.142" (precision=3)
 *
 * @param {string} text - 입력 텍스트
 * @param {number} precision - 소수 자릿수 (기본 3)
 * @returns {string}
 */
export function roundFloats(text, precision = 3) {
  // 부동소수 패턴: 선택적 부호, 정수부, 소수점, 소수부
  // 정수 단독은 건드리지 않음 (소수점 있는 것만 처리)
  return text.replace(/-?\d+\.\d+/g, (match) => {
    const n = parseFloat(match);
    const factor = Math.pow(10, precision);
    const rounded = Math.round(n * factor) / factor;
    // 소수부가 0이면 정수로
    const str = rounded.toFixed(precision);
    // 후행 0 제거: "3.140" → "3.14", "1.000" → "1"
    return str.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  });
}

/**
 * Unity 비표준 YAML 정규화.
 * 규칙:
 *  1. fileID 앵커를 keyMap(fileID→stableKey)으로 치환 (keyMap 없으면 정렬용 플레이스홀더로 정규화)
 *  2. 부동소수 반올림 (기본 소수 3자리)
 *  3. 키 정렬 (같은 indent 레벨 내 YAML 매핑 키를 알파벳순 정렬)
 *
 * @param {string} yamlText - Unity 프리팹 YAML 텍스트
 * @param {object|null} keyMap - { [fileID: string]: stableKey: string } (선택)
 * @returns {string}
 */
export function normalizePrefab(yamlText, keyMap) {
  const map = (keyMap && typeof keyMap === 'object') ? keyMap : null;

  let text = yamlText;

  // ── 1. fileID 앵커/참조 치환 ─────────────────────────────────────────────
  // Unity YAML 헤더: "--- !u!114 &11400000" → 앵커 번호 추출
  // 참조: "{fileID: 12345678}" → stableKey 또는 플레이스홀더로 치환

  if (map) {
    // keyMap이 있으면 fileID→stableKey 치환
    // 헤더 앵커 치환: &<fileID> → &<stableKey>
    text = text.replace(/&(\d+)/g, (_, id) => {
      return map[id] ? `&${map[id]}` : `&anchor_${id}`;
    });
    // 참조 치환: {fileID: <id>, ...} → {fileID: stableKey_<stableKey>, ...}
    text = text.replace(/\{fileID:\s*(\d+)([^}]*)\}/g, (_, id, rest) => {
      const stable = map[id];
      return stable ? `{fileID: key_${stable}${rest}}` : `{fileID: anchor_${id}${rest}}`;
    });
  } else {
    // keyMap 없음: fileID를 정렬 가능한 플레이스홀더로 정규화
    // 헤더 앵커: &<fileID> → &anchor_<zero-padded fileID>
    text = text.replace(/&(\d+)/g, (_, id) => `&anchor_${id.padStart(12, '0')}`);
    // 참조: {fileID: <id>} → {fileID: anchor_<zero-padded>}
    text = text.replace(/\{fileID:\s*(\d+)([^}]*)\}/g, (_, id, rest) =>
      `{fileID: anchor_${id.padStart(12, '0')}${rest}}`
    );
  }

  // ── 2. 부동소수 반올림 ───────────────────────────────────────────────────
  text = roundFloats(text, 3);

  // ── 3. YAML 매핑 키 정렬 (라인 기반 MVP) ────────────────────────────────
  // 동일 indent 레벨의 연속된 "  key: value" 블록을 알파벳순 정렬.
  // Unity YAML은 헤더(--- !u!... &...)로 오브젝트 경계를 구분하므로
  // 헤더 기준으로 블록을 나누어 각 블록 내 키 정렬.
  text = sortYamlKeys(text);

  return text;
}

/**
 * YAML 텍스트의 매핑 키를 라인 기반으로 정렬.
 * MVP: 각 Unity 오브젝트 블록(--- 헤더로 구분) 내에서
 * 동일 indent 레벨의 연속 키-값 라인 그룹을 알파벳순 정렬.
 */
function sortYamlKeys(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 헤더 라인은 그대로 통과
    if (line.startsWith('---') || line.startsWith('%YAML') || line.startsWith('%TAG')) {
      result.push(line);
      i++;
      continue;
    }

    // 매핑 키 라인 감지: "<indent><key>: <value>" 또는 "<indent><key>:"
    // indent 레벨 파악
    const mappingMatch = line.match(/^(\s*)([^#\s\-\[{][^:]*?):\s?(.*)?$/);
    if (mappingMatch) {
      const indent = mappingMatch[1];
      // 동일 indent 레벨의 연속 매핑 키 블록 수집
      const block = [];
      let j = i;
      while (j < lines.length) {
        const l = lines[j];
        // 블록 종료 조건: 빈 라인, 헤더, 다른 indent, 비매핑 라인
        if (l === '' || l.startsWith('---') || l.startsWith('%')) break;

        const m = l.match(/^(\s*)([^#\s\-\[{][^:]*?):\s?(.*)?$/);
        if (!m || m[1] !== indent) break;

        // 이 키에 딸린 하위 라인(들여쓰기가 더 깊은)도 함께 수집
        const entry = [l];
        j++;
        while (j < lines.length) {
          const sub = lines[j];
          if (sub === '' || !sub.startsWith(indent + ' ') && !sub.startsWith(indent + '\t')) break;
          // 자식 라인 (더 깊은 indent)
          if (sub.startsWith(indent) && sub.length > indent.length) {
            const nextChar = sub[indent.length];
            if (nextChar === ' ' || nextChar === '\t') {
              entry.push(sub);
              j++;
              continue;
            }
          }
          break;
        }
        block.push({ key: m[2], lines: entry });
      }

      if (block.length > 1) {
        // 알파벳순 정렬
        block.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
      }

      for (const entry of block) {
        for (const l of entry.lines) result.push(l);
      }
      i = j;
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}

// ─── CLI 진입점 ──────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputPath = process.argv[2];
  const keyMapPath = process.argv[3];
  if (!inputPath) {
    process.stderr.write('Usage: node normalize-prefab.mjs <prefab.yaml> [keymap.json]\n');
    process.exit(1);
  }
  const yamlText = readFileSync(inputPath, 'utf8');
  let keyMap = null;
  if (keyMapPath) {
    keyMap = JSON.parse(readFileSync(keyMapPath, 'utf8'));
  }
  process.stdout.write(normalizePrefab(yamlText, keyMap));
}
