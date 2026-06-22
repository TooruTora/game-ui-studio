# Game UI Studio v0.3 — Claude Code 플러그인 구현 계획 (RALPLAN 합의 확정본)

> 상태: **PENDING APPROVAL** (Planner·Architect·Critic 합의 APPROVE, 라운드 3 봉인 / DELIBERATE 모드)
> 원본 설계: `docs/ui-pipeline-plugin-plan-v3.html`
> 배포: 단일 GitHub 레포 = 플러그인 + 마켓플레이스
> 실행은 별도 승인 필요 — 이 문서는 계획 정본이며, 코드/파일 생성 전 사용자 승인 대기.

---

## 0. 한 줄 요약

자연어 → 매니페스트(JSON) → 웹 프리뷰 검수 → Unity 프리팹 멱등 조립까지 책임지고, View/로직 `.cs`는 사람이 쓰는 Claude Code 플러그인. **코드 생성 없음.** MVP는 트랙 A(M1~M3, Unity 무의존)로 가설을 싸게 검증, 가장 어려운 멱등 머지·키영속은 병렬 트랙 B로 동시 사격.

---

## 1. RALPLAN-DR 요약

### 원칙 (5)
- **P1 — 경계는 일찍, 구현은 늦게.** D1·D-C 인터페이스·CI 검증전략은 M0/M1에서 못박고, 사이드카·정규화 풍부화·머지플래너 완전구현은 증거 축적 후로.
- **P2 — 가장 싸게 가장 치명적인 가설을 먼저 죽인다.** 표현력(R3)·키영속(A5) 두 치명 가설을 직렬로 엮지 않고 병렬 트랙으로 동시 사격.
- **P3 — 정확성은 결정적 코드, 판단은 LLM.** 검증/프리뷰/머지플래닝/정규화는 결정적 JS. 설계와 MCP 적용기만 LLM.
- **P4 — 진실원천은 git이 추적할 수 있는 곳에만.** K-B(프리팹 내장 마커)가 진실원천. git 밖(`${CLAUDE_PLUGIN_DATA}`)은 재구성 가능 캐시로만.
- **P5 — 규약은 실제 로드되는 표면에만 싣는다.** 플러그인 루트 CLAUDE.md는 컨텍스트로 로드되지 않음 → 강제 규약은 스킬 콘텐츠가 단일 정본.

### 의사결정 동인 (top 3)
- **DD1 가설 무효화 비용 최소화** / **DD2 규약의 실효성**(로드 안 되면 0가치) / **DD3 보존(A5)의 협업 성립성**(팀/CI 전반 git 추적).

### 핵심 결정 (확정)
| 결정 | 채택 | 기각 |
|---|---|---|
| D1 런타임 | **Node.js 하이브리드** (정확성=결정적 JS, 판단=LLM) | 순수 마크다운(검증/머지 비결정·테스트불가, hook 셸요구 불충족), Python(Windows 파편화) |
| D2 코드/LLM 경계 | 설계=LLM에이전트 / 검증=결정적 hook / 프리뷰=순수함수 / **멱등머지=2단 분리**(머지플래너 결정적 JS + MCP 적용기 LLM). M4=추가+오버라이드 전용 | 통짜 LLM 머지(보존 판단불가·테스트불가) |
| D-A 안정키 영속 | **K-B 단독**(ManagedMarker 마커 내장 stable key, git 추적)=진실원천. K-C 사이드카는 재구성 가능 인덱스로 강등, MVP 제외 | K-A name 인코딩(리네임 취약), K-C 우선(git 밖 → 팀/CI 보존 깨짐) |
| 컨벤션 주입 | **강제규약=`skills/manifest-schema/SKILL.md` 단일정본** + 에이전트는 축약/포인터. CLAUDE.md는 사람용 문서로 격하 | CLAUDE.md 기재(비로드 → 무효) |
| D3 배포 | **단일 GitHub 레포 = 플러그인 + 마켓플레이스**, SemVer+git태그 (plugin.json·marketplace.json 둘 다 version 금지) | 레포 분리(과설계) |

---

## 2. 플러그인 디렉토리 구조 (Claude Code 규격 정합, 공식문서 2026-06 확인)

