# 베이스 프리팹 셋업 가이드

Game UI Studio 파이프라인을 사용하기 전에 준비해야 할 베이스 프리팹에 대한 참조 문서입니다.

---

## 베이스 프리팹이란?

베이스 프리팹은 Game UI Studio 매니페스트 → 프리팹 조립 파이프라인이 **인스턴스화의 원본**으로 사용하는 Unity 프리팹입니다.

파이프라인은 매니페스트의 `component` 필드(예: `Btn_Base`)를 읽어 `catalog.json`에서 대응하는 Unity 경로를 찾고, 해당 베이스 프리팹을 씬에 배치합니다.

### 왜 사전에 준비해야 하는가?

- 베이스 프리팹의 **스프라이트 선택, 9-slice 보더, 색상, 폰트** 등 미적 요소는 디자이너/아트팀이 결정합니다.
- 파이프라인은 레이아웃 구조(앵커, 마진, 계층)만 담당합니다. 미적 판단을 자동화하지 않습니다.
- 베이스 프리팹이 준비되지 않으면 파이프라인이 참조할 원본이 없어 조립 단계가 실패합니다.

---

## prefab-spec.json 형식

베이스 프리팹 스펙은 JSON 객체입니다. 키는 프리팹명(PascalCase), 값은 각 프리팹의 셋업 정보입니다.

```json
{
  "Btn_Base": {
    "kind": "button",
    "sourceSprite": "Assets/UI/Source/btn_base.png",
    "savePath": "Assets/UI/Prefabs/Btn_Base.prefab",
    "import": {
      "textureType": "Sprite",
      "spriteMode": "Single",
      "pixelsPerUnit": 100,
      "filterMode": "Bilinear",
      "compression": "None",
      "generateMipMaps": false
    },
    "nineSlice": {
      "border": [12, 12, 12, 12]
    },
    "atlas": "UIBaseAtlas",
    "hierarchy": [
      {
        "node": "Btn_Base",
        "components": ["RectTransform", "CanvasRenderer", "Image", "Button"],
        "note": "Image는 9-slice 모드."
      },
      {
        "node": "Label",
        "parent": "Btn_Base",
        "components": ["RectTransform", "CanvasRenderer", "Text"]
      }
    ],
    "overridable": ["label", "iconSlot"]
  }
}
```

### 필드 설명

| 필드 | 필수 | 설명 |
|------|------|------|
| `kind` | 필수 | UGUI 컴포넌트 종류. `button`, `panel`, `scroll`, `grid`, `modal`, `text`, `slot` 중 하나 |
| `sourceSprite` | 필수 | 소스 PNG 에셋 경로 |
| `savePath` | 필수 | Unity 프리팹 저장 경로 (`Assets/.../*.prefab` 형식) |
| `import` | 선택 | 텍스처 임포트 세팅 (기본값 적용 시 생략 가능) |
| `nineSlice` | 선택 | 9-slice 보더 설정. 불필요 시 `null` 또는 생략 |
| `atlas` | 선택 | 포함할 Sprite Atlas 이름 |
| `hierarchy` | 선택 | 프리팹 GameObject 계층 기술. 생략 시 kind 기반 기본 힌트 제공 |
| `overridable` | 선택 | 매니페스트가 오버라이드 가능한 콘텐츠 필드 목록 |

---

## 임포트 세팅 모범사례

Unity의 Texture Import Settings는 스프라이트 품질과 성능에 영향을 줍니다.

| 항목 | 권장값 | 이유 |
|------|--------|------|
| Texture Type | Sprite | UGUI Image 컴포넌트 호환 |
| Sprite Mode | Single | 단일 스프라이트 기본값 |
| Pixels Per Unit | 100 | Unity 기본값, 프로젝트 통일 권장 |
| Filter Mode | Bilinear | 부드러운 스케일링 (픽셀아트 스타일은 Point 권장) |
| Compression | None | UI 스프라이트 품질 보존 |
| Generate Mip Maps | off | UI는 고정 해상도, Mip Maps 불필요 |

---

## 9-slice 모범사례

9-slice(9-Patch)는 스프라이트를 9개 구역으로 나눠 모서리를 유지하면서 중간 영역만 늘리는 기법입니다.

### 적용 대상

