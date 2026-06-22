# GS2 — 데이터 무손실 골든 시나리오 (D0.8 ManagedMarker Sync)

> **Unity 환경 필요**: 이 e2e 시나리오는 Unity Editor 및 실제 `Assets/GameUiStudio/` 디렉토리가 필요하다.  
> **현재 상태: RED (실패우선)** — D0.8 ManagedMarker 동기화가 아직 미구현이므로 이 시나리오는 현재 실패한다.  
> CI에서 자동화 불가 (Unity 환경 필요). 수동 수용 기준으로 관리.  
> CONTRACT.md §(iii) — 공유 픽스처, M4 합류 후 양 트랙 합의 필요.

---

## 목적

사용자가 `Assets/GameUiStudio/` 내 파일을 직접 수정한 후 Game UI Studio 플러그인을 재설치하거나 버전 업그레이드해도 수정 내용이 무손실임을 보장한다.

콘텐츠 해시 + 3-way 결정 방식으로 충돌을 처리한다.

---

## 경로 결정 (D0.8 §경로 결정)

| 환경 | 데이터 경로 | 비고 |
|------|------------|------|
| Claude Code 플러그인 | `${CLAUDE_PLUGIN_DATA}/game-ui-studio/` | Claude 플러그인 데이터 영역 |
| Unity 프리팹 | `Assets/GameUiStudio/` | Unity가 `Assets/` 아래만 인식 (제약) |
| 공유 카탈로그 | `${CLAUDE_PLUGIN_DATA}/game-ui-studio/catalog.json` | 양쪽이 참조 |

> **Unity 제약 명문화**: Unity Editor는 `Assets/` 하위 파일만 AssetDatabase로 인식한다. 따라서 Game UI Studio가 생성하는 프리팹 파일은 반드시 `Assets/GameUiStudio/` 또는 `Assets/UI/Prefabs/`에 위치해야 한다. `${CLAUDE_PLUGIN_DATA}`에 프리팹을 두면 Unity가 임포트하지 못한다.

---

## 콘텐츠 해시 + 3-way 결정표 (4상한)

사용자 수정 감지: 파일의 SHA-256 해시를 `.game-ui-studio-hashes.json`에 기록.

| 상한 | 설치본 해시 == 현재 해시? | 사용자 수정? | 결정 |
|------|--------------------------|-------------|------|
| Q1 | 일치 (미수정) | 없음 | 신규 버전으로 **덮어쓰기** (안전) |
| Q2 | 일치 (미수정) | 있음 | 불가 — 해시 불일치로 전환됨 (Q3/Q4로) |
| Q3 | 불일치 (수정됨) | 있음, 비충돌 | **사용자 수정 유지** (skip 신규버전) |
| Q4 | 불일치 (수정됨) | 있음, 충돌 | **사용자 선택** 필요 (3-way merge 또는 수동) |

### 상한별 동작 상세

#### Q1 — 해시 일치, 수정 없음 → 자동 덮어쓰기
```
기존 파일 해시 == 설치 시 기록 해시
  → 사용자가 파일을 수정하지 않음
  → 신규 버전 파일로 자동 덮어쓰기
  → 해시 레코드 갱신
```

#### Q3 — 해시 불일치, 비충돌 수정 → 사용자 수정 유지
```
기존 파일 해시 != 설치 시 기록 해시
  → 사용자가 파일을 수정함
  → 신규 버전이 동일 영역을 수정하지 않음 (비충돌)
  → 사용자 수정 유지, 신규 버전 변경분만 병합
  → 해시 레코드: 병합 결과로 갱신
```

#### Q4 — 해시 불일치, 충돌 수정 → 사용자 선택
```
기존 파일 해시 != 설치 시 기록 해시
  → 사용자가 파일을 수정함
  → 신규 버전이 동일 영역을 수정함 (충돌)
  → Claude Code UI에 3-way diff 표시
  → 사용자 선택: (a) 내 수정 유지  (b) 신규 버전 적용  (c) 수동 편집
```

---

## 테스트 시나리오

> **현재 상태: RED** — 아래 시나리오 모두 현재 미구현으로 실패 예상.

### Scenario A — Q1: 미수정 파일 자동 업그레이드

```
전제: Game UI Studio v0.2 설치, Assets/GameUiStudio/catalog.json 미수정
Action: Game UI Studio v0.3으로 업그레이드
Expected:
  - catalog.json이 v0.3 내용으로 자동 갱신
  - .game-ui-studio-hashes.json 해시 레코드 갱신
  - 사용자 알림: "카탈로그가 v0.3으로 업데이트되었습니다"
수용기준: catalog.json의 내용이 v0.3 번들과 동일
```

### Scenario B — Q3: 사용자 수정 보존 (비충돌)

```
전제: 사용자가 catalog.json에 커스텀 컴포넌트 "MyGame_HeroCard" 추가
Action: Game UI Studio v0.3으로 업그레이드 (v0.3이 다른 컴포넌트만 변경)
Expected:
  - "MyGame_HeroCard" 항목 보존
  - v0.3 신규 항목 추가됨
  - 충돌 없음, 자동 처리
수용기준:
  - catalog["MyGame_HeroCard"] 존재
  - catalog["NewV3Component"] 존재 (신규 추가분)
```

### Scenario C — Q4: 충돌 시 사용자 선택 UI 표시

```
전제: 사용자가 catalog.json의 "Panel_Base".unity 경로를 수정
      v0.3도 동일 Panel_Base.unity 경로를 변경 (충돌)
Action: Game UI Studio v0.3으로 업그레이드
Expected:
  - Claude Code UI에 충돌 알림 표시
  - 3-way diff: [내 수정] vs [신규 버전] vs [공통 조상]
  - 사용자가 선택하기 전까지 파일 미변경
수용기준:
  - 선택 전 catalog.json은 사용자 수정본 유지
  - 선택 후 선택한 버전 반영
```

### Scenario D — 재설치 후 프리팹 무손실

```
전제: Assets/GameUiStudio/RosterScreen.prefab 존재, ManagedMarker.stableKey 부착됨
Action: Game UI Studio 언인스톨 → 재인스톨
Expected:
  - RosterScreen.prefab 무손실 (Unity AssetDatabase가 관리하는 Assets/ 영역)
  - .game-ui-studio-hashes.json 복원 또는 재초기화
  - 재조립 시 기존 stableKey 인식하여 add 대신 override 발생
수용기준:
  - planMerge 재실행 시 ops에 add 없고 override만 (또는 ops 비어있음)
  - ManagedMarker.stableKey 전체 보존
```

---

## 해시 레코드 파일 형식

`.game-ui-studio-hashes.json` (예시):
```json
{
  "version": "0.3.0",
  "files": {
    "Assets/GameUiStudio/catalog.json": {
      "installedHash": "sha256:abc123...",
      "recordedAt": "2026-06-22T00:00:00Z"
    }
  }
}
```

---

## 현재 상태

| 항목 | 상태 |
|------|------|
| 콘텐츠 해시 기록 | 미구현 (RED) |
| 3-way 결정 로직 | 미구현 (RED) |
| 사용자 선택 UI | 미구현 (RED) |
| GS1 보존과 연동 | M4 합류 후 |

M5 milestone에서 구현 완료 후 GREEN 전환 예정.
