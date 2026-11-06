# `euclidraw/genogram-extension` 설계 및 구현 계획 (`PLAN.md`)

> **목표:** 임상·상담·사회복지 현장에서 가장 빠르고 직관적으로 가계도(Genogram)를 작성·수정·출판할 수 있는 `alid` 공식 확장(`apiVersion: 2`) 구축.
> **핵심 원칙:** *"의미(가족·정서 관계)는 정본 그래프로 묶어 선이 절대 끊어지지 않게 하고, 배치와 조작은 캔버스 위에서 모달 없이 손끝으로 통제한다."*

---

## 1. 배경 및 기존 가계도 도구 분석

공개된 두 웹 가계도 에디터의 구조와 실제 작성 흐름에서의 병목을 비교한 결과는 다음과 같습니다.

| 비교 항목 | `genogram.kr/editor` (드로잉·좌표 중심) | `genogram.auruda-j.com` (관계·자동배치 중심) | **`euclidraw/genogram-extension` (Semantic-Spatial Hybrid)** |
| :--- | :--- | :--- | :--- |
| **핵심 모델** | 인물 기호(`x, y`)와 선분(`x1, y1, x2, y2`, `barY`)을 격자 위에 배치 | 부모·배우자·자녀 ID 참조(`LegalRelationship`, `ChildRelationship`, `PsychologicalRelationship`)와 자동 레이아웃 | **정본은 스칼라 `EntityId` 참조 그래프**, **선·분기·테두리 좌표는 100% `Computed` 파생** |
| **강점** | 원하는 위치에 어떤 기호·선도 자유롭게 배치 가능, 다채로운 임상·성소수자·생애 기호 팔레트 | 가족 단위 템플릿 삽입과 관계 기반 자동 정렬로 초안 작성 속도가 빠름 | **원클릭 가족 확장(`+` 기즈모·템플릿)** + **수동 배치 자유도** + **끊어지지 않는 자동 추적 관계선** |
| **작성 병목** | 인물을 조금만 이동해도 결혼선·자녀 분기선·동거 테두리가 분리되어 일일이 손으로 다시 맞춰야 함 | 자동 배치가 경직되면 복잡한 재혼·동거·예외 배치를 사용자가 원하는 위치에 두기 어려움 | 인물을 옮기면 모든 관계선이 **호스트 프레임에 맞춰 추적하고**, 자동 정렬은 사용자가 요청할 때만 수행 |
| **Undo / 복제** | 전체 JSON 스냅샷 히스토리(최대 50단계) | 로컬 스토리지 상태 저장 | **호스트 단일 Loro CRDT Undo 타임라인** + **`core.clipboard` 서브그래프 부분 복제(`Alt+드래그`, `Mod+C/V`)** |

---

## 2. `alid` 아키텍처 불변식 및 저장소 계약 (`apiVersion: 2`)

이 확장은 `@alid/kernel`을 수정하지 않고 공개 `ExtensionPackageSpec` 및 `PorcelainExtensionSpec` 계약만으로 동작합니다.

### 2.1 패키지 식별자 및 매니페스트 구성 (`extension.json` → `alid.extension.json`)
* **확장 ID (`id`):** `diagram.genogram`
* **버전 (`version`):** `0.1.0` (`engine: "^0.1.0"`, `apiVersion: 2`)
* **선택적 확장 의존성 (`optionalDependencies`):**
  * `"sys.minibuffer": "^0.1.0"` — 가족 템플릿 선택, 관계 유형 빠른 전환 등에 `completingRead` 팔레트를 활용하며, 미설치/비활성 시 기본값 즉시 생성으로 안전하게 폴백합니다.
* **제공 정본 어스펙트 (`provides.aspects` / `aspectIds`):**
  1. `diagram.genogram.person` — 인물 및 생애·임상 기호 노드 (`core.transform`, `core.bounds` 보유)
  2. `diagram.genogram.union` — 부부·파트너 결합 엔티티 (박스 없음, `paintBounds` 제공)
  3. `diagram.genogram.parentage` — 부모-자녀 및 쌍둥이 분기 엔티티 (박스 없음, `paintBounds` 제공)
  4. `diagram.genogram.relation` — 정서적·상호작용 관계선 엔티티 (박스 없음, `paintBounds` 제공)
  5. `diagram.genogram.household` — 동거 가구 경계 엔티티 (박스 없음, `paintBounds` 제공)
* **단일 번들 규약 (`dist/plugin.js`):**
  * 호스트 공유 모듈(`@alid/kernel`, `@alid/react`, `react`, `react-dom`) 외에 외부 런타임 청크나 상대 에셋 경로를 남기지 않는 단일 ESM 파일로 빌드하고, `scripts/build.mjs`로 SHA-256 해시를 `alid.extension.json`에 기록합니다.

### 2.2 5대 아키텍처 불변식 준수 원칙
1. **정본·파생 분리 (Gate 1 — Read-Triggers-Write 0):**
   * 결합선의 꺾임 좌표, 다자녀 공유 형제 바(Sibling Bar)의 양 끝점, 쌍둥이 역V자 정점, 정서 관계선의 지그재그 정점, 동거 가구의 외곽 컨투어는 **절대 정본에 저장하지 않고 `derive()`에서 순수 계산**합니다.
   * 문서를 열거나 확대·축소·패닝·피크(`@`)할 때 CRDT 커밋은 `0`입니다.
2. **스칼라 `entityRefs` 정규화와 클립보드 직교성 (Gate 4):**
   * 커널의 참조 무결성 검사(`entityRefs`)와 `@alid/extension-clipboard`의 1-Pass 유도 서브그래프 수집(`collectSubgraph`)·ID 재매핑(`remapEnvelope`)은 **문자열 스칼라 필드(`Record<keyof TProps, 'cascade-hide' | 'nullify'>`)**를 기준으로 동작합니다.
   * 따라서 배열(`children: EntityId[]`)을 쓰지 않고 모든 참조를 스칼라 필드로 정규화합니다.