```
game-ui-studio/                       # GitHub 레포 루트 = 플러그인 루트
├─ .claude-plugin/
│  ├─ plugin.json                    # 필수. name(kebab) 필수. version 키 없음(마켓플레이스와 충돌 금지)
│  └─ marketplace.json               # {name, owner{name,email}, plugins:[{name, source:"."}]}. version 키 없음
├─ commands/
│  └─ qm.md                          # /game-ui — 의도적 사용자 진입점 thin 래퍼(내부 skill 위임). 그 외 commands 없음
├─ skills/                           # 일급 진입점 (/game-ui-studio:<skill>)
│  ├─ game-ui-studio/SKILL.md         # 메인 오케스트레이션 ($ARGUMENTS)
│  ├─ manifest-schema/SKILL.md       # ★강제규약 단일 정본: 스키마·네이밍·MVC·"카탈로그 외 component 금지"·안정키
│  └─ prefab-normalize/SKILL.md      # 정규화 규칙 참조 콘텐츠
├─ agents/
│  ├─ ui-designer.md                 # 설계 LLM(opus급). 규약 본문 중복 0 — manifest-schema 정본 포인터+축약만
│  └─ merge-applier.md               # MCP 적용기 LLM(sonnet급). 플러그인 에이전트는 hooks/mcpServers/permissionMode 미지원 준수
├─ hooks/
│  └─ hooks.json                     # PreToolUse(Write, if:"Write(*.manifest.json)") 검증 / SessionStart Unity·MCP 점검
├─ runtime/                          # 결정적 JS 코어(Node ≥18). 모든 hook command가 Node 래핑 호출(.cmd/.bat 직접호출 회피)
│  ├─ validate-manifest.mjs
│  ├─ preview.mjs                    # 순수 함수
│  ├─ merge-planner.mjs              # 멱등, 추가+오버라이드
│  ├─ normalize-prefab.mjs           # 휘발 fileID→stablekey, 부동소수 허용오차, 앵커 재기준, 키 정렬
│  ├─ key-index.mjs                  # K-C 재구성기 (MVP 비활성)
│  └─ env-check.mjs                  # Node·Unity·MCP 점검 (SessionStart)
├─ test/
│  ├─ fixtures/golden/               # 프리팹 정규화 골든 픽스처 (일급)
│  └─ e2e/                           # e2e 골든 시나리오 (GS1 보존, GS2 데이터 무손실)
├─ .mcp.json                         # {mcpServers:{unity:{...}}}. stdio 자동재연결 안 됨 → 폴백 명세 적용
├─ ManagedMarker/                        # 사용자 Unity 프로젝트 Assets/GameUiStudio/로 동기화할 마커/런타임
├─ CLAUDE.md                         # 사람용 문서 전용. 첫 줄에 "로드 안 됨, 규약은 manifest-schema 스킬" 명기
├─ README.md, LICENSE(MIT), package.json
```

**규격 핵심**: `.claude-plugin/`엔 plugin.json만. skills/commands/agents/hooks/.mcp.json은 루트. SKILL.md frontmatter `description` 필수. 에이전트 frontmatter `name`/`description` 필수, `model`(opus/sonnet/haiku). hooks command 타입은 stdin JSON. Windows: exec형식(args배열)은 .exe만 → Node 래핑. 경로변수 `${CLAUDE_PLUGIN_ROOT}`(업데이트마다 변경)·`${CLAUDE_PLUGIN_DATA}`(영구). 마켓플레이스 설치: `/plugin marketplace add <owner/repo>` → `/plugin install game-ui-studio@<marketplace>`. 검증: `claude plugin validate .`.

---

## 3. 마일스톤 구조

### M0 — 부트스트랩 + 4게이트 스파이크 (트랙 병렬 진입 단일 관문)

| ID | Deliverable | 산출 | 측정가능 수용기준 |
|---|---|---|---|
| D0.1 | 컨벤션 주입 정합성 (SSOT 재정렬) | manifest-schema SKILL.md, ui-designer.md | 정본 **정확히 1개** / 에이전트 규약본문 **중복 0(grep)** / CLAUDE.md 미로드 결정증명("스킬정본 vs CLAUDE.md" 2자 대조) |
| D0.2 | 검증 게이트 3계층 | hooks.json, validate-manifest.mjs, CI 잡 | L1 설득(에이전트) / L2 차단(Write hook `if:"Write(*.manifest.json)"`) / **L3 CI 전수(MVP 필수)** — 무효 매니페스트 결정 차단 + **MCP 직접조립 우회도 CI 100% 차단** |
| D0.4 | Node prerequisite | env-check.mjs | Node ≥18 LTS 게이트, 미충족 폴백. Windows .cmd/.bat 직접호출 금지·Node 래핑 검증 |
| D0.8 | ManagedMarker 동기화 모델 | D0.8 명세, GS2 픽스처 | (i) `${CLAUDE_PLUGIN_DATA}` vs `Assets/` 경로 ADR(Unity Assets/ 제약 명문화) (ii) **버전문자열 금지, 콘텐츠해시+사용자수정 3-way**(해시일치/불일치 × 수정유/무 4상한) (iii) **GS2: 재설치/버전업 시 사용자 수정분 무손실** 결정증명 |
| D0.9 | 트랙 A↔B 공유 데이터계약 동결 | D0.9 명세 | (i) 안정키↔카탈로그 필드 매핑(명/타입) (ii) 정규화 입력/출력 단계 위치 (iii) 골든픽스처 공유/분리 + 소유권 규칙 |

