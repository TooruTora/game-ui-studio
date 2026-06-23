---
description: 베이스 프리팹 셋업 가이드를 생성합니다. prefab-spec.json을 검증하고 Unity에서 따라 할 정밀 체크리스트 마크다운을 출력합니다. $ARGUMENTS는 prefab-spec.json 경로입니다.
---

# Base Prefab Smith 스킬

베이스 프리팹 셋업 워크플로우를 지원합니다. `prefab-spec.json` 스펙을 검증하고 Unity 작업자가 따라 할 정밀 셋업 가이드를 생성합니다.

> **원칙:** 이 스킬은 가이드를 생성합니다. Unity에서 자동 실행하지 않습니다. 미적 판단(색상, 크기, 폰트 등)은 사람이 결정합니다.

---

## 개념 설명

### 베이스 프리팹이란?

베이스 프리팹은 Game UI Studio 파이프라인의 **사전 준비물**입니다. 매니페스트 → 프리팹 조립 파이프라인이 실행되기 전에 사람이 Unity에서 직접 제작하는 원본 프리팹입니다.

- 파이프라인은 베이스 프리팹을 **인스턴스화**하여 매니페스트 레이아웃을 적용합니다.
- 베이스 프리팹의 스프라이트·임포트 세팅·9-slice 보더는 미적 기준점이므로 사람이 결정합니다.
- `catalog.json`의 `unity` 경로가 베이스 프리팹 저장 경로와 일치해야 합니다.

### 9-slice란?

9-slice(9-Patch)는 스프라이트를 9개 구역으로 나눠 모서리를 유지하면서 중간 영역만 늘리는 기법입니다. 버튼·패널·모달처럼 크기가 가변적인 UI에 사용합니다.

Border 값 `[left, bottom, right, top]`(픽셀)은 각 모서리 고정 영역 크기입니다.

### Sprite Atlas란?

여러 스프라이트를 하나의 텍스처로 묶어 드로우콜을 줄이는 Unity 기능입니다. 같은 UI 화면에 함께 등장하는 스프라이트는 같은 아틀라스에 포함하는 것을 권장합니다.

### 임포트 세팅 모범사례

| 항목 | 권장값 | 이유 |
|------|--------|------|
| Texture Type | Sprite | UGUI Image 컴포넌트 호환 |
| Sprite Mode | Single | 단일 스프라이트 기본값 |
| Pixels Per Unit | 100 | Unity 기본값, 프로젝트 통일 권장 |
| Filter Mode | Bilinear | 부드러운 스케일링 (픽셀아트는 Point) |
| Compression | None | UI 스프라이트 품질 보존 |
| Generate Mip Maps | off | UI는 고정 해상도, Mip Maps 불필요 |

---

## 워크플로우

### 1단계. prefab-spec.json 작성

`examples/prefab-spec.json`을 참고하여 프로젝트 스펙을 작성합니다. `prefab-smith` 에이전트가 스펙 작성을 도울 수 있습니다.

```json
{
  "Btn_Base": {
    "kind": "button",
    "sourceSprite": "Assets/UI/Source/btn_base.png",
    "savePath": "Assets/UI/Prefabs/Btn_Base.prefab",
    "import": { "filterMode": "Bilinear", "compression": "None" },
    "nineSlice": { "border": [12, 12, 12, 12] },
    "overridable": ["label", "iconSlot"]
  }
}
```

### 2단계. 스펙 검증

```
node runtime/validate-prefab-spec.mjs <prefab-spec-path>
```

- exit 0: 유효 → 다음 단계 진행
- exit 2: 오류 목록 출력 → 스펙 수정 후 재검증

### 3단계. 셋업 가이드 생성

```
node runtime/prefab-guide.mjs <prefab-spec-path> > setup-guide.md
```

생성된 마크다운을 Unity 작업자에게 전달합니다.

### 4단계. Unity에서 베이스 프리팹 제작

Unity 작업자가 가이드의 체크리스트를 따라 베이스 프리팹을 제작합니다.

- [ ] 소스 스프라이트 임포트 세팅 적용
- [ ] (해당 시) Sprite Editor에서 9-slice 보더 설정
- [ ] (해당 시) Sprite Atlas에 등록
- [ ] 프리팹 계층 생성 및 컴포넌트 부착
- [ ] 지정된 `savePath` 경로로 프리팹 저장

> **미적 판단은 사람이 결정합니다.** 색상, 폰트 크기, 간격, 애니메이션 등은 가이드에 명시되지 않으며 디자이너/아트팀이 결정합니다.

### 5단계. 카탈로그 동기화

모든 베이스 프리팹 제작 완료 후:

```
node runtime/catalog-sync.mjs
```

`savePath`가 `catalog.json`의 `unity` 경로와 일치하는지 확인합니다.

---

## 실행

스펙 경로: $ARGUMENTS

위 워크플로우에 따라 처리합니다. 스펙 경로가 제공된 경우 검증 후 가이드를 생성합니다.