3. **한글 IME 삼중 가드 및 단일 Undo (Gate 2):**
   * 인물 이름·나이·메모 인라인 편집 시 조합 중(`isComposing`, `keyCode === 229`, `Process`) 및 `compositionend` 후 16ms 가드를 준수하고, 가족 템플릿 삽입·원클릭 가족 확장은 단일 Undo 그룹으로 기록합니다.
4. **기즈모·미리보기 분리 (Gate 3):**
   * 관계선 드래그 연결, 수평바 오프셋 조절, 원클릭 가족 추가 드래그 중에는 소유자별 `ScratchOverlay`만 갱신하고 확정 시에만 1회 정본 배치를 커밋합니다.
5. **순수 벡터 출판 일치성 (Gate 5):**
   * 모든 인물 기호(성별·사망·임신·유산·반려동물·임상 사분면 해칭)와 복합 관계선(이중/삼중선, 지그재그 갈등선, 단절선, 이혼 사선)은 `<foreignObject>` 없이 `renderSvg()`와 `svgDefs`만으로 완전한 벡터 그래픽을 출력합니다.

---

## 3. 정본(Canonical) 데이터 모델 및 파생(Computed) 기하 명세

### 3.1 `diagram.genogram.person` (인물 기호 노드)
`core.transform`(`x, y, rotation`)과 `core.bounds`(`width: 64, height: 64` 기본)를 갖는 박스형 엔티티입니다.

```ts
export interface GenogramPersonProps {
  symbol:
    | 'male'              // 남성 (사각형 □)
    | 'female'            // 여성 (원 ○)
    | 'unknown'           // 성별 미상 (마름모 ◇)
    | 'trans_male'        // 트랜스 남성 (원 안의 사각형 또는 사각형 안의 원)
    | 'trans_female'      // 트랜스 여성
    | 'nonbinary'         // 논바이너리
    | 'pregnancy'         // 임신 중 (삼각형 △)
    | 'miscarriage'       // 자연유산 (작은 검은 원 ● 또는 교차선)
    | 'abortion'          // 인공유산 (작은 교차 ✕)
    | 'stillbirth_male'   // 사산 남 (작은 사각형 안의 ✕)
    | 'stillbirth_female' // 사산 여 (작은 원 안의 ✕)
    | 'pet';              // 반려동물 (둥근 마름모/방패형)
  orientation: 'none' | 'gay' | 'lesbian' | 'bisexual'; // 기호 내부 역삼각형(▽) 표시
  lifeStatus: 'alive' | 'deceased';                     // 사망 시 기호 관통 ✕ 표시
  isIndexPerson: boolean;                               // 주호소자/내담자(IP) 이중 외곽선 표시
  clinical:
    | 'none'
    | 'physical'          // 좌하단/반쪽 수직 해칭 (신체 질환)
    | 'mental'            // 좌측 반쪽 음영 (정신과적/심리 문제)
    | 'substance'         // 하단 반쪽 음영 (알코올·약물 남용)
    | 'mental_substance'  // 정신 + 물질 공존 음영
    | 'recovering';       // 회복 중 표시
  name: string;           // 하단 이름 라벨 (예: "홍길동")
  ageLabel: string;       // 기호 정중앙 나이 표시 (예: "45")
  yearSpan: string;       // 기호 상단 출생·사망 연도 (예: "1981-" 또는 "1950-2020")
  note: string;           // 하단 보조 임상 메모 (예: "우울증, 고혈압")
  birthOrderHint: number; // 자동 정렬 보조용 형제 순서 힌트 (기본 0)
  householdId: EntityId | null; // 소속 동거 가구(diagram.genogram.household) 참조
}
```
* **무결성 및 텍스트 정책:**
  * `refs: { householdId: 'nullify' }` — 동거 가구 테두리를 삭제해도 인물은 삭제되지 않고 `householdId`만 `null`로 마스킹됩니다(Undo 시 가구 소속 즉시 복원).
  * `textFields: ['name', 'ageLabel', 'yearSpan', 'note']`
  * `textSearchFields: ['name', 'yearSpan', 'note']` — `@` 공간 검색(`C-s`)으로 인물 이름이나 질환명(`"고혈압"`, `"홍길동"`)을 검색해 즉시 카메라 피크(Peek)가 가능합니다.

---

### 3.2 `diagram.genogram.union` (부부·파트너 결합 엔티티)
왜 자녀를 부모 개인이 아닌 `union`에 연결하는가? 가계도에서는 한 인물이 초혼·재혼·동거 등 복수의 결합(`Union 1`, `Union 2`)을 가질 수 있고, 자녀들은 각 결합의 수평바에서 분기되기 때문입니다.

```ts
export interface GenogramUnionProps {
  partnerA: EntityId | null;
  partnerB: EntityId | null;
  status:
    | 'marriage'            // 법적 혼인 (실선 ㄷ자)
    | 'engagement'          // 약혼 (짧은 파선)
    | 'cohabitation'        // 동거/사실혼 (점선 + 작은 집/고리 표식)
    | 'separation'          // 별거 (실선 중앙에 외줄 사선 `/`)
    | 'divorce'             // 이혼 (실선 중앙에 두줄 사선 `//`)
    | 'reunion_divorce'     // 이혼 후 재결합
    | 'reunion_separation'  // 별거 후 재결합
    | 'secret_affair';      // 외도/비공식 관계 (점선 + 삼각 표식)
  barOffset: number;        // 두 배우자 하단에서 수평 결합선이 내려오는 거리 (기본 44, 기즈모로 조절 가능)
  label: string;            // 결혼·이혼 연도 라벨 (예: "m.2012 d.2021")
}
```
* **무결성 정책:** `refs: { partnerA: 'cascade-hide', partnerB: 'cascade-hide' }`
* **파생 기하 (`derive`):**
  * `partnerA`와 `partnerB`의 `readLayoutBounds(view, id)`를 읽어 좌측 파트너 하단 중앙 `(xA, bottomA)`와 우측 파트너 하단 중앙 `(xB, bottomB)`를 구합니다.
  * `barY = Math.max(bottomA, bottomB) + props.barOffset` 위치에 수평 결합선 세그먼트 `unionBar = { minX: Math.min(xA, xB), maxX: Math.max(xA, xB), midX: (xA + xB) / 2, y: barY }`를 생성합니다.
  * 중앙점 `(midX, barY)`에 이혼(`//`), 별거(`/`) 등의 상태 기호와 연도 라벨을 배치합니다.

