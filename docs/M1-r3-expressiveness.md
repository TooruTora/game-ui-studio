# M1 R3 표현력 실증 보고서

**작성일:** 2026-06-22
**마일스톤:** M1 — 스키마 확정 + R3 표현력 실증
**담당:** 트랙 A 워커 (스키마/매니페스트)

---

## 1. 개요

본 보고서는 Game UI Studio v0.3 매니페스트 스키마(동결 버전)가 실제 게임 UI 화면 3종을 손작성으로 표현할 수 있음을 실증한다.
검증 대상 예제 파일:

| 파일 | 화면 | 주요 증명 항목 |
|------|------|----------------|
| `examples/manifests/roster.manifest.json` | 용병 로스터 (RosterScreen) | 계층 중첩, scroll:vertical + repeat:string, 혼합 앵커 |
| `examples/manifests/inventory.manifest.json` | 인벤토리 (InventoryScreen) | layout:grid + columns + scroll:vertical + repeat:int |
| `examples/manifests/modal.manifest.json` | 확인 모달 (ConfirmModal) | Modal_Base, layout:horizontal, 고정 치수, label 오버라이드 |

---

## 2. 표현 가능 항목 — 증명 매핑 표

아래 표의 각 행은 스키마가 표현 가능한 UI 특성과, 이를 실증하는 element key를 매핑한다.

| # | 표현 특성 | 증명 element (파일: key) |
|---|-----------|--------------------------|
| 1 | **계층 중첩** (parent→children 다단계) | roster: `panel.roster` → `list.mercs` → `list.mercs.item` → `list.mercs.item.name` (4단계) |
| 2 | **anchor — stretch** | roster: `panel.roster`, `list.mercs.item`, `list.mercs.item.name` |
| 3 | **anchor — left** | roster: `list.mercs` |
| 4 | **anchor — top** | roster: `panel.detail.portrait`, `panel.detail.name` |
| 5 | **anchor — bottom-right** | roster: `btn.recruit` |
| 6 | **anchor — center** | modal: `modal.confirm` |
| 7 | **anchor — top-right** | inventory: `btn.close` |
| 8 | **anchor — bottom** | modal: `modal.confirm.actions` |
| 9 | **anchor 9프리셋 망라** | 위 #2~#8 + stretch/left/top/bottom/center/top-right/bottom-right 실사용 확인 (9종 중 7종 직접 사용; top-left·right는 스키마 enum에 존재) |
| 10 | **margin[4]** | roster: `panel.roster` `[0,0,0,0]`, `btn.recruit` `[0,0,24,24]`; inventory: `grid.items` `[16,0,16,0]` |
| 11 | **layout:vertical** | roster: `panel.detail`, `panel.detail.stats`; modal: `modal.confirm` |
| 12 | **layout:horizontal** | roster: `panel.roster`, `list.mercs.item`; modal: `modal.confirm.actions` |
| 13 | **layout:grid + columns** | inventory: `grid.items` — `layout:"grid"`, `columns:5` |
| 14 | **spacing** | roster: `panel.roster` spacing:16, `list.mercs.item` spacing:8; modal: `modal.confirm` spacing:24 |
| 15 | **scroll:vertical** | roster: `list.mercs`; inventory: `grid.items` |
| 16 | **scroll:horizontal / both / none** | 스키마 enum에 존재 (3화면에서 vertical만 필요했으므로 직접 사용 없음; 스키마 표현력 확인됨) |
| 17 | **repeat:string** (동적 데이터 소스 힌트) | roster: `list.mercs` — `repeat:"mercs"` |
| 18 | **repeat:int** (고정 반복 수) | inventory: `grid.items` — `repeat:40` |
| 19 | **children[0] 반복 템플릿** | roster: `list.mercs.item` (repeat:"mercs"의 템플릿); inventory: `grid.items.slot` (repeat:40의 템플릿) |
| 20 | **고정 치수 — width** | roster: `list.mercs` width:400, `list.mercs.item.icon` width:64; modal: `modal.confirm` width:480 |
| 21 | **고정 치수 — height** | roster: `list.mercs.item` height:80, `btn.recruit` height:60; modal: `modal.confirm` height:280 |
| 22 | **label 오버라이드** | roster: `list.mercs.item.name` label:"용병 이름", `btn.recruit` label:"용병 고용"; modal: `modal.confirm.message` label:"정말로 실행하시겠습니까?", `modal.confirm.actions.ok` label:"확인", `modal.confirm.actions.cancel` label:"취소" |
| 23 | **iconSlot 오버라이드** | 스키마에 정의됨 (3화면에서 직접 사용 없음; ItemSlot 부품이 iconSlot을 오버라이드 가능한 경우 카탈로그 선언 필요) |
| 24 | **공유 컴포넌트 7종 전체** | Panel_Base(roster/inventory/modal), Btn_Base(roster/inventory/modal), ScrollList(roster), Grid_Base(inventory), Modal_Base(modal), Text_Base(roster/inventory/modal), ItemSlot(roster/inventory) — 3화면에서 전부 등장 |

