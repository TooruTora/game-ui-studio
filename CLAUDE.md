⚠️ 이 파일은 Claude 컨텍스트로 로드되지 않습니다. 강제 규약은 skills/manifest-schema/SKILL.md가 단일 정본입니다.

---

# Game UI Studio — 사람 개발자용 안내

## 프로젝트 개요

Game UI Studio는 Unity UGUI 레이아웃 설계를 자동화하는 Claude Code 플러그인입니다.
자연어 의도 → JSON 매니페스트 → 웹 프리뷰 → Unity 프리팹 조립까지 전체 파이프라인을 Claude Code 안에서 실행합니다.

## 강제 규약 위치

모든 설계 규약의 단일 정본(SSOT)은 다음 파일입니다:

```
skills/manifest-schema/SKILL.md
```

이 파일에서 카탈로그 제약, 안정키 네이밍, GameObject 네이밍, MVC 구조 규약, UGUI 컨벤션을 관리합니다.
CLAUDE.md(이 파일)에는 규약 본문을 두지 않습니다.

## 디렉터리 구조

```
game-ui-studio/               # 레포 루트 = 플러그인 + 마켓플레이스
├── .claude-plugin/
│   ├── plugin.json          # 플러그인 메타데이터
│   └── marketplace.json     # 마켓플레이스 등록 정보 (source: ".")
├── agents/
│   ├── ui-designer.md       # 레이아웃 설계 LLM (Opus)
│   └── merge-applier.md     # Unity MCP 적용 LLM (Sonnet)
├── commands/
│   └── game-ui.md           # /game-ui 진입점 커맨드
├── skills/
│   ├── manifest-schema/     # 강제 규약 SSOT ★
│   ├── game-ui-studio/       # 메인 오케스트레이션
│   └── prefab-normalize/    # 정규화 규칙 참조
├── schema/
│   ├── manifest.schema.json # 매니페스트 JSON 스키마
│   └── catalog.schema.json  # 카탈로그 JSON 스키마
├── runtime/                 # Node.js ESM 런타임 (별도 워커 담당)
├── test/                    # 테스트 (별도 워커 담당)
├── hooks/                   # Claude Code 훅 (별도 워커 담당)
├── CONTRACT.md              # 트랙 간 데이터 계약 (동결)
├── package.json
├── LICENSE
└── README.md
```

## 개발 시 주의사항

- `CONTRACT.md`는 동결된 인터페이스 계약입니다. 변경 시 ADR 프로세스를 거칩니다.
- `runtime/`, `test/`, `hooks/`는 별도 워커가 담당합니다. 직접 수정하지 마십시오.
- 새 카탈로그 부품을 추가할 때는 `schema/catalog.schema.json` 기준을 따릅니다.
- Node.js 18 이상 필요합니다.