---

### 3.3 `diagram.genogram.parentage` (부모-자녀 및 쌍둥이 분기 엔티티)
자녀 1명마다 하나의 `diagram.genogram.parentage` 엔티티를 두되, **같은 부모(`union` 또는 `(parentA, parentB)`)를 공유하는 형제들의 `parentage`가 파생(`derive`) 단계에서 하나의 수평 형제 분기선(Sibling Bar)을 공유**하도록 설계합니다.

```ts
export interface GenogramParentageProps {
  parentA: EntityId | null;  // 주 부모 인물 ID (필수)
  parentB: EntityId | null;  // 보조 부모 인물 ID (선택, 부부일 때 설정)
  union: EntityId | null;    // 부부 결합(diagram.genogram.union) 엔티티 ID (선택)
  child: EntityId | null;    // 자녀 인물 ID (필수)
  pedigree:
    | 'biological'           // 친생자 (실선)
    | 'adopted'              // 입양아 (파선 또는 이중선)
    | 'foster'               // 위탁아 (점선)
    | 'surrogate';           // 대리모 출생
  twinWith: EntityId | null; // 쌍둥이 형제 인물 ID (없으면 null)
  twinType: 'none' | 'fraternal' | 'identical'; // 단태아 | 이란성(∧) | 일란성(𝔸)
  barRatio: number;          // 부모 결합선과 자녀 상단 사이의 형제 수평바 높이 비율 (기본 0.5)
}
```
* **왜 `refs`를 다음과 같이 분리하는가? (`core.clipboard` 1-Pass 호환 설계):**
  ```ts
  refs: {
    parentA: 'cascade-hide',
    child: 'cascade-hide',
    parentB: 'nullify',
    union: 'nullify',
    twinWith: 'nullify',
  }
  ```
  1. **클립보드 1-Pass 서브그래프 포섭:** 사용자가 캔버스에서 인물들(`[아버지, 어머니, 자녀들]`)만 마퀴로 드래그해 선택해도, `parentA`와 `child`가 모두 선택 집합 안에 있으므로 `collectSubgraph()`가 첫 패스에서 `union`과 모든 `parentage`를 빠짐없이 포섭합니다. 이어지는 `remapEnvelope()`에서 `'nullify'` 필드인 `union`, `parentB`, `twinWith`도 `idMap`을 통해 새 복제본 ID로 100% 재매핑됩니다.
  2. **부분 삭제 시 우아한 폴백:** 부모 중 한 명(`parentB`)이나 결합선(`union`)만 지워도 자녀의 혈연선 자체가 사라지지 않고 `parentA`에서 내려오는 한부모 자녀선으로 자동 폴백되며, 쌍둥이 형제(`twinWith`) 한 명을 지워도 남은 자녀는 단태아 수직선으로 유지됩니다. `Mod+Z`를 누르면 원래 부부 분기선·쌍둥이 분기선으로 즉시 복구됩니다.
* **파생 기하 (`derive`):**
  * **부모 출발점(`originX, originY`):** `props.union`이 살아 있으면 해당 `computed.diagram.genogram.union`의 수평바 `(midX, barY)`에서 출발하고, 없으면 `parentA`(와 `parentB`가 살아 있다면 두 사람의 중점) 하단에서 출발합니다.
  * **공유 형제 바(Sibling Bar) 자동 결합:** 같은 `union`(또는 `parentA`)을 바라보는 모든 살아 있는 `parentage` 엔티티들의 자녀 X좌표 집합을 스캔하여, 형제가 2명 이상이거나 부모 중심과 자녀 중심의 X좌표가 다를 때 `siblingBarY` 위치에 `[minChildAnchorX, maxChildAnchorX]` 수평바를 파생합니다(수평바 중복 그리기는 그룹 내 사전순 최소 `parentage` 엔티티 또는 각 자녀 구간 분담으로 깔끔하게 단일화).
  * **쌍둥이 기하 (`twinWith` & `twinType`):** `twinWith`가 유효하면 두 쌍둥이 자녀의 중간 X좌표 `(twinMidX, siblingBarY)` 한 점에서 두 자녀의 상단 앵커로 직선이 비스듬히 갈라지는 **역V자(`∧`)**를 그리고, `twinType === 'identical'`(일란성)이면 두 사선 사이 중단에 수평 연결 브릿지를 추가합니다.

---

### 3.4 `diagram.genogram.relation` (정서·상호작용 관계선 엔티티)
가족 구조(`union`, `parentage`)와 직교하는 임상 정서 관계 레이어입니다. 부모-자녀 사이나 부부 사이에도 정서 관계선을 동시에 중첩할 수 있습니다.

