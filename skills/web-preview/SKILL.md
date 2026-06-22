---
description: 매니페스트 JSON을 HTML 웹 프리뷰로 렌더하고, 깨진 레이아웃 경고를 수집해 사람이 브라우저로 검수할 수 있게 합니다. $ARGUMENTS는 매니페스트 경로와 선택적 카탈로그 경로를 받습니다.
---

# Web Preview 스킬

매니페스트 JSON → HTML 프리뷰 렌더 → 레이아웃 경고 수집 → 브라우저 검수 흐름을 실행합니다.

---

## UGUI 시맨틱 모사 원칙

프리뷰 HTML은 Unity UGUI 레이아웃을 웹 CSS로 근사 모사합니다.

| UGUI 개념 | 프리뷰 CSS 표현 |
|---|---|
| `LayoutGroup` (Vertical/Horizontal) | `display:flex` + `flex-direction` |
| `GridLayoutGroup` (columns 지정) | `display:grid; grid-template-columns:repeat(N,1fr)` |
| `GridLayoutGroup` (columns 미지정) | `display:grid; grid-template-columns:repeat(auto-fill,minmax(80px,1fr))` |
| `RectTransform` anchor 프리셋 | `.gui-el--{anchor}` CSS 클래스 |
| `ScrollRect` | `overflow:auto` + `gui-scroll--{direction}` |
| `repeat` (동적 리스트) | children[0]을 N회 반복 표시 (최대 5회 미리보기) |

프리뷰는 시각적 근사입니다. 픽셀 퍼펙트 일치를 보장하지 않으며, 구조·앵커·레이아웃 확인 목적으로 사용합니다.

---

## 실행 절차

### 1. 매니페스트 검증

```
node runtime/validate-manifest.mjs <manifest-path> [catalog-path]
```

- 유효(exit 0): 다음 단계 진행
- 무효(exit 2): 오류 목록 출력. **매니페스트만 수정** 후 재시도. Unity 파일은 건드리지 않습니다.

### 2. HTML 렌더

```
node runtime/preview.mjs <manifest-path> [catalog-path] > preview.html
```

- `renderPreview(manifest, catalog)` → `{ html }` 반환
- 순수·결정적 함수: 동일 입력은 항상 동일 HTML 출력
- `layout=grid` + `columns` 있으면 `grid-template-columns:repeat(N,1fr)` 인라인 적용
- `layout=grid` + `columns` 없으면 `auto-fill` CSS 클래스 폴백

### 3. 레이아웃 경고 수집

```
node runtime/preview-lint.mjs <manifest-path> [catalog-path]
```

비차단(항상 exit 0). 아래 경고 코드를 수집해 stdout에 출력합니다.

| 코드 | 설명 |
|---|---|
| `LINT_UNKNOWN_COMPONENT` | catalog 주어졌는데 component 미등재 — 프리뷰 품질 저하 가능 |
| `LINT_FIXED_OVERFLOW` | 자식 고정 치수 합이 부모 고정 치수 초과 — 오버플로 위험 |
| `LINT_REPEAT_NO_TEMPLATE` | repeat 있는데 children 비어있음 — 반복 템플릿 없음 |
| `LINT_GRID_NO_COLUMNS` | layout=grid인데 columns 없음 — auto-fill 폴백 사용 중 |
| `LINT_MISSING_ANCHOR` | 최상위 element에 anchor 없음 — 레이아웃 위치 모호 |

경고는 참고용이며 파이프라인을 차단하지 않습니다. 단, 경고가 있으면 매니페스트 수정을 검토하십시오.

### 4. 브라우저 검수

생성된 `preview.html`을 브라우저로 열어 레이아웃을 확인합니다.

```
# 예시 (Windows)
start preview.html

# 예시 (macOS)
open preview.html
```

검수 체크리스트:
- [ ] 화면 구조(패널·버튼·리스트)가 의도대로 배치되어 있는가?
- [ ] anchor가 올바르게 적용되었는가? (stretch는 전체 채움, top/bottom은 상하 정렬)
- [ ] grid columns 수가 예상과 일치하는가?
- [ ] repeat 리스트 템플릿이 올바르게 표시되는가?
- [ ] 경고 항목(overflow, missing anchor 등)을 매니페스트에서 수정했는가?

---

## NG 시 수정 원칙

프리뷰가 의도와 다를 경우 **매니페스트 JSON만 수정**하고 2~3단계를 재실행합니다.
Unity 프리팹 파일(.prefab)은 이 스킬에서 건드리지 않습니다. Unity 적용은 머지플래너(merge-applier)가 담당합니다.

수정 예시:
- 열 수 조정: `"layout": "grid", "columns": 4` 추가 또는 변경
- 앵커 추가: `"anchor": "stretch"` 추가
- 반복 템플릿 추가: `"repeat": 5, "children": [{ ... }]`
- 오버플로 수정: 자식 width/height 합이 부모를 초과하지 않도록 조정
