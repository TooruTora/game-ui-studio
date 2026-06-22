/**
 * env-check.mjs
 * Game UI Studio v0.3 — 환경 사전점검 (SessionStart hook용)
 * ESM, Node>=18, 외부 의존성 0.
 *
 * export function checkEnv() → { node:{ok,version,required:'>=18'}, unity:{ok,detail}, mcp:{ok,detail} }
 * CLI: 결과를 사람이 읽을 수 있게 출력. node 미달=exit 1, 아니면=exit 0.
 * unity/mcp 미가용은 경고만 — 트랙A 진행 가능하므로 비차단.
 */

import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Node.js 버전 문자열 파싱.
 * @param {string} versionStr - "v18.3.0" 형태
 * @returns {{ major: number, minor: number, patch: number }}
 */
function parseNodeVersion(versionStr) {
  const m = versionStr.replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return { major: 0, minor: 0, patch: 0 };
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
  };
}

/**
 * 환경 점검 순수 함수 (동기, 결정적).
 *
 * @returns {{
 *   node:  { ok: boolean, version: string, required: '>=18' },
 *   unity: { ok: boolean, detail: string },
 *   mcp:   { ok: boolean, detail: string }
 * }}
 */
export function checkEnv() {
  // ── Node.js 버전 ─────────────────────────────────────────────────────────
  const version = process.version;
  const { major } = parseNodeVersion(version);
  const nodeOk = major >= 18;

  // ── Unity 가용성 ─────────────────────────────────────────────────────────
  // Unity Editor는 별도 프로세스이므로 Node.js에서 결정적 판정 불가.
  // UNITY_EDITOR_PATH / UNITY_PATH 환경변수를 간접 지표로 사용.
  const unityPath = process.env.UNITY_EDITOR_PATH || process.env.UNITY_PATH || '';
  const unityOk = unityPath.length > 0;
  const unityDetail = unityOk
    ? `Unity Editor path found: ${unityPath}`
    : 'manual check required — set UNITY_EDITOR_PATH or UNITY_PATH env var';

  // ── MCP 가용성 ───────────────────────────────────────────────────────────
  // unity-mcp 서버 가용성도 결정적 판정 불가.
  // CLAUDE_PLUGIN_ROOT 기준 .mcp.json 존재 여부를 간접 지표로 사용.
  let mcpOk = false;
  let mcpDetail = 'manual check required';
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '';
  if (pluginRoot) {
    const mcpPath = pluginRoot.replace(/\\/g, '/') + '/.mcp.json';
    if (existsSync(mcpPath)) {
      mcpOk = true;
      mcpDetail = `.mcp.json found at ${mcpPath}`;
    } else {
      mcpDetail = `manual check required — .mcp.json not found at ${mcpPath}`;
    }
  } else {
    mcpDetail = 'manual check required — CLAUDE_PLUGIN_ROOT not set';
  }

  return {
    node:  { ok: nodeOk, version, required: '>=18' },
    unity: { ok: unityOk, detail: unityDetail },
    mcp:   { ok: mcpOk, detail: mcpDetail },
  };
}

// ─── CLI 진입점 (SessionStart hook) ──────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkEnv();

  process.stdout.write('\n=== Game UI Studio v0.3 — 환경 점검 ===\n\n');

  const nodeIcon  = result.node.ok  ? '[OK]  ' : '[FAIL]';
  const unityIcon = result.unity.ok ? '[OK]  ' : '[WARN]';
  const mcpIcon   = result.mcp.ok   ? '[OK]  ' : '[WARN]';

  process.stdout.write(`Node.js  ${nodeIcon} ${result.node.version} (required ${result.node.required})\n`);
  process.stdout.write(`Unity    ${unityIcon} ${result.unity.detail}\n`);
  process.stdout.write(`MCP      ${mcpIcon} ${result.mcp.detail}\n`);
  process.stdout.write('\n');

  if (!result.node.ok) {
    process.stderr.write(
      `[game-ui-studio] Node.js >= 18 required, found ${result.node.version}. Upgrade Node.js to continue.\n`
    );
    process.exit(1);
  }

  if (!result.unity.ok || !result.mcp.ok) {
    process.stdout.write(
      '[game-ui-studio] Unity/MCP 미가용 — 트랙 A(매니페스트/프리뷰)는 계속 진행 가능합니다.\n\n'
    );
  }

  // node OK이면 unity/mcp 미가용이어도 exit 0 (비차단)
  process.exit(0);
}