```ts
export interface GenogramRelationProps {
  from: EntityId | null;
  to: EntityId | null;
  kind:
    | 'close'            // 친밀 (2중 평행 실선 ══)
    | 'fused'            // 융합/과도한 밀착 (3중 평행 실선 ≡≡)
    | 'distant'          // 소원/거리감 (성긴 파선 - - -)
    | 'hostile'          // 갈등/적대 (지그재그 톱니선 \/\/\/)
    | 'fused_hostile'    // 융합+갈등 (2중 평행선 + 중앙 지그재그)
    | 'cutoff'           // 단절 (실선 중앙에 수직 평행 끊김 바 ─||─)
    | 'cutoff_repaired'  // 단절 후 회복 (─|○|─)
    | 'estranged'        // 소원/별거성 거리 (점선 + 끊김 바)
    | 'focused_on'       // 과도한 집중 (굵은 방향 화살표 ──▶)
    | 'abuse_physical'   // 신체적 학대 (지그재그 + 방향 화살촉)
    | 'abuse_emotional'  // 정서적 학대 (파선 지그재그 + 방향 화살촉)
    | 'abuse_sexual';    // 성적 학대 (특수 마커 + 지그재그 화살촉)
  curveOffset: number;   // 부부선·자녀선과 겹치지 않게 휘어지는 수직 아치 오프셋 (기본 0, 중앙 핸들로 드래그 조절)
  label: string;         // 시점·메모 (예: "2023 이후 갈등")
}
```
* **무결성 정책:** `refs: { from: 'cascade-hide', to: 'cascade-hide' }`
* **해석적 기하 (`derive`):**
  * `from`과 `to` 인물의 경계 박스 외곽 포트를 잇는 직선 또는 이차 베지어 중심선(`curveOffset` 반영)을 구한 뒤, 법선 벡터(Normal Vector)를 따라 **다중 평행 오프셋 경로**와 **일정 파장(예: `12px`)의 지그재그 톱니 정점 배열**을 해석적으로 생성합니다.

---

### 3.5 `diagram.genogram.household` (동거 가구 경계 엔티티)
인물을 옮길 때마다 다시 그려야 하는 수동 폐곡선 대신, **소속 인물(`person.householdId === householdEntityId`)들의 바운딩을 실시간으로 감싸는 반응형 가구 테두리**입니다.

```ts
export interface GenogramHouseholdProps {
  label: string;                // 가구 라벨 (예: "동거 가구", "조부모 댁")
  padding: number;              // 구성원 외곽 여백 (기본 28)
  strokeStyle: 'dashed' | 'dotted';
  color: string;                // 테두리 색상 (기본 '#475569')
  fallbackX: number;            // 구성원이 아직 없을 때의 초기 X
  fallbackY: number;            // 구성원이 아직 없을 때의 초기 Y
}
```
* **파생 기하 (`derive`):**
  * 캔버스에서 `person.householdId === entityId`인 모든 생존 인물의 `readLayoutBounds(view, memberId)`(라벨 높이 포함)를 수집합니다.
  * 구성원들의 외곽을 감싸는 둥근 점선 폐곡선(Rounded Hull / Padded Smooth Contour)과 좌상단/하단 라벨 배지를 파생합니다.
  * 구성원 중 누구라도 드래그하면 가구 점선 테두리가 실시간으로 늘어나거나 줄어듭니다.

---

## 4. 실제 상담 세션의 시간순 조작 흐름(Walkthrough)과 UX 설계

실제 초기 면접(Intake)·가족 상담에서는 내담자가 처음부터 완벽한 가계도 트리를 불러주지 않습니다. **"내담자 본인(IP) → 부모·형제자매(원가족) → 배우자·자녀(생식가족) → 뒤늦게 밝혀지는 이혼·재혼·유산 → 현재 동거 가구 → 정서적 역동 및 임상력 → 기록·익명 출판"** 순서로 대화가 흘러갑니다. 이 시간순 흐름을 따라가며 기존 초안에서 발생하던 7가지 실전 조작 마찰을 해결합니다.

### 4.1 상담 시간순 조작 시나리오 및 보완 포인트