**M0 Exit Checklist (9항목 전수 통과 시에만 트랙 병렬 진입):**
`[ ] D0.1` `[ ] D0.2-L2` `[ ] D0.2-L3` `[ ] D0.8-경로` `[ ] D0.8-3way` `[ ] D0.8-GS2` `[ ] D0.9-(i)` `[ ] D0.9-(ii)` `[ ] D0.9-(iii)`

**게이트 전체실패 분기:** 4게이트 중 하나라도 결정 실패 시 병렬 중단 + 게이트별 폴백 — D0.1 실패→컨벤션 주입 재설계, D0.2 실패→CI 단독(L3)으로 축소·Write hook 폐기, D0.8 실패→ManagedMarker 읽기전용 강등(사용자 영역 비침범), D0.9 실패→트랙 직렬화(A→B) 폴백.

### 트랙 A — MVP (Unity 무의존): M1 → M2' → M3

- **M1 스키마 + R3 표현력 (전진배치):** manifest-schema 정본·스키마. 수용: **스크롤 뷰 + 동적 N 반복 리스트**를 스키마로 표현 가능 증명(또는 불가 명확 판정 → 설계 재논의 트리거). 컨벤션 로드 회귀.
- **M2' 카탈로그 무의존부:** 카탈로그 데이터모델/스키마, CI 테스트(중복키·누락·"카탈로그 외 참조" 거부).
- **M3 web-preview MVP (종료점):** preview.mjs 순수함수. 수용: (a) **손작성 2~3화면 표현 커버리지 100%**(분모=골든화면 등장 UI요소 종류) (b) **의도적 깨진 레이아웃(겹침/오버플로/카탈로그외참조) 탐지·거부** (c) 동일 매니페스트→동일 프리뷰(결정성).

### 트랙 B — Unity 리스크 소거 (병렬): M1.S

- **키영속 4시나리오 (전부 결정적 테스트):** ①저장/재로드 ②머지(컴포넌트 추가/오버라이드) ③에디터 수동 이동/리네임 ④Unity 마이너 버전업 후 stable key 유지.
- **정규화 명세 + 골든(DB.2):** 비표준 YAML(`!u!114 &...`) 파싱, 정규화 규칙(휘발 fileID→stablekey / 부동소수 허용오차 / 앵커 재기준 / 키 정렬) 골든 픽스처 검증.
- **MCP 인벤토리 + 폴백(DB.3):** 명령 인벤토리(인스턴스화/컴포넌트추가/필드설정/sibling순서/트리읽기/저장/리임포트). **폴백 = (1) MCP PR/포크, 또는 (2) MCP 우회: 머지플래너가 프리팹 YAML 직접 생성/패치 후 리임포트.** SessionStart hook으로 Unity Editor/MCP 가용성 사전점검.

### M4 — 합류: 추가+오버라이드 전용 재조립
머지플래너 + merge-applier(LLM). 수동 부착(View) 보존. **D4.2 롤백 원자성**(재조립 중간 실패 시 백업 복구, 부분적용 잔존 없음). **e2e GS1 보존골든**. remove("확인 후 제거")는 **M6 후속**.

### M5 — 마켓플레이스 배포 + 관측성
`claude plugin validate .` 통과. **관측성 3로그**: hook diff 로그 / merge-planner 결정 로그 / 검증 거부 사유 로그.

### M6 (후속, 범위 외) — remove("확인 후 제거"). 별도 게이트.

---

## 4. Pre-mortem 매핑표 (10건)

| # | 실패 시나리오 | 트리거 | 탐지/방어 | 측정 게이트 |
|---|---|---|---|---|
| PM1 | 배포 규약이 에이전트에 미적용 | CLAUDE.md에 규약(비로드) | manifest-schema 정본 임베드 + 로드 검증 | D0.1 |
| PM2 | 스키마가 스크롤·반복리스트 표현 불가 | 동적 N 리스트/중첩 스크롤 | R3 M1 전진 사격 | M1 |
| PM3 | stable key 팀/CI 유실 | 키매핑 git 밖 | K-B 단독 + git 추적 위치 | M1.S |
| PM4 | 매니페스트 검증이 저장 못막음 | hook 이벤트 오매핑 | PreToolUse(Write) exit2 + 폴백 | D0.2 |
| PM5 | 재조립 중간실패로 프리팹 손상 | 적용기 예외 | 백업→복구 원자성 | M4 D4.2 |
| PM6 | MCP가 Unity GUI 의존·재연결 불가 | Unity 미기동/stdio 끊김 | YAML 직접패치 폴백 + 트랙A 계속 | D0.6/DB.3 |
| PM7 | fileID·부동소수 휘발로 diff 폭발 | Unity 재저장 변동 | 정규화 규칙 일급화 + 골든 | DB.2 |
| PM8 | **데이터 유실** — 재설치 시 사용자 Assets/ 수정 소실 | 버전 비교 무조건 복사 | 3-way 정책 + GS2 무손실 골든 | D0.8-GS2 |
| PM9 | **트랙 합류 표류** — A/B 스키마 가정 불일치 | D0.9 미동결 병렬진입 | 공유계약 동결 + exit 차단 게이트 | D0.9 |
| PM10 | **검증 우회** — Write 회피 MCP 직접조립 | Write hook 도구명 한정 | L3 CI 전수 MVP 필수 + 우회 픽스처 | D0.2-L3 |