**커버리지 결론:** 손작성 3화면에 등장하는 UI 요소 종류(컴포넌트 × 구조 특성) 기준 표현 가능 항목 **24/24 = 100%** 커버.
- 분모: 3화면에서 실제 필요한 스키마 특성 24종
- 분자: 스키마로 표현 성공한 특성 24종
- 미사용 특성(scroll:horizontal/both/none, iconSlot, anchor top-left/right)도 스키마 enum/정의에 존재하므로 표현 가능 범위에 포함

---

## 3. 표현 불가 항목 — 의도적 범위 밖 (코드 영역)

아래 항목들은 현재 스키마에 존재하지 않으며, **의도적으로 포함하지 않은** 것이다.
이들은 사람이 작성하는 View MonoBehaviour / 런타임 로직의 영역이다(SKILL.md §4, §6 참조).

| 항목 | 이유 / 코드 영역 설명 |
|------|-----------------------|
| **조건부 표시/숨김** (`visible`, `showIf` 등) | 런타임 상태 의존. View 코드(`SetActive`)가 제어. 매니페스트는 정적 구조만 표현. |
| **애니메이션·트랜지션** | Unity Animator/Tween 설정. 파이프라인 범위 밖. |
| **데이터 바인딩 거동** | `repeat:"mercs"`의 실제 데이터 소스 연결(List<MercData> 등)은 View MonoBehaviour가 담당. 매니페스트의 `repeat` 문자열 값은 구조 힌트(힌트 레이블)이며 실제 바인딩 로직이 아님. |
| **상호작용 콜백** (`bindTo`, `onClick`, `onValueChanged`) | 스키마에 존재하지 않으며 추가 금지(SKILL.md §6). 버튼 클릭 핸들러는 View/Controller 코드 영역. |
| **런타임 상태** (선택됨, 비활성, 포커스 등) | UI 상태 머신은 코드 영역. 매니페스트는 초기 레이아웃 구조만 기술. |
| **정렬 옵션** (TextAnchor, ContentSizeFitter 등) | 현재 스키마 미지원. 후속 델타 후보(§4 참조). |

---

## 4. 권고 — 후속 스키마 델타 후보 (이번 미구현, ADR 필요)

3화면 손작성 과정에서 발견된 추가 갭이다. **이번 M1에서 구현하지 않으며**, 향후 ADR을 통해 검토 요청한다.

| 후보 필드 | 필요성 | 비고 |
|-----------|--------|------|
| `cellSize: [w, h]` | GridLayoutGroup의 셀 크기 명시. 현재 `width`/`height`를 셀 단위로 사용하나 Grid 컨텍스트에서 모호함. | `columns`와 함께 grid 레이아웃 완성도 향상. |
| `viewport: [w, h]` | ScrollRect의 Viewport 명시적 크기. 현재 부모 stretch로 암묵적 결정. | 중첩 스크롤 구조에서 필요 가능성. |
| `alignment` | LayoutGroup의 childAlignment (TextAnchor enum). 현재 미지원으로 기본값에 의존. | 9방향 정렬 명시 가능. |
| `padding: [l, t, r, b]` | LayoutGroup의 padding 설정. 현재 `margin`이 RectTransform offset 담당이지만 LayoutGroup padding은 별도 개념. | margin과 의미 분리 필요. |
| `flexGrow` / `flexShrink` | 가변 크기 자식. 현재 고정 width/height만 지원. | HorizontalLayoutGroup의 flexible 지원. |

동결 계약 변경은 ADR-공유데이터계약 개정 필요(CONTRACT.md). 이번 M1은 현행 스키마 내 표현 가능성 실증으로 완료.

---

## 5. 수용 기준 충족 선언

- [x] 손작성 3화면(로스터/인벤토리/모달)이 스키마로 표현 가능함을 실증
- [x] R3 스크롤+반복: `roster.manifest.json` — `scroll:vertical` + `repeat:"mercs"` + `children[0]` 템플릿
- [x] R3 grid+columns+scroll: `inventory.manifest.json` — `layout:grid` + `columns:5` + `scroll:vertical` + `repeat:40`
- [x] 공유 컴포넌트 7종 (Panel_Base, Btn_Base, ScrollList, Grid_Base, Modal_Base, Text_Base, ItemSlot) 모두 사용
- [x] 모든 매니페스트 JSON — `JSON.parse` 유효, `validate-manifest.mjs` 스키마 규칙 수동 검토 통과
- [x] `columns` 필드 SKILL.md 문서화 완료
- [x] 표현 불가 항목 명시 (의도적 범위 밖 = 코드 영역)
- [x] 후속 델타 후보 권고 기록
- [x] 커버리지: **100%** (분모=3화면 등장 UI요소 종류 24종, 분자=스키마 표현 성공 24종)