| 상담 단계 | 내담자 발화 예 (현장 상황) | 초안(`v1`)의 잠재적 마찰 | **보완된 조작 설계 (`v2`)** |
| :--- | :--- | :--- | :--- |
| **Step 1. 시작 (0~1분)**<br>내담자(IP) 배치 | *"저는 34살 홍길동이고요..."* | 처음부터 3세대 템플릿을 찍으면 내담자의 혼인·형제 수와 맞지 않아 지우는 손이 더 많이 감 | **첫 인물 자동 IP 지정:** 빈 가계도에 첫 인물을 추가하면 자동으로 `isIndexPerson: true`(이중 테두리)로 생성되고 즉시 이름·나이 입력이 가능함 |
| **Step 2. 원가족 (1~5분)**<br>부모 및 형제자매 | *"부모님 계시고, 위로 형이 한 명, 누나가 한 명, 밑으로 여동생이 있어요."* | **`+ 형제자매 추가` 부재:** IP에서 부모를 만든 뒤 다시 부모 결합선으로 올라가 `+ 자녀`를 누르고 좌우 순서를 마우스로 끌어서 바꿔야 했음 | **`+ 손위 형제(좌측)` (`M-[`) / `+ 손아래 동생(우측)` (`M-]`):** 선택 인물(IP) 상태에서 바로 좌·우 형제를 추가하면 같은 부모(`union`/`parentage`)를 공유하며 기존 형제들이 겹치지 않게 X좌표를 자동 시프트함 (아직 부모가 없으면 상단 부모 세트를 함께 자동 생성하거나 형제 바를 먼저 연결) |
| **Step 3. 가족사 수정 (5~10분)**<br>이혼·재혼·사후 연결 | *"사실 아버지가 이혼 후 재혼하셔서 새어머니와 이복동생이 있어요."* | **재혼 시 배우자·결합선 겹침** 및 **이미 그려진 두 인물의 사후 연결 수단 부재** | • **다중 배우자 슬롯 & `barOffset` 스태거링:** 이미 배우자가 있는 인물에게 `+ 배우자`를 실행하면 빈 방향(좌/우 외곽 슬롯)에 배치하고 결합선 `barOffset`을 자동 차등화(`44px → 64px`)해 선 겹침 방지<br>• **2인 다중 선택 사후 연결(`selection-bar`):** 이미 캔버스에 있는 두 인물을 함께 선택하면 상단 바에 **`[부부로 연결]` / `[부모-자녀로 연결]` / `[쌍둥이로 묶기]`** 액션 즉시 노출 |
| **Step 4. 동거 가구 (10~12분)**<br>현재 거주 형태 | *"지금은 아내랑 아이 둘, 그리고 작년부터 장모님이 같이 살아요."* | 이미 만든 가구(`household`)에 나중에 장모님을 추가하려면 ID 참조를 수동 편집해야 했음 | **원클릭 가구 묶기 & 편입/제외 토글 (`C-c g`):** 인물들을 다중 선택해 `[동거 가구로 묶기]`를 실행하고, 이후 `[기존 가구 테두리 + 추가할 인물]`을 선택해 `[가구 구성원 편입/제외]`를 1클릭 토글 |
| **Step 5. 정서 역동 (12~20분)**<br>관계선 & 임상력 | *"아버지랑은 완전히 절연 상태고, 어머니와는 너무 밀착돼서 힘들어요."* | 부부선(`union`)이나 자녀선(`parentage`)이 이미 있는 두 사람 사이에 직선(`curveOffset: 0`) 정서 관계선을 그으면 구조선과 완전히 겹쳐 식별 불가 | • **2인 선택 즉시 정서 연결:** 두 인물 선택 시 `selection-bar`에서 **`[친밀 ═ | 융합 ≡ | 갈등 ⚡ | 단절 \|\| | 집중 ▶]`** 1클릭 생성 및 `[방향 반전 ⇄]` 지원<br>• **자동 곡률 회피(`autoCurveOffset`):** 두 인물 사이에 이미 `union`/`parentage`나 다른 `relation`이 있으면 새 `relation`의 초기 `curveOffset`을 `±28px` 아치로 자동 부여해 구조선 겹침을 줄임 |
| **Step 6. 상세 기록 (20~25분)**<br>메모 & 라벨 여백 | *"아버지가 알코올 문제로 입원하셨고, 2021년에..."* | 하단 `name`·`note`가 길어지면 아래로 지나가는 부부 결합선(`barOffset: 44`)과 텍스트가 겹침 | **라벨 기반 최소 `barOffset` 자동 확보:** `union.derive()`에서 두 파트너의 텍스트 줄 수를 계산해 결합선 수평바가 항상 텍스트 아래로 지나가도록 최소 클리어런스를 보장 |
| **Step 7. 사례회의·출판 (세션 후)**<br>익명화 & 레이어 토글 | 수퍼비전·학회 발표용 가계도 제출 및 구조/역동 분리 검토 | 실명 문서를 복제해 일일이 이름을 고쳐야 하고, 복잡한 정서선 때문에 가족 구조가 안 보임 | • **프라이버시 렌즈:** 정본 훼손 없이 `전체 표시` / `성씨만(홍○○)` / `이니셜` / `연도 마스킹(198*)` 전환 출판<br>• **레이어 표시 토글:** `정서 관계선 표시/숨김`, `동거 가구 표시/숨김`, `임상 메모 표시/숨김` 뷰 옵션 제공 |

---

### 4.2 선택 인물 중심 '6방향 원클릭 가족 확장' (`Space 2A Gizmo` + 단축키 + `selection-bar`)
도구 선반을 오가지 않고 현재 대화 중인 인물에서 곧바로 가계도를 확장합니다.
* **`+ 손위 형제(좌)` (`M-[`) / `+ 손아래 동생(우)` (`M-]`):**
  * 선택 인물의 왼쪽(`-110px`) 또는 오른쪽(`+110px`)에 형제자매 인물을 생성하고 같은 부모(`union`/`parentage`)에 자동 연결합니다.
  * 사이에 끼워 넣는 경우 기존 형제들의 X좌표를 한 칸씩 밀어 겹침을 방지하며, 아직 부모 엔티티가 없는 상태라면 상단에 기본 부모 부부(`union`)를 함께 생성해 형제 분기선이 끊기지 않게 합니다.
* **`+ 배우자/파트너 추가` (우/좌측 기즈모 또는 `M-s`):**
  * 선택 인물의 빈 배우자 슬롯에 파트너 인물을 생성하고 `diagram.genogram.union`으로 연결합니다.
  * 이미 첫 배우자가 있는 재혼·다중 파트너 사례에서는 반대편 또는 다음 외곽 슬롯에 배치하고 `barOffset`을 자동 차등화(`44`, `64`, `84`)합니다.
* **`+ 자녀 추가` (하단 기즈모 또는 `M-c`):**
  * 선택 인물(또는 선택된 `union` 결합선) 아래쪽 세대(`+140px`)에 자녀를 생성하고 `diagram.genogram.parentage`로 연결합니다.
* **`+ 부모 추가` (상단 기즈모 또는 `M-p`):**
  * 선택 인물 위쪽 세대(`-140px`)에 아버지(`male`) + 어머니(`female`) + 결혼선(`union`) + 본인 연결선(`parentage`) 세트를 단일 Undo 그룹으로 생성합니다. 이미 형제자매가 묶여 있다면 형제 전체의 부모로 연결됩니다.
