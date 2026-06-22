# GS1 — 보존 골든 시나리오 (stableKey Preservation)

> **Unity 환경 필요**: 이 e2e 시나리오는 Unity Editor 및 QmManaged 컴포넌트가 설치된 환경에서만 실행 가능하다.  
> CI(GitHub Actions)에서는 Unity 라이선스 없이 실행되므로 자동화 검증 불가. 수동 수용 기준으로 관리한다.  
> CONTRACT.md §(iii) — 공유 픽스처, M4 합류 후 양 트랙 합의 필요.

---

## 목적

Quartermaster가 생성한 프리팹에 부착된 `QmManaged.stableKey`가 다음 작업 후에도 보존됨을 보장한다:

- 매니페스트 수정 → 재조립 (add/override만 발생, remove 없음)
- View 스크립트 수동 부착 후 재조립 (사용자 수정 보존)

---

## 사전 조건

| 항목 | 상태 |
|------|------|
| Unity 2022.3 LTS 이상 설치 | 필요 |
| Quartermaster 플러그인 설치 | 필요 |
| `test/fixtures/manifests/roster.manifest.json` 존재 | 트랙 A 제공 |
| `runtime/merge-planner.mjs` 구현 완료 | 트랙 B 필요 |
| `runtime/normalize-prefab.mjs` 구현 완료 | 트랙 B 필요 |

---

## 단계별 시나리오

### Step 1 — 초기 설계 (Design)

```
Action: Claude Code에서 roster.manifest.json 작성
Input:  test/fixtures/manifests/roster.manifest.json
Expected:
  - manifest.schema.json 유효 (L1 통과)
  - validateManifest(manifest, catalog) → { ok: true }
```

수용 기준:
- `elements[*].key`가 모두 `^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$` 패턴 충족
- `refResolution`이 [width, height] 2원소 배열

---

### Step 2 — 프리팹 프리뷰 (Preview)

```
Action: renderPreview(manifest, catalog) 호출
Expected:
  - { html } 반환
  - html에 panel.roster, list.mercs, panel.detail, btn.recruit 포함
  - html이 결정적 (2회 호출 동일 출력)
```

수용 기준:
- 웹 브라우저에서 html 렌더링 시 레이아웃 구조가 시각적으로 확인 가능
- repeat:"mercs" 요소가 반복 리스트 컨테이너로 표시됨

---

### Step 3 — 초기 조립 (Assemble)

```
Action: Quartermaster → Assemble RosterScreen
Expected:
  - Assets/UI/Scenes/RosterScreen.prefab 생성
  - 각 element의 GameObject에 QmManaged 컴포넌트 부착
  - QmManaged.stableKey === element.key (계약 §(i))
```

수용 기준 (Unity Inspector에서 확인):

| GameObject | QmManaged.stableKey |
|------------|---------------------|
| Panel_Roster | `panel.roster` |
| ScrollList_Mercs | `list.mercs` |
| Panel_Detail | `panel.detail` |
| Btn_Recruit | `btn.recruit` |

---

### Step 4 — 수동 View 부착 (Manual Attachment)

```
Action: Unity에서 RosterScreen 프리팹 열기 → Btn_Recruit에 MercRecruitView.cs 스크립트 수동 추가
Expected:
  - GameObject에 MercRecruitView 컴포넌트 추가됨
  - QmManaged.stableKey: "btn.recruit" 유지됨
  - 프리팹 저장 성공
```

수용 기준:
- QmManaged.stableKey가 수동 부착 후에도 "btn.recruit"로 유지됨
- 다른 QmManaged 컴포넌트 미영향

---

### Step 5 — 매니페스트 수정 (Modify Manifest)

```
Action: roster.manifest.json에서 btn.recruit의 label을 "용병 고용" → "모집"으로 변경
Expected:
  - validateManifest → ok:true (여전히 유효)
  - planMerge(existingTree, modifiedManifest) → ops에 {type:'override', key:'btn.recruit'} 포함
  - ops에 {type:'remove', ...} 없음
```

수용 기준:
- planMerge 결과에 remove 타입 ops 0건
- override op이 btn.recruit에 한정됨 (변경되지 않은 keys는 ops에 없음)

---

### Step 6 — 재조립 (Re-Assemble)

```
Action: Quartermaster → Assemble RosterScreen (수정된 manifest로)
Expected:
  - Btn_Recruit의 라벨이 "모집"으로 업데이트
  - MercRecruitView.cs 컴포넌트 보존 (수동 부착 유지)
  - 모든 QmManaged.stableKey 불변
```

수용 기준 (Unity Inspector):

| 검증 항목 | 기대값 | 실제값 |
|----------|--------|--------|
| Btn_Recruit.label | "모집" | __ |
| Btn_Recruit.QmManaged.stableKey | "btn.recruit" | __ |
| Btn_Recruit에 MercRecruitView 존재 | true | __ |
| panel.roster.QmManaged.stableKey | "panel.roster" | __ |
| list.mercs.QmManaged.stableKey | "list.mercs" | __ |

---

## 실패 정의

다음 중 하나라도 발생하면 GS1 FAIL:

1. 재조립 후 어떤 GameObject의 `QmManaged.stableKey`가 변경됨
2. 수동 부착한 `MercRecruitView.cs`가 제거됨
3. planMerge에서 `{type:'remove', ...}` op이 생성됨
4. 재조립 후 UI 구조가 manifest와 다름

---

## 현재 상태

- M4 합류 전: **스텁** (자동화 불가, 수동 체크리스트로 관리)
- M4 합류 후: 양 트랙 합의하에 자동화 e2e 작성 예정
