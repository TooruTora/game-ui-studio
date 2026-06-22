# Quartermaster 공유 데이터 계약 (D0.9 — 트랙 병렬 진입 선결조건, 동결)

> 이 문서는 트랙 A(매니페스트/카탈로그)와 트랙 B(키영속/정규화)가 M4에서 충돌 없이 합류하기 위한 **동결된 인터페이스 계약**이다. 변경은 ADR-공유데이터계약 개정을 통해서만 가능하다.

## (i) 안정키 ↔ 카탈로그/매니페스트 필드 매핑

- 매니페스트의 각 element는 **`key`**(string, 필수, 안정 식별자)를 가진다. 형식: 점 구분 경로형 슬러그 (예: `panel.roster`, `list.mercs`, `btn.recruit`). 정규식: `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$`.
- 이 `key`가 Unity 프리팹에서 **QmManaged 마커 컴포넌트의 `stableKey` 필드**에 그대로 박힌다 (트랙 B 소유). 즉 `manifest.element.key === QmManaged.stableKey`.
- 카탈로그 항목은 **`component` ID**(매니페스트의 `component` 필드가 참조)로 식별된다. 카탈로그 항목 자체는 stableKey를 갖지 않는다 (카탈로그는 부품 타입 사전, key는 인스턴스 식별자).
- **계약**: 머지플래너는 `manifest.element.key`로 기존 프리팹 인스턴스(QmManaged.stableKey 매칭)를 식별해 add/update를 판정한다.

## (ii) 정규화 단계 위치

- 정규화(`normalize-prefab.mjs`)는 **출력 단계**에 적용된다 — 즉 머지플래너가 프리팹 YAML을 비교/diff할 때 양쪽을 정규화한 뒤 비교한다.
- 매니페스트 생성/검증 파이프라인(트랙 A)은 정규화를 거치지 않는다. 정규화는 **프리팹 YAML 전용**(트랙 B)이며 매니페스트 JSON에는 적용하지 않는다.
- 데이터 흐름: `manifest(JSON) → merge-planner → [프리팹 YAML 읽기 → normalize → diff → 계획] → MCP 적용기`.

## (iii) 골든 픽스처 소유권 / 공유

- `test/fixtures/golden/` — **프리팹 정규화 골든**(트랙 B 소유, DB.2). 트랙 A는 읽지 않는다.
- `test/fixtures/manifests/` — **매니페스트 예제/검증 픽스처**(트랙 A 소유, M1). 트랙 B는 읽지 않는다.
- `test/e2e/GS1`, `test/e2e/GS2` — **공유**(M4/M5). GS1=보존 골든, GS2=데이터 무손실. 소유권은 M4 합류 시점에 리드가 관리, 갱신은 양 트랙 합의 필요.
- 규칙: 트랙 전용 픽스처는 해당 트랙만 수정. 공유 픽스처(GS1/GS2)는 합류 후에만 활성, 그 전엔 스텁.

## 검증 계약 (D0.2 — 3계층, 단일 검증 코어 공유)

- L2(Write hook)와 L3(CI)는 **동일한 `runtime/validate-manifest.mjs` 코어**를 호출한다 (검증 로직 SSOT).
- `validate-manifest.mjs`는 `manifest.schema.json` + `catalog.json`(있으면)을 입력으로 받아 `{ ok: boolean, errors: [{ code, key, message }] }`를 반환한다. exit code: 유효=0, 무효=2(차단용).
- 거부 코드: `SCHEMA_VIOLATION`, `CATALOG_UNKNOWN_COMPONENT`, `DUPLICATE_KEY`, `MISSING_REQUIRED`, `OVERRIDABLE_VIOLATION`, `INVALID_KEY_FORMAT`.

## 스키마 델타 (트랙 A, 동결)

- `element.columns` (integer ≥1) 추가: layout=grid의 열 개수. 구조적 관리필드(MANAGED_FIELDS / MANAGED_FIELD_NAMES에 포함), overridable 게이팅 대상 아님. validate-manifest·merge-planner·preview가 모두 인지해야 함.

## 런타임 계약

- 모든 `runtime/*.mjs`는 ESM, Node ≥18. 순수 함수는 default export + named export로 테스트 가능하게.
- hook command는 `node "${CLAUDE_PLUGIN_ROOT}/runtime/<file>.mjs"` 형태로 호출 (Windows .cmd/.bat 직접호출 회피).