| 컴포넌트 | 권장 여부 | 이유 |
|----------|----------|------|
| `Btn_Base`, `Panel_Base`, `Modal_Base` | 권장 | 크기 가변, 모서리 테두리 유지 필요 |
| `ItemSlot` | 권장 | 슬롯 배경 테두리 유지 |
| `ScrollList`, `Grid_Base` | 선택 | 배경 없으면 불필요 |
| `Text_Base` | 불필요 | Text 컴포넌트는 스프라이트 배경 없음 |

### 보더 설정 방법

1. Project 창에서 스프라이트 선택 → Inspector의 **Sprite Editor** 클릭
2. Border 입력란에 `L / B / R / T` 값(픽셀) 입력
3. **Apply** 후 Sprite Editor 닫기

보더 값은 `[left, bottom, right, top]` 순서이며 픽셀 단위 정수입니다.

---

## Sprite Atlas 모범사례

Sprite Atlas는 여러 스프라이트를 하나의 텍스처로 묶어 드로우콜을 줄입니다.

- 같은 UI 화면에 함께 등장하는 스프라이트는 같은 아틀라스에 포함합니다.
- 베이스 프리팹 스프라이트는 `UIBaseAtlas` 같은 전용 아틀라스로 묶기를 권장합니다.
- 아틀라스 이름은 `prefab-spec.json`의 `atlas` 필드에 기록합니다.

---

## 7개 베이스 컴포넌트

Game UI Studio의 기본 카탈로그는 7개 베이스 컴포넌트로 구성됩니다.

| 컴포넌트명 | kind | Unity 경로 | overridable |
|-----------|------|-----------|-------------|
| `Panel_Base` | panel | `Assets/UI/Prefabs/Panel_Base.prefab` | — |
| `Btn_Base` | button | `Assets/UI/Prefabs/Btn_Base.prefab` | label, iconSlot |
| `ScrollList` | scroll | `Assets/UI/Prefabs/ScrollList.prefab` | — |
| `Grid_Base` | grid | `Assets/UI/Prefabs/Grid_Base.prefab` | — |
| `Modal_Base` | modal | `Assets/UI/Prefabs/Modal_Base.prefab` | — |
| `Text_Base` | text | `Assets/UI/Prefabs/Text_Base.prefab` | label |
| `ItemSlot` | slot | `Assets/UI/Prefabs/ItemSlot.prefab` | iconSlot |

`examples/prefab-spec.json`에 이 7개 컴포넌트에 대한 현실적인 스펙 예시가 있습니다.

---

## 카탈로그 연결

`prefab-spec.json`의 `savePath`는 반드시 `catalog.json`의 `unity` 경로와 정확히 일치해야 합니다.

예시:
```json
// prefab-spec.json
"Btn_Base": { "savePath": "Assets/UI/Prefabs/Btn_Base.prefab" }

// catalog.json
"Btn_Base": { "unity": "Assets/UI/Prefabs/Btn_Base.prefab" }
```

불일치 시 파이프라인이 컴포넌트를 찾지 못해 조립 단계가 실패합니다.

---

## 사용 방법

### 1. 스펙 작성

```
/prefab-setup examples/prefab-spec.json
```

또는 `prefab-smith` 에이전트에게 스펙 작성을 요청합니다.

### 2. 스펙 검증

```
node runtime/validate-prefab-spec.mjs examples/prefab-spec.json
```

### 3. 가이드 생성

```
node runtime/prefab-guide.mjs examples/prefab-spec.json > setup-guide.md
```

### 4. Unity에서 베이스 프리팹 제작

생성된 가이드를 Unity 작업자에게 전달하여 베이스 프리팹을 제작합니다.

### 5. 카탈로그 동기화

```
node runtime/catalog-sync.mjs
```

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `examples/prefab-spec.json` | 7개 베이스 컴포넌트 스펙 예시 |
| `schema/prefab-spec.schema.json` | 스펙 JSON 스키마 (draft-07) |
| `runtime/validate-prefab-spec.mjs` | 스펙 검증 CLI |
| `runtime/prefab-guide.mjs` | 가이드 생성 CLI |
| `skills/base-prefab-smith/SKILL.md` | 스킬 정의 |
| `agents/prefab-smith.md` | 스펙 작성 도우미 에이전트 |
| `commands/prefab-setup.md` | `/prefab-setup` 커맨드 |
