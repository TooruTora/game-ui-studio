# QmManaged — 파이프라인 관리 마커 (사용자 프로젝트 동기화 부품)

이 폴더의 자산은 **사용자 Unity 프로젝트의 `Assets/Quartermaster/` 아래로 동기화**된다 (D0.8 동기화 모델).

## 왜 동기화가 필요한가

- `${CLAUDE_PLUGIN_ROOT}`(플러그인 설치 위치)는 **업데이트마다 경로가 바뀐다.** 따라서 Unity가 이 경로를 직접 참조/컴파일하게 둘 수 없다.
- Unity는 `Assets/` 아래의 스크립트만 컴파일/인식한다 (ADR-PluginData경로결정 참조).
- 그래서 SessionStart hook / 스킬 첫 실행이 `QmManaged/`를 사용자 `Assets/Quartermaster/`로 **멱등 복사**한다.

## 동기화 정책 (3-way, D0.8 / ADR-3way복사정책)

버전 문자열 비교가 아니라 **콘텐츠 해시 + 사용자 수정 감지**로 판정한다:

| 플러그인 변경 | 사용자 수정 | 동작 |
|---|---|---|
| 없음(해시 일치) | — | **skip** |
| 있음(해시 불일치) | 없음 | **덮어쓰기** |
| 있음 | 있음(충돌) | **사용자 선택** (비대화형 CI는 안전 기본값 = skip + 경고 리포트) |
| 없음 | 있음 | skip (사용자 수정 보존) |

이 정책이 **GS2(데이터 무손실 골든)** 로 검증된다 — 사용자가 `Assets/Quartermaster` 파일을 수정한 뒤 플러그인 재설치/버전업해도 수정분이 유실되지 않아야 한다. (현재 RED, Unity 환경 필요)

## 포함 자산

- `QmManaged.cs` — 안정 키(stableKey) 마커 MonoBehaviour. 키영속 K-B 진실원천 (D-A).