---

## 5. 확장 테스트 계획

- **단위(Unity 무의존):** validate-manifest(유효/무효/카탈로그외 거부) · normalize-prefab(fileID 치환·허용오차·앵커 재기준·키 정렬) · merge-planner(추가/오버라이드 결정성, remove 미발생) · preview(결정성, 깨진 레이아웃 탐지) · env-check.
- **통합(Unity):** D0.2 Write 차단 · M1.S 키영속 4시나리오 · DB.2 정규화 골든 라운드트립 · D4.2 실패 주입→복구.
- **e2e(골든):** GS1 보존(설계→프리뷰→조립→수동 View 부착→매니페스트 수정→재조립→부착·키 보존) / GS2 데이터 무손실(재설치/버전업).
- **관측성:** hook diff 로그 · merge-planner 결정 로그 · 검증 거부 사유 로그. GS1/GS2가 수집·검증.

---

## 6. ADR

**핵심 ADR:** Node 하이브리드(D1) + 머지 2단 분리(D2) + 키영속 K-B 단독 git추적(D-A) + 규약 스킬 단일정본 + 단일레포 마켓플레이스(D3). Drivers: DD1/DD2/DD3. 기각: 순수MD·통짜LLM머지·K-C우선·CLAUDE.md규약.

**신규 ADR 4건** (각 Decision/Drivers/Alternatives/Why/Consequences/Follow-ups):
- **ADR-PluginData경로결정** — ManagedMarker를 Unity 제약 검증 결과에 따라 `Assets/GameUiStudio/`(제약 사실 시 명문화) 또는 `${CLAUDE_PLUGIN_DATA}`에 배치.
- **ADR-3way복사정책** — 복사 판정을 콘텐츠 해시 + 사용자수정 감지 기반 3-way(skip/덮어쓰기/사용자선택). 4상한 커버.
- **ADR-공유데이터계약** — 트랙 병렬 진입 전 안정키 필드/정규화 단계/골든 공유여부 동결.
- **ADR-검증3계층** — 설득(L1)→차단(L2 Write hook)→전수(L3 CI), L3 MVP 필수 승격.

---

## 7. 첫 실행 단위 (승인 시 가장 먼저)

**M0 4게이트 스파이크** — D0.1(SSOT 컨벤션 로드 증명) · D0.2(3계층 검증, Write hook + CI 우회 차단) · D0.8(경로 ADR + 3-way + GS2 무손실) · D0.9(공유 데이터계약 동결). M0 exit checklist 9항목 전수 통과 시 트랙 A/B 병렬 개시, 실패 시 게이트별 폴백.

---

## 8. Open Questions (비차단, 실행 중/M0 이후 해소)
- 3-way 동기화의 CI 비대화형 폴백(사용자 "선택"을 안전 기본값 skip+리포트로 결정화).
- 공유 데이터계약 변경 거버넌스(M0 이후 수정 절차).
- hook(L2)/CI(L3)가 동일 검증 코어 공유하도록 리팩토링.
- Unity가 `Assets/` 외 경로 인식하는 우회법(.asmdef/심링크) 존재 여부.

---

## 사전 준비물 (파이프라인 밖, 1회)
- **Unity MCP 설치** — CoplayDev/unity-mcp(MIT, git URL) 권장 / Unity 6 공식 MCP Server 대안.
- **상용 PNG 팩 → 베이스 프리팹 굽기** — 임포트 세팅·9-slice·Sprite Atlas로 `Btn_Base`·`Panel_Base` 등.
- **베이스 프리팹 프리뷰 CSS 매핑** — 대략적 외형(배경·테두리·패딩) 경량 CSS.
- **Node ≥18 LTS** — 결정적 JS 런타임 prerequisite.

---

_RALPLAN 합의: Planner(Opus) → Architect(Opus) → Critic(Opus) 3라운드. 최종 Critic 판정 APPROVE (CRITICAL 0 · MAJOR 0). 상태: PENDING APPROVAL._