* **`+ 쌍둥이 추가` (`M-t`) & `2인 다중 선택 사후 연결`:**
  * 자녀 선택 상태에서 `M-t`를 누르면 쌍둥이 형제를 옆에 생성하고 `twinWith`로 묶습니다.
  * 이미 캔버스에 존재하는 임의의 두 인물을 `Shift+클릭`으로 함께 선택하면 상단 `selection-bar`에서 **`[부부 결합]`**, **`[부모→자녀 연결]`**, **`[쌍둥이 묶기]`**, **`[정서 관계 연결]`**, **`[방향 반전 ⇄]`**을 즉시 실행할 수 있습니다.

### 4.3 가족 단위 스탬프 템플릿 (`tool-shelf` & `completingRead`)
초기 정보가 명확할 때는 1초 만에 기본 골격을 찍어 시작할 수 있습니다:
1. **내담자(IP) 단독 시작** — 화면 중앙에 주호소자(`isIndexPerson: true`) 1명 생성
2. **핵가족 (부부 + 자녀 2명)** — 인물 4 + 결합 1 + 자녀분기 2 (총 7 엔티티 단일 배치 생성)
3. **3세대 가족 (조부모 + 부모 + 내담자)** — 3세대 기본 수직·수평 골격 일괄 생성
4. **한부모 가족 (부모 1 + 자녀 2명)** — 한부모 및 자녀 분기 일괄 생성
5. **재혼 혼합 가족 (전 배우자·자녀 + 현 배우자·자녀)** — 다중 `union` 및 차등 `barOffset` 구조 일괄 생성

### 4.4 끊어지지 않는 선 선택 및 다이아몬드 조절 핸들 (`EntitySelectionContribution`)
* `union`, `parentage`, `relation`, `household`는 각각 정밀한 폴리라인 거리 기반 `hitTest`(허용 반경 8 화면 픽셀)와 `getOutlinePath`를 구현합니다.
* 선을 클릭하면 상단 **선택 도구 모음(`selection-bar`)**에 해당 선에 꼭 필요한 핵심 세그먼트 컨트롤만 즉시 나타납니다:
  * `union` 선택 시: `[결혼 | 동거 | 별거(/) | 이혼(//) | 재결합]`
  * `parentage` 선택 시: `[친생 | 입양 | 위탁]`, `[단태아 | 이란성 쌍둥이 | 일란성 쌍둥이]`
  * `relation` 선택 시: `[친밀 | 융합 | 갈등(⚡) | 융합+갈등 | 단절(||) | 집중/학대(▶)]`, `[방향 반전 ⇄]`
* 선 중앙의 **조절 핸들**을 드래그하면 `ScratchOverlay` 미리보기로 결합선 높이(`barOffset`), 형제 바 비율(`barRatio`), 정서 관계 곡률(`curveOffset`)을 실시간 조정하고 마우스를 놓을 때 1회 커밋합니다.

### 4.5 강제하지 않는 3단계 배치 보조 (Assistive Layout)
1. **세대 레일 스냅:** 인물 생성 및 이동 시 부모 세대(`Y - 140`), 본인 세대(`Y`), 자녀 세대(`Y + 140`)와 형제 간격(`X + 110`)에 맞춰 깔끔하게 정렬되도록 돕습니다.
2. **부부·가구 묶음 선택/이동:** `union` 결합선을 잡고 이동하거나 `household` 테두리를 클릭하면 연결된 가족 구성원을 함께 이동시킬 수 있습니다.
3. **명시적 가족 정돈 명령 (`diagram.genogram:tidy-layout`):** 사용자가 명령을 실행한 순간에만 현재 선택된 가족(또는 전체 가계도)의 세대 계층과 출생순(`birthOrderHint` / 나이순)을 계산해 `core.transform` 좌표를 일괄 정돈합니다(단일 Undo로 언제든 취소 가능).

### 4.6 임상 프라이버시 렌즈 & 레이어 가시성 (Privacy & Layer Lens)
* 확장 설정(`settingsSchema`) 또는 토글 명령을 통해 **원본 정본 데이터를 전혀 수정하지 않고** 화면과 순수 SVG 출판(`renderSvg`)에서 다음을 제어합니다:
  * **이름 마스킹 (`privacyMode`):** `'full'`(전체 표시) | `'surname_masked'`(`홍○○`) | `'initials'`(`ㅎㄱㄷ` / `H`) | `'hidden'`(이름 숨김, 나이·성별만 표시)
  * **연도 마스킹 (`maskYears`):** 출생·사망·결혼 연도의 끝자리를 `198*`로 마스킹할지 여부
  * **레이어 토글 (`showRelations`, `showHouseholds`, `showClinicalNotes`):** 수퍼비전 목적에 따라 가족 구조도만 깔끔하게 보거나 정서 역동·동거 가구·임상 메모 레이어를 겹쳐 볼 수 있습니다.

---

## 5. 저장소 디렉터리 및 모듈 구조

빌드 산출물은 단일 `dist/plugin.js`로 묶이되, 소스 코드는 역할별로 분리해 유지보수성과 테스트 용이성을 확보합니다.

