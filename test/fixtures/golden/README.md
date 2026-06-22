# test/fixtures/golden — 프리팹 정규화 골든 (트랙 B 소유, DB.2)

## 소유권

이 디렉토리는 **트랙 B(키영속/정규화)** 소유다. 트랙 A(매니페스트/카탈로그)는 이 디렉토리를 읽지 않는다.  
CONTRACT.md §(iii) 참조.

## Unity 의존 골든

> **Unity 환경 필요**: 실제 Unity 프리팹에서 추출한 YAML 골든 파일은 Unity Editor가 설치된 환경에서만 생성 가능하다.  
> CI에서는 Unity 라이선스 없이 실행되므로 Unity-dependent 골든 테스트는 skip 마킹한다.

Unity 프리팹 골든 파일 형식 (생성 후 여기 배치):

```
golden/
  Panel_Roster.prefab.golden.yaml     ← Unity Editor export 후 normalize 결과
  ScrollList_Mercs.prefab.golden.yaml
  Btn_Recruit.prefab.golden.yaml
```

생성 명령 (Unity 환경에서):
```sh
node runtime/normalize-prefab.mjs Assets/UI/Prefabs/Panel_Base.prefab > test/fixtures/golden/Panel_Roster.prefab.golden.yaml
```

## 합성 YAML 골든 (non-Unity-dependent)

`normalize-synthetic.golden.yaml` — `normalizePrefab()` 함수의 합성 YAML 입력 골든.  
Unity 환경 없이 `normalize-prefab.test.mjs`에서 직접 검증한다.

골든 재생성 방법:
```sh
node -e "
import('./runtime/normalize-prefab.mjs').then(m => {
  const yaml = \`%YAML 1.1
%TAG !u! tag:unity3d.com,2011:
--- !u!1 &1000000
GameObject:
  m_ObjectHideFlags: 0
  m_Name: Panel_Root
  m_Component:
  - component: {fileID: 1000001}
--- !u!224 &1000001
RectTransform:
  m_ObjectHideFlags: 0
  m_LocalPosition: {x: 0.123456789, y: -0.987654321, z: 0}
  m_LocalScale: {x: 1.000001, y: 1.000001, z: 1.000001}
  m_AnchorMin: {x: 0, y: 0}
  m_AnchorMax: {x: 1, y: 1}
\`;
  const keyMap = { 'panel.root': 1000000, 'panel.root.rect': 1000001 };
  const out = m.normalizePrefab(yaml, keyMap);
  process.stdout.write(out);
});
" > test/fixtures/golden/normalize-synthetic.golden.yaml
```

## 골든 업데이트 정책

1. 골든 파일을 업데이트할 때는 반드시 변경 이유를 커밋 메시지에 명시한다.
2. Unity 골든은 Unity 환경 보유자만 업데이트 가능하다.
3. 합성 골든은 `normalizePrefab` 구현이 변경될 때 재생성한다.
4. 골든 diff가 의도치 않게 변경된 경우 CI가 RED를 반환한다.
