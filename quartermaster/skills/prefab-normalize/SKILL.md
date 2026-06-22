---
description: Quartermaster 프리팹 YAML 정규화 규칙 참조. runtime/normalize-prefab.mjs의 정규화 로직을 설명합니다. $ARGUMENTS로 특정 규칙을 조회할 수 있습니다.
---

# 프리팹 정규화 규칙 참조

> 정규화 로직의 구현체는 `runtime/normalize-prefab.mjs`입니다. 이 스킬은 해당 모듈의 동작을 설명하는 참조 문서입니다.

## 정규화 목적

Unity 프리팹 YAML은 저장할 때마다 `fileID`, 부동소수점 표현, 필드 순서가 달라질 수 있습니다. 머지플래너(`runtime/merge-planner.mjs`)가 기존 프리팹과 신규 매니페스트를 비교할 때 **양쪽을 정규화한 뒤 diff**해야 의미 없는 변경을 무시할 수 있습니다.

## 정규화 적용 위치

- 정규화는 **출력 단계(프리팹 YAML 비교 시)**에만 적용됩니다.
- 매니페스트 JSON에는 적용하지 않습니다.
- 데이터 흐름: `manifest(JSON) → merge-planner → [프리팹 YAML 읽기 → normalize → diff → 계획] → MCP 적용기`

## 정규화 규칙

### 1. 휘발 fileID → stableKey 치환

Unity가 자동 부여하는 `fileID`는 저장마다 바뀔 수 있는 휘발 값입니다.

- `QmManaged` 컴포넌트의 `stableKey` 필드를 정규화 키로 사용합니다.
- diff 비교 시 `fileID` 대신 `stableKey` 기반으로 오브젝트를 식별합니다.
- `stableKey`가 없는 오브젝트(사람이 직접 추가한 컴포넌트 등)는 `fileID`를 유지합니다.

### 2. 부동소수점 허용 오차

RectTransform의 `anchoredPosition`, `sizeDelta`, `offsetMin`, `offsetMax` 등 부동소수점 필드는 미세 차이가 의미 없는 변경을 유발합니다.

- 허용 오차: `1e-4` (0.0001) 이하 차이는 동일 값으로 처리합니다.
- 정규화 시 소수점 4자리로 반올림합니다.

### 3. Anchor 재기준

- `anchorMin`, `anchorMax`는 매니페스트의 추상 `anchor` 프리셋을 기준으로 정규화됩니다.
- 수동으로 조정된 anchor 값은 매니페스트 anchor 프리셋과 비교해 오버라이드 여부를 판정합니다.

### 4. 필드 키 정렬

YAML 출력 시 필드를 알파벳 순으로 정렬합니다.

- 정렬 기준: Unity YAML 필드명 알파벳 오름차순
- 목적: 저장 순서 차이로 인한 false diff 방지

## 테스트 픽스처

- `test/fixtures/golden/` — 프리팹 정규화 골든 픽스처 (트랙 B 소유)
- 정규화 전/후 쌍을 비교해 `normalize-prefab.mjs` 동작을 검증합니다.

---

$ARGUMENTS