```text
genogram-extension/
├── PLAN.md                        # 본 설계 및 구현 로드맵 문서
├── README.md                      # 설치 방법 및 기능 안내
├── extension.json                 # 확장 메타데이터 (id: "diagram.genogram")
├── alid.extension.json            # 빌드 시 자동 생성되는 API v2 설치 매니페스트 (SHA-256 포함)
├── package.json
├── vite.config.js
├── scripts/
│   ├── build.mjs                  # Vite 번들 빌드 + alid.extension.json 생성
│   ├── dev.mjs                    # 로컬 핫리로드 개발 서버 (http://127.0.0.1:5174)
│   ├── install-manifest.mjs       # 매니페스트 및 capabilities 생성기
│   └── validate-config.mjs        # extension.json 스키마 검증기
├── src/
│   ├── manifest.js                # 런타임·빌드 공용 패키지 및 어스펙트 ID 계약
│   ├── index.js                   # ExtensionPackageSpec 엔트리 및 명령·서비스 활성화
│   ├── constants.js               # 기호 크기, 세대 간격, 색상, 열거형 옵션 정의
│   ├── aspects/
│   │   ├── person.js              # diagram.genogram.person (스키마, derive, SVG/DOM, UI 컨트롤)
│   │   ├── union.js               # diagram.genogram.union (부부 결합선 기하 및 이혼/별거 표식)
│   │   ├── parentage.js           # diagram.genogram.parentage (형제 바 병합 및 쌍둥이 역V자 기하)
│   │   ├── relation.js            # diagram.genogram.relation (친밀·갈등 지그재그·단절 해석적 경로)
│   │   └── household.js           # diagram.genogram.household (동거 가구 반응형 점선 경계)
│   ├── geometry/
│   │   ├── symbols-svg.js         # McGoldrick 표준 인물·임신·사망·사분면 임상 해칭 순수 SVG 생성기
│   │   ├── relation-paths.js      # 평행선, 톱니 지그재그, 단절 바, 화살촉 경로 수학 헬퍼
│   │   └── polyline-hit.js        # 선형 엔티티용 EntitySelectionContribution (거리·교차·윤곽)
│   └── commands/
│       ├── quick-expand.js        # +배우자, +자녀, +부모, +쌍둥이, +정서관계 원클릭 확장 명령
│       ├── templates.js           # 핵가족, 3세대, 한부모, 재혼 가족 스탬프 생성기
│       └── tidy-layout.js         # 세대·형제 순서 기반 명시적 레이아웃 정돈기
└── test/
    ├── manifest.test.mjs          # API v2 매니페스트 및 버전·의존성 무결성 검증
    ├── bundling.test.mjs          # 단일 ESM 번들 및 외부 import 규칙 검증
    ├── dev-server.test.mjs        # 로컬 개발 서버 SSE/CORS 검증
    └── plugin.test.mjs            # 5대 어스펙트 순수 파생, 참조 무결성, 템플릿·확장 명령, SVG 이스케이프 검증
```

---

## 6. 단계별 구현 로드맵 (Milestones)

### Phase 1 — 핵심 가족 그래프 & 상담 초기 면접 확장 MVP
* [x] `extension.json` 및 `src/manifest.js`를 `diagram.genogram` 멀티 어스펙트 계약으로 전환
* [x] `diagram.genogram.person` 구현 (성별·생애 기호 12종, 성소수자 역삼각형, 사망 `✕`, 첫 인물 자동 IP 이중선, 사분면 임상 마커, 상·중·하 라벨 순수 SVG)
* [x] `diagram.genogram.union` 구현 (결혼·동거·약혼·별거·이혼·재결합 `ㄷ`자 결합선, 텍스트 줄 수 기반 최소 `barOffset` 확보, 폴리라인 선택 기여)
* [x] `diagram.genogram.parentage` 구현 (친생·입양·위탁 구분, 다자녀 공유 형제 바 자동 병합, 이란성·일란성 쌍둥이 역V자 분기)
* [x] 선택 인물 기준 **`+ 손위 형제(좌)` / `+ 손아래 동생(우)` / `+ 배우자(재혼 슬롯·오프셋 자동 차등)` / `+ 자녀` / `+ 부모` / `+ 쌍둥이`** 원클릭 확장 명령 및 **2인 다중 선택 사후 연결(`부부`·`부모-자녀`·`쌍둥이`)**, **핵가족·3세대·재혼 템플릿** 구현

### Phase 2 — 정서 역동 · 동거 가구 · 인터랙션 고도화
* [x] `diagram.genogram.relation` 구현 (친밀 2중선, 융합 3중선, 갈등 해석적 지그재그, 융합+갈등, 단절, 집중/학대 화살표, `[방향 반전 ⇄]`, 구조선과 겹치지 않는 자동 초기 `curveOffset` 아치 부여)
* [x] `diagram.genogram.household` 구현 (`person.householdId` 역참조 기반 동거 가구 반응형 점선 외곽선 및 다중 선택 원클릭 가구 묶기·구성원 편입/제외 토글)
* [x] 선택 인물 주변 Space 2A 퀵 확장 기즈모 및 선 높이(`barOffset`, `barRatio`, `curveOffset`) 드래그 핸들 연동

### Phase 3 — 배치 정돈 보조 & 임상 프라이버시·레이어 출판
* [x] `diagram.genogram:tidy-layout` 명령 (세대 위상 정렬 및 출생순/나이순 X축 정돈을 단일 Undo 배치로 적용)
* [x] 프라이버시·레이어 렌즈 설정 (`settingsSchema`: 이름 전체/성씨 마스킹 `홍○○`/이니셜/숨김, 연도 마스킹, 정서선·동거가구·임상메모 레이어 가시성 토글) 및 순수 SVG 출판 반영

---

## 7. 완료 게이트(5 Gates) 검증 계획

1. **Gate 1 (정본 순수성):** 인물·결합·자녀·정서관계·가구 파생 함수(`derive`)가 정본을 절대 수정하지 않으며, 열람·피크·SVG 출판 시 정본 쓰기가 `0`인지 `test/plugin.test.mjs`로 자동 검증합니다.
2. **Gate 2 (한글 IME & 단일 Undo):** 인물 생성·템플릿 스탬프·원클릭 가족 확장(`+ 배우자`, `+ 자녀`, `+ 부모`)이 단일 배치로 실행되어 한 번의 Undo로 원복되는지 검증합니다.
3. **Gate 3 (렌더링 및 핫패스 규율):** 폴리라인 `hitTest`와 `intersectsRect`에서 불필요한 힙 할당을 피하고, `paintBounds`가 모든 비박스 관계선의 정확한 월드 바운딩을 반환하는지 검증합니다. (1,000개 엔티티 120fps·0-GC 실측 전까지는 완료로 주장하지 않습니다.)
4. **Gate 4 (참조 무결성 & 클립보드 호환):** `refs`의 `'cascade-hide'`와 `'nullify'` 선언을 통해 인물 삭제 시 좀비 선이 남지 않고, 한부모/단태아 폴백 및 서브그래프 복제가 정상 동작하는지 검증합니다.
5. **Gate 5 (벡터 출판 일치성):** DOM 마운트 없이 `renderSvg()`와 `svgDefs`만으로 모든 기호·해칭·관계선·지그재그·텍스트(XML 이스케이프 포함)가 누락 없이 출력되는지 검증합니다.

