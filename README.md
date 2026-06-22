# Game UI Studio

Unity UGUI 레이아웃 매니페스트 → 프리팹 조립 파이프라인 Claude Code 플러그인.

자연어 설계 의도를 JSON 매니페스트로 변환하고, 웹 프리뷰로 검수한 뒤, Unity 프리팹을 자동 조립합니다. 멱등 재조립을 지원하므로 사람이 부착한 코드·컴포넌트를 보존하면서 레이아웃을 반복 갱신할 수 있습니다.

---

## 설치

### 1. 마켓플레이스에서 설치

```bash
# 마켓플레이스 등록
/plugin marketplace add TooruTora/game-ui-studio

# 플러그인 설치
/plugin install game-ui-studio@game-ui-studio-marketplace
```

### 2. 로컬 설치 (개발용)

```bash
/plugin install ./game-ui-studio
```

---

## 사전 준비물

| 항목 | 설명 |
|------|------|
| **Node.js >= 18** | 런타임 스크립트 실행용 (`runtime/*.mjs`) |
| **Unity MCP** | Claude Code ↔ Unity 에디터 브릿지. Unity 프로젝트에 설치 필요 |
| **베이스 프리팹** | `catalog.json`에 등록된 UGUI 부품 프리팹들 (`Assets/UI/Prefabs/`) |
| **catalog.json** | 프로젝트 내 사용 가능한 component 사전. `catalog-sync`로 생성 |

---

## 사용법

```bash
# 자연어로 UI 화면 설계 시작
/game-ui 용병 목록 화면을 만들어줘. 상단에 타이틀, 스크롤 가능한 용병 카드 리스트, 하단에 고용 버튼이 필요해.

# 강제 규약 조회
/game-ui-studio:manifest-schema

# 정규화 규칙 조회
/game-ui-studio:prefab-normalize

# 직접 오케스트레이션 스킬 호출
/game-ui-studio:game-ui-studio 기존 RosterScreen 프리팹에 필터 패널 추가해줘
```

---

## 데이터 흐름

```
사용자 자연어 의도
        │
        ▼
  ui-designer (Opus)
  catalog.json 참조 → 매니페스트 JSON 생성
  manifest.schema.json 검증
        │
        ▼
  웹 프리뷰 렌더링
  사람 검수 → 승인 또는 수정 요청
        │
        ▼
  merge-planner.mjs
  기존 프리팹 YAML 읽기 → normalize → diff → 계획 생성
        │
        ▼
  merge-applier (Sonnet) + Unity MCP
  add / update / remove 적용
  사람 컴포넌트·코드 보존
        │
        ▼
  완성된 프리팹 구조
  사람이 View MonoBehaviour 작성·부착
```

---

## 핵심 규약

강제 규약의 단일 정본(SSOT)은 `skills/manifest-schema/SKILL.md`입니다.

요약:
- **카탈로그 외 component 사용 절대 금지** — `catalog.json` 등재 ID만 허용
- **안정키(key) 영속** — `ManagedMarker.stableKey`와 1:1 매핑, 변경 불가
- **순수 레이아웃** — `bindTo` 등 상호작용 필드 없음
- **코드 미생성** — `.cs` 파일은 사람이 직접 작성

---

## 라이선스

MIT — Copyright (c) 2026 TooruTora
