---
description: Game UI Studio 메인 오케스트레이션 스킬. 자연어 UI 설계 의도를 받아 매니페스트 생성 → 웹 프리뷰 → 검수 루프 → 프리팹 조립 → 사람 코드 핸드오프까지 전체 파이프라인을 조율합니다. $ARGUMENTS로 의도를 전달하세요.
---

# Game UI Studio 오케스트레이션

Game UI Studio는 자연어 UI 설계 의도를 Unity UGUI 프리팹으로 변환하는 파이프라인입니다.

## 파이프라인 흐름

```
자연어 의도
    │
    ▼
[1] 매니페스트 생성 (ui-designer 에이전트)
    - catalog.json 참조하여 component 선택
    - 안정키(key), GameObject 이름(name), 레이아웃 구조 설계
    - schema/manifest.schema.json 검증 통과 필수
    │
    ▼
[2] 웹 프리뷰 확인
    - 매니페스트 → HTML/CSS 프리뷰 렌더링
    - 사람이 레이아웃 확인 후 승인/수정 요청
    │
    ▼
[3] 검수 루프 (사람 피드백 반영)
    - 수정 요청 시 [1]로 돌아가 매니페스트 갱신
    - 승인 시 다음 단계 진행
    │
    ▼
[4] 프리팹 조립 (merge-applier 에이전트)
    - merge-planner.mjs가 기존 프리팹과 diff
    - Unity MCP를 통해 add/update/remove 적용
    - 사람이 부착한 컴포넌트·코드는 보존
    │
    ▼
[5] 사람 코드 핸드오프
    - 파이프라인은 .cs 파일을 생성하지 않음
    - View MonoBehaviour 작성은 사람 담당
    - 프리팹 구조만 완성된 상태로 전달
    │
    ▼
[6] 멱등 재조립 (필요 시)
    - 매니페스트 변경 후 동일 커맨드 재실행
    - ManagedMarker.stableKey 기반으로 add/update/remove 판정
    - 사람 작업 보존하며 구조만 동기화
```

## 강제 규약

모든 매니페스트 설계는 `/game-ui-studio:manifest-schema` 스킬을 단일 정본(SSOT)으로 따릅니다.

주요 강제 사항:
- **카탈로그 외 component 사용 절대 금지** — `catalog.json` 등재 ID만 사용
- **안정키(key) 영속** — 한 번 정한 key는 변경하지 않음 (`ManagedMarker.stableKey` 동일)
- **순수 레이아웃** — `bindTo` 등 상호작용 필드 금지
- **코드 미생성** — `.cs` 파일 생성·수정 금지

## 하위 스킬 / 커맨드

| 호출 | 용도 |
|------|------|
| `/game-ui-studio:manifest-schema` | 강제 규약 조회 (SSOT) |
| `/game-ui-studio:prefab-normalize` | 정규화 규칙 참조 |
| `/game-ui [의도]` | 이 스킬로 위임하는 thin wrapper |

## 에이전트

| 에이전트 | 역할 |
|----------|------|
| `ui-designer` | 매니페스트 설계 (Opus) |
| `merge-applier` | Unity MCP 적용 (Sonnet) |

---

## 실행

사용자 의도: $ARGUMENTS

위 파이프라인에 따라 처리합니다. 의도가 비어 있으면 현재 상태와 다음 단계를 안내합니다.