## 구현 결과 및 검증 경계 (2026-11-06)

Phase 1~3의 다섯 어스펙트, 12종 인물 기호, 관계선 유형, 가족 확장·사후 연결, 네 가족 템플릿, 동거 가구, 퀵 확장 및 오프셋 핸들, 명시적 가족 정돈과 표시 렌즈 명령을 구현했다. 초기 IP 생성은 인물 추가 명령에서 수행한다. 노드 크기는 라벨을 포함한 100×120이며 생성 세대 간격은 라벨·부부선 여유를 위해 240으로 조정했다.

계획의 보장 범위를 다음처럼 조정했다.

- 부모를 모르는 형제 추가 시 사실을 추정해 부모를 생성하지 않는다. 미상 부모를 먼저 명시적으로 추가한다.
- 두 인물의 방향성 연결은 선택 순서를 사용하고, 다중 배우자의 자녀는 결합선을 선택하도록 요구한다.
- ±28 곡률과 재혼 오프셋은 가독성 보조이며 임의 배치에서 무충돌을 증명하지 않는다. 관계 곡선은 길이에 따른 폴리라인 근사다.
- 표시 렌즈는 설정 위치의 명령으로 노출하며 세션 로컬이다. 영구 settingsSchema 저장과 직접 인라인 편집은 추가 작업이다.
- 호스트 공개 API에는 가족 전용 이동 스냅 공급자 계약이 없어 세대 레일은 자동 이동 스냅으로 구현하지 않았다. 기본 호스트 스냅 및 명시적 정돈을 사용한다.
- 임상 마커, 외도·재결합·학대 등의 기관별 세부 기호 일치성과 긴 라벨 배치에는 추가 시각 검토가 필요하다. 가구 외곽은 구성원 박스의 점선 사각 경계다.

검증 결과:

| 게이트 | 확인한 내용 | 남은 확인 |
| --- | --- | --- |
| 1 정본 순수성 | 템플릿·파생·출력 렌즈 자동 테스트 및 실제 CanvasWorld 읽기 검증 | 실제 브라우저 열람 JSONL 비교 |
| 2 IME·Undo | 명령당 단일 배치·Undo 그룹, 핸들 조합 가드 구현 | 실제 한국어 IME와 Rust Undo/Redo |
| 3 성능 | 경로 선분 선택과 paintBounds 구현 | 1,000 엔티티 120fps·0-GC 미검증. 파생 그룹 검색 및 미리보기에는 할당이 남음 |
| 4 참조 | 스칼라 refs, 실제 호스트 nullify 후 부모선 폴백, 순환 연결 거부 | 클립보드 통합·샌드박스 전체 회귀 |
| 5 출판 | DOM 없이 모든 어스펙트 SVG 생성·이스케이프 | 실제 전체 씬·컬링·Z순서 비교 |

아래 후속 기록은 이 초기 검증 시점 이후의 구현 결과다. 로드맵 체크는 조정된 기능 계약의 구현 여부이며 실제 호스트 수동·성능 게이트 통과 여부와 다르다. `pnpm test`와 `pnpm test:host`로 검증 범위를 재현한다.

### 후속 구현 결과

- 인라인 편집 구현: 인물 추가 직후·Enter·더블클릭으로 시작하고 Tab으로 필드를 순환한다. 조합 중 종료·저장 개입을 막고 확정 시 원격 변경을 병합한다. 호스트 `canvas.text-history`로 문서 Undo 타임라인에 합류한다.
- 세대 레일 구현: 선택 인물 위 ↔ 핸들을 이용한 이동에서 세대 240·형제 110 간격에 스냅한다. 기존 몸체 드래그는 호스트 기본 동작을 유지한다.
- 표시 옵션 저장 구현: 설치 매니페스트의 settingsSchema와 새 호스트 서비스 `extensions.preferences`를 연결했다. 호스트는 호출 확장의 키만 읽고 쓸 수 있는 facade를 제공하며 워크스페이스 저장·재로드를 담당한다. 내부 관리 서비스 접근은 계속 금지된다.
- 긴 텍스트의 SVG 폭을 노드 폭 안으로 조정하고 다중 행 메모의 paintBounds를 확장했다. UI 기호·관계 옵션을 한국어로 표시한다.
- 실제 Rust Undo/Redo 후 템플릿 복원, JSONL 읽기 순수성, SceneVectorCompiler의 미리보기 배제, 실제 확장 로더 활성화와 설정 재로드를 검증했다.
- `pnpm test`: 확장 17개 통과. alid 전체 113개 파일·1,076개 테스트 통과. alid 타입 검사·빌드·Wasm 스모크 통과.

기능 구현 범위는 위 조정된 조작 계약에 따라 완료했다. OS별 실제 한국어 입력기와 GPU/분할 뷰 시각 검사, 1,000 엔티티 120fps·핫패스 0-GC 실측은 여전히 미검증이며 5대 게이트 전체 통과로 표시하지 않는다. 경로의 폴리라인 근사와 데이터 규모에 따른 파생 검색 비용도 성능 실측 대상이다.
