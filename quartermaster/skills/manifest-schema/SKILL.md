---
description: Quartermaster 매니페스트 강제 규약 단일 정본(SSOT). ui-designer 및 파이프라인 전 구성원이 따르는 유일한 강제 규약 문서입니다. $ARGUMENTS로 특정 규약 항목을 조회할 수 있습니다.
---

# Quartermaster 매니페스트 강제 규약 (SSOT)

> **이 스킬이 ui-designer, merge-applier, 모든 파이프라인 참가자가 따르는 유일한 강제 규약 정본입니다.**
> 규약은 이 문서에서만 관리하며, 다른 파일(CLAUDE.md, agents/*.md 등)은 이 문서로의 포인터만 둡니다.

---

## 1. 카탈로그 외 component 사용 절대 금지

매니페스트의 각 element `component` 필드는 **반드시 `catalog.json`에 등재된 ID**여야 합니다.

- 카탈로그에 없는 component를 사용하면 검증 hook(`validate-manifest.mjs`)이 `CATALOG_UNKNOWN_COMPONENT` 오류로 **차단**합니다.
- 새 부품이 필요하면 먼저 카탈로그에 추가 후 매니페스트에서 참조하십시오.
- 카탈로그 항목 구조: `{ unity: "Assets/UI/Prefabs/Xxx.prefab", preview: { el, cls }, overridable: [...] }`

---

## 2. 안정키(key) 네이밍 규약

매니페스트 element의 `key` 필드는 **Unity 프리팹 내 QmManaged 컴포넌트의 `stableKey`** 에 그대로 박히는 영속 식별자입니다. 한 번 정하면 변경하지 않습니다.

**형식 정규식:** `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$`

- 점(`.`) 구분 경로형 슬러그 사용
- 소문자·숫자·점만 허용, 첫 글자는 소문자 알파벳
- 예시: `panel.roster`, `list.mercs`, `btn.recruit`, `header.title`, `slot.icon`
- 잘못된 예: `PanelRoster`, `panel_roster`, `Panel.Roster`, `btn-recruit`

---

## 3. GameObject 네이밍 규약

매니페스트 element의 `name` 필드는 Unity GameObject 이름이 됩니다.

**형식:** `PascalCase + 언더스코어(_) 구분자`

| 접두사 | 용도 | 예시 |
|--------|------|------|
| `Panel_` | 패널/컨테이너 | `Panel_Roster`, `Panel_Header` |
| `Btn_` | 버튼 | `Btn_Recruit`, `Btn_Close` |
| `List_` | 리스트/스크롤 목록 | `List_Mercs`, `List_Items` |
| `Txt_` | 텍스트 레이블 | `Txt_Title`, `Txt_Count` |
| `Img_` | 이미지/아이콘 | `Img_Portrait`, `Img_Icon` |
| `Slot_` | 슬롯 컨테이너 | `Slot_Icon`, `Slot_Badge` |

정규식: `^[A-Za-z][A-Za-z0-9_]*$`

---

## 4. MVC 구조 규약

- **View MonoBehaviour(`.cs`)는 사람이 직접 작성**합니다. 파이프라인(merge-applier, 어떤 LLM도)은 `.cs` 파일을 생성하거나 수정하지 않습니다.
- 파이프라인의 역할은 **프리팹 레이아웃 구조(GameObject 계층, RectTransform, UGUI 컴포넌트 파라미터)**만 조립하는 것입니다.
- Controller/Model 코드는 파이프라인 범위 밖입니다. 프리팹 조립 완료 후 사람이 View를 작성해 부착합니다.

---

## 5. UGUI 컨벤션

### 5-1. Anchor 프리셋
매니페스트의 `anchor` 필드는 추상 프리셋을 사용합니다. Unity에서 실제 anchorMin/anchorMax로 변환됩니다.

| 매니페스트 값 | anchorMin | anchorMax |
|--------------|-----------|-----------|
| `stretch` | (0,0) | (1,1) |
| `top` | (0,1) | (1,1) |
| `bottom` | (0,0) | (1,0) |
| `left` | (0,0) | (0,1) |
| `right` | (1,0) | (1,1) |
| `center` | (0.5,0.5) | (0.5,0.5) |
| `top-left` | (0,1) | (0,1) |
| `top-right` | (1,1) | (1,1) |
| `bottom-left` | (0,0) | (0,0) |
| `bottom-right` | (1,0) | (1,0) |

### 5-2. CanvasScaler refResolution
매니페스트 최상위 `refResolution: [width, height]`가 CanvasScaler의 referenceResolution을 결정합니다.
- 기본값: `[1920, 1080]`
- Match Width Or Height 모드를 사용하며, matchWidthOrHeight는 개발 팀 규약을 따릅니다(기본 0.5).

### 5-3. LayoutGroup 기준
- `layout: "vertical"` → VerticalLayoutGroup
- `layout: "horizontal"` → HorizontalLayoutGroup
- `layout: "grid"` → GridLayoutGroup
- `spacing` 필드 → spacing 파라미터에 적용
- `layout: "none"` 또는 미지정 → LayoutGroup 미추가

### 5-4. columns 필드 (grid 레이아웃 열 개수)
- **필드명:** `columns`
- **타입:** integer ≥ 1
- **적용 대상:** `layout: "grid"` 인 element (GridLayoutGroup)
- **Unity 매핑:** GridLayoutGroup의 `constraintCount` 파라미터에 적용. `constraint`는 `FixedColumnCount`로 설정.
- **기본값:** 미지정 시 파이프라인이 GridLayoutGroup 기본값을 사용 (동작은 런타임 소유).
- **예시:**
  ```json
  { "layout": "grid", "columns": 5, "spacing": 8 }
  ```
- **검증:** `SCHEMA_VIOLATION` — `columns`가 integer < 1이거나 non-integer이면 차단. `layout: "grid"` 외 element에 지정해도 스키마상 허용되나 파이프라인이 무시한다.
- **CONTRACT.md 근거:** 스키마 델타 "element.columns (integer ≥1) 추가 — layout=grid의 열 개수. 구조적 관리 필드(MANAGED_FIELDS 포함), overridable 게이팅 대상 아님."

---

## 6. 순수 레이아웃 원칙 — bindTo 등 상호작용 필드 금지

매니페스트는 **순수 레이아웃·구조 표현**만 담습니다.

- `bindTo`, `onClick`, `onValueChanged`, `dataSource`, `command` 등 상호작용/데이터 바인딩 필드는 **매니페스트 스키마에 존재하지 않으며 추가 금지**입니다.
- 런타임 거동은 사람이 작성하는 View MonoBehaviour가 담당합니다.
- `repeat` 필드의 문자열 값(데이터 소스 식별자)은 **구조 힌트**로만 사용되며, 실제 바인딩 로직은 코드 영역입니다.
- `scroll` 필드는 ScrollRect 컴포넌트 추가 여부 결정용이며, 이벤트 핸들러를 의미하지 않습니다.

---

## 7. 오버라이드 가능 필드

카탈로그의 `overridable` 배열에 명시된 필드만 매니페스트에서 오버라이드할 수 있습니다.

- `label`: 텍스트 라벨 오버라이드 (카탈로그가 허용한 경우)
- `iconSlot`: 아이콘 슬롯 ID 오버라이드
- 허용되지 않은 필드를 오버라이드하면 `OVERRIDABLE_VIOLATION` 오류로 차단됩니다.

---

## 8. 검증 거부 코드 (validate-manifest.mjs)

| 코드 | 원인 |
|------|------|
| `SCHEMA_VIOLATION` | JSON 스키마 위반 |
| `CATALOG_UNKNOWN_COMPONENT` | 카탈로그 미등재 component |
| `DUPLICATE_KEY` | 트리 내 key 중복 |
| `MISSING_REQUIRED` | 필수 필드 누락 (key/name/component) |
| `OVERRIDABLE_VIOLATION` | 카탈로그가 허용하지 않은 필드 오버라이드 |
| `INVALID_KEY_FORMAT` | key 형식 위반 |

---

$ARGUMENTS
