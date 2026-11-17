# 인수인계 문서 — ECLIPSE ARENA

이 저장소 작업을 이어받는 AI 어시스턴트(모델 무관)를 위한 문서다. 작업을 시작하기 전에 끝까지 읽는다.
상태가 바뀌면 **4장(이미지 진행 현황)** 을 갱신하고 커밋한다.

마지막 갱신: 2026-11-17 KST (Codex: Blender 카이·표정·애니메이션·비교 화면, Ponytail, 검증과 재생성 인수인계)

---

## 1. 프로젝트 개요

- 사용자 요청: "싸이퍼즈와 비슷한 액션형 AOS 게임"을 웹으로 배포하고 계속 수정해 나간다. 이미지는 Higgsfield MCP로 생성한다.
- 결과물: 3 vs 3 **3D 3인칭 숄더뷰** 액션 AOS **ECLIPSE ARENA**. 빌드 과정 없는 정적 사이트(HTML + ES 모듈 + Three.js, `vendor/` 에 포함).
- 현재 시점은 3인칭 숄더뷰. 카이는 **Blender에서 제작한 스킨 GLB**를 사용하고, 리라·브롬·세라는 코드로 만든 로우폴리다. 처음 만든 2D 탑다운 판은 폐기했다.
- 저장소: `moneys123450-hue/test-game`, 브랜치 `main` 에 직접 푸시한다.
- 배포: Render Static Site (Build Command 없음, Publish Directory `.`). **main 에 푸시하면 자동 재배포**된다.
- 사용자 선호: 한국어 응답, 분석적 어조, 칭찬 금지. 하드코딩 규칙 추가보다 일반화된 구조를 우선한다.

### 지켜야 할 제약

1. **기존 게임의 캐릭터·이름·로고·디자인을 가져오지 않는다.** 장르만 참고하고 캐릭터는 전부 자체 설정(2장)이다. 이미지 프롬프트에 다른 게임·작품의 이름을 넣지 않는다.
2. 영웅·스킬·수치·모델 선택과 기본 도형의 외형 명세(`look`)는 `js/data.js`에서 관리한다. GLB의 실제 형태는 Blender 제작 스크립트에서 수정한다. `js/world.js`(엔진)와 `js/ai.js`(봇)는 데이터를 해석하는 범용 코드이므로, 영웅 하나를 위해 분기문을 추가하지 않는다. 새 동작이 필요하면 효과 프리미티브를 추가한다.
3. 봇은 규칙 기반 자동화다(AI 추론 아님). 설명할 때 이 구분을 유지한다.
4. 변경 후에는 6장의 검증 절차를 돌린 뒤 푸시한다.

---

## 2. 캐릭터 설정

공통 화풍: **셀 셰이딩, 애니메이션풍 SF 판타지, 네온 림 라이트, 어두운 폐허 미래 도시 배경.** 영웅마다 고유색 하나를 쓴다.

| id | 이름 | 칭호 / 역할 | 고유색 | 외형 (프롬프트용 영어 서술) |
|---|---|---|---|---|
| `kai` | 카이 | 섬광의 검사 / 근접 돌격 | 시안 `#35e0ff` | young male swordsman, short spiky black hair with a cyan streak, sleek dark armored jacket with glowing cyan energy lines, one long cyan energy katana |
| `lyra` | 리라 | 쌍권총의 추적자 / 원거리 딜러 | 주황 `#ff9a3c` | confident female gunslinger, long orange ponytail, visor goggles on forehead, white and orange combat jacket, two glowing orange futuristic pistols |
| `brom` | 브롬 | 강철의 수호자 / 탱커 | 금색 `#ffd24a` | huge broad-shouldered bearded male guardian, heavy bronze-and-steel power armor, glowing yellow reactor core, massive war hammer and tower shield |
| `sera` | 세라 | 별빛의 마도사 / 마법사 | 보라 `#b98cff` | elegant female arcane mage, long silver-violet hair, dark purple and white techno-robe with glowing violet runes, crystal staff, violet star orb |

스킬 구성 (정확한 수치는 `js/data.js` 의 `HEROES`):

| 영웅 | 좌클릭 | 우클릭 | Q | E (궁극기) |
|---|---|---|---|---|
| 카이 | 연참 (전방 베기) | 질풍 돌진 (돌진 베기) | 회오리 베기 (주변 연속 타격) | 섬광 일섬 (장거리 관통 돌진 + 기절) |
| 리라 | 속사 (탄환) | 관통탄 | 섬광 수류탄 (범위 + 둔화) | 탄막 폭풍 (난사) |
| 브롬 | 망치 강타 | 방패 돌격 (기절) | 철벽 (피해 감소 + 회복) | 대지 분쇄 (광역 기절) |
| 세라 | 별빛 탄 (폭발탄) | 서리 폭발 (범위 + 둔화) | 점멸 (순간이동) | 유성 낙하 (광역) |

Space 는 전 영웅 공통 회피(무적 구르기)다.

진영: 블루(0) `#3fb6ff`, 레드(1) `#ff4d5e`. 건물·미니언 이미지는 같은 디자인에 발광색만 다르게 한다.

---

## 3. Higgsfield 사용 규칙

사용자는 3일 체험 무제한 요금제를 쓴다. **무제한은 2026-11-19 10:54 KST 에 끝난다.** 크레딧은 9뿐이므로 크레딧을 쓰지 않는다.

### 호출 형식

도구 `mcp__Higgsfield__generate_image_batch` 에 **한 번에 한 건만** 넣는다.

```json
{
  "context": "Generating original art assets for the user's web action MOBA game.",
  "requests": [
    { "index": 22, "params": { "...asset-prompts.json 의 params...": "", "use_unlim": true, "prompt": "...asset-prompts.json 의 prompt..." } }
  ]
}
```

- `use_unlim: true` 는 필수다. 빼면 크레딧 결제 선택으로 넘어간다.
- 무제한이 적용되는 설정: `gpt_image_2_6` 의 `resolution` 1k·2k, `quality` low·medium. `high` 이상이나 4k 는 쓰지 않는다.
- 투명 배경이 필요하면 `"background": "transparent"`, 용량을 줄이려면 `"output_format": "webp"`.
- `index` 는 건마다 다른 숫자를 쓴다 (지금까지 0~21 사용).

### 관찰된 동작

- **동시 1건 제한**: 진행 중인 건이 있으면 나머지는 `429 rate_limit_reached` 로 거절된다. 모델을 바꿔도 같다. 거절된 건은 과금·생성되지 않으므로 앞 건이 끝난 뒤 다시 제출한다.
- **대기열이 느리다**: 한 장에 40분~1시간 이상 `waiting` 상태로 머문다. 실패가 아니다.
- 상태 확인은 `mcp__Higgsfield__jobs_wait` (`timeout_seconds` 최대 15). 완료되면 `result_url` 이 나온다.
- **3D 모델 생성(`generate_3d`)은 무제한 대상이 아니다.** 캐릭터 한 명에 34~44크레딧(리깅 포함 기준)이 든다. 사용자가 크레딧을 충전하고 명시적으로 요청하기 전에는 쓰지 않는다.
- 한 턴 안에서 계속 기다리지 않는다. `mcp__claude-code-remote__send_later` 로 30분 뒤 점검을 예약하고, 예약 메시지에 **진행 중 job id 와 다음에 할 일**을 적는다.

### 이전 환경의 한계와 현재 확인 상태

- 이전 Claude 환경에서는 결과 CDN 접속이 차단되어 있었다. 현재 로컬 Codex 환경에서는 세라 PNG 다운로드와 직접 열람을 확인했다. 환경마다 다르므로 가능한 도구·권한을 확인하고, 실제 차단이 있으면 우회하지 않는다.
- 그래서 게임은 CDN 주소를 직접 불러온다(`js/assets.js`). 체험 종료 후 주소가 유지되는지는 미확인이다. 사용자가 파일을 저장소 `assets/` 에 올려 주면 `assets.js` 의 주소를 상대 경로로 바꾼다.
- 세라 초상화와 Blender 카이 렌더·로컬 게임은 직접 확인했다. 원격에서 병합한 스킬 시트 16개 각각의 칸·내용은 이번 Codex 작업에서 시각 검수하지 않았다. 외부 생성 작업을 이 문서만 보고 자동 재제출하지 않는다.

---

## 4. 이미지 진행 현황

### Blender 카이 현재 상태

세라 AI 생성 시도(2026-11-17): `art/sera-ai/sera-reference-front.png`는 내장 imagegen으로 만든 전신 기준 **2D 이미지**다. `tools/generate-sera-ai.py`로 Microsoft 공식 TRELLIS.2 데모의 이미지 전처리는 성공했으나, 실제 3D 생성은 ZeroGPU 할당량 오류로 거절돼 **GLB/리깅/게임 적용은 아직 없다**. 원본 프롬프트와 실행 상태·재개 절차는 `art/sera-ai/README.md`에 기록했다. GTX 1060 3GB라 고해상도 모델 로컬 설치는 하지 않았고 유료 생성도 실행하지 않았다. fal은 발견했으나 연결 미확인이다. 계정 인증/무료 이용량 확인 후 이어간다. 기존 카이 모델은 유지한다.

**이번 제작은 이미지→3D 생성 API가 아니라, Codex가 Blender Python으로 메시·재질·뼈대·동작을 작성하고 Blender에서 실행한 방식이다. Blender MCP는 설치하지 않았고, 유료 생성 API·외부 캐릭터 에셋도 사용하지 않았다.** PNG는 결과 확인용 렌더이며 실제 게임은 GLB를 불러온다.

- 현재 모델: `art/kai-blender/kai-anime.glb` (약 2MB), 편집 원본: `kai-anime.blend`. 19개 뼈대, 스킨 가중치, `Idle`/`Run`/`Slash` 클립, `Blink`/`LookLeft`/`LookRight` 모프.
- 얼굴 곡면에 맞춘 눈·홍채·눈꺼풀, 피부 버텍스 컬러, 겹친 머리카락, 의상 주름·봉제선, 손잡이를 감싼 손, 부츠 밑창을 포함한다. 피부는 부드러운 재질, 의상은 단계 명암, 금속은 반사 재질이다.
- `js/data.js`의 `look.model`이 모델을 지정한다. `models.js`는 SkeletonUtils로 뼈대를 개별 복제하고 AnimationMixer로 이동/공격 상태에 맞는 클립을 전환한다. 모프와 재질은 `js/character-style.js`가 관리한다. 인스턴스 사이에 뼈대·모프 상태를 공유하지 않는다.
- `character.html` + `js/character-preview.js`: 회전, 얼굴 확대, 대기/달리기/베기, 눈 깜빡임, 일시정지, 직전/초기 모델 비교.
- Three.js r170의 GLTFLoader, BufferGeometryUtils, SkeletonUtils를 `vendor/`에 추가했다. 기존 THREE-LICENSE를 따른다.
- 다른 영웅은 기존 코드 모델이다. GLB 로드에 실패하면 코드 모델을 유지한다.

| 로컬 주소 | 내용 |
|---|---|
| `http://127.0.0.1:8000/` | 현재 모델로 게임 |
| `http://127.0.0.1:8000/character.html` | 캐릭터 비교 화면 |
| `http://127.0.0.1:8000/?model=previous` | 직전 곡면 모델 `kai-anime-v1.glb` |
| `http://127.0.0.1:8000/?model=block` | 초기 Blender 블록 모델 `kai-prototype.glb` |
| `http://127.0.0.1:8000/?model=original` | 최초 코드 모델 |

### 작업 방식·재생성·진행 팁

1. 게임/비교 화면에서 문제를 확인하고, 외형 문제는 `tools/build-kai-anime.py`, 재질·표정은 `js/character-style.js`, 게임 상태와 동작 연결은 `js/models.js`에서 수정한다. 영웅별 모델 선택과 수치는 `data.js`에 둔다.
2. 저장소 루트에서 다음 명령으로 재생성한다. **같은 이름의 GLB/BLEND/렌더를 덮어쓰므로, Blender에서 수동 편집한 파일은 별도 파일명으로 저장한 뒤 실행한다.**

   ```powershell
   & 'C:\Users\USER\AppData\Local\BlenderPortable\blender-4.5.9-windows-x64\blender.exe' --background --python tools/build-kai-anime.py
   ```

   이 경로는 이 PC의 Blender 4.5.9 LTS 포터블 설치 위치다. 다른 PC에서는 설치한 `blender` 실행 파일로 바꾼다. Blender 자체는 저장소에 포함하지 않는다. `tools/build-kai.py`는 초기 블록 모델용이며 최신 모델을 만드는 스크립트가 아니다.
3. 출력: `kai-anime.glb`, `kai-anime.blend`, `kai-anime-front.png`, `kai-anime-back.png`, `kai-anime-face.png`. 스튜디오 렌더와 실제 게임의 조명은 다르므로 **둘 다 확인**한다. `kai-detail-*.png`는 브라우저 검증 당시 화면이다.
4. `.blend`는 촬영을 위해 NLA 트랙을 mute한 상태다. 동작을 편집할 때 해당 트랙을 활성화한다. 모프는 Shape Keys에서 확인한다. 스크립트는 NLA 트랙을 활성화해 GLB로 내보낸다.
5. Blender의 정면은 -Y, 위는 Z다. glTF 변환 후 +Z 정면이 되어 게임에서 Y축 +90도로 보정한다. 게임 정면은 +X다. 아래로 향하는 팔다리 뼈의 로컬 축과 위로 향하는 척추의 회전축을 혼동하지 않는다.
6. 눈·홍채를 구체로 덧붙이면 돌출되어 보인다. 얼굴 곡면 깊이에 맞춘 패치를 사용한다. 눈을 감을 때 흰자·홍채는 피부 뒤로 숨기고 속눈썹 선은 남겨야 한다. 모든 부위를 같은 평면으로 겹치면 깜빡임에 줄무늬가 생긴다.
7. 피부 버텍스 컬러를 유지하려면 브라우저 재질의 `vertexColors`를 켠다. 모든 재질을 동일한 toon 재질로 바꾸면 피부색과 금속 차이가 사라질 수 있다.
8. 여러 부품을 가중치/재질을 유지하며 합쳐 렌더 호출을 줄였다. 뼈대 복제에는 일반 `scene.clone()` 대신 SkeletonUtils를 사용한다. 기본 도형 모델의 흔들림을 스킨 모델에 중복 적용하지 않는다.
9. 그림자 줄무늬가 생기면 먼저 light의 bias/normalBias와 모델 크기를 확인한다. 뷰어는 그림자 bias와 캔버스 높이를 조절해 버튼이 발을 가리지 않도록 했다.
10. 프롬프트 한 문장을 반복해서 던진 것이 아니라, 스크립트를 수정→모델 전체 재생성→렌더/게임 검수하는 과정을 반복했다. 같은 스크립트는 현재 형태를 재현한다. 다음에는 정면/측면/후면 기준 이미지, 체형·얼굴·의상·색·동작·성능 목표를 먼저 확정하면 불필요한 외형 변경을 줄일 수 있다. 초상화 대비 “70%”는 측정한 품질 수치가 아니다.

작업 순서를 사용자에게 매번 승인받아야 하는 것은 아니다. 요구한 품질까지 초안→검수→수정을 내부적으로 진행한다. 첫 모델이 단순했던 것은 Blender의 필수 제약이 아니라 이번 구현을 도형 조합으로 시작한 선택의 결과다. 최종 스크립트를 한 번 실행하면 현재 모델을 재현할 수 있지만, 짧은 자연어 프롬프트만으로 어떤 도구에서나 같은 품질이 보장되지는 않는다. 전문 제작과 AI 생성은 구분해서 설명한다. Blender의 [모델링 안내](https://docs.blender.org/manual/en/5.0/modeling/meshes/introduction.html), Meshy의 [생성 방식 비교](https://docs.meshy.ai/en/webapp/guides/choosing/generation-method)와 [입력·재시도·후처리 안내](https://help.meshy.ai/en/articles/9996860-how-to-use-meshy-image-to-3d)를 참고한다. 외부 서비스의 현재 무료 범위와 약관은 사용 전에 재확인한다.

### Ponytail과 로컬 환경

- 저장소 `AGENTS.md`에 Ponytail 개발 원칙과 기존 인수인계 우선 확인 규칙을 추가했다. 라이선스는 `PONYTAIL-LICENSE`다.
- 이 PC에만 Ponytail 5.3.3 Codex 플러그인(스킬 6개), 기본 모드 `full`을 설치했다. 활성화와 훅 3개의 신뢰 저장, 새 세션 프롬프트에 규칙 포함을 확인했다. **이 사용자 설정과 플러그인은 git clone으로 다른 PC에 설치되지 않는다.**
- 필요하면 별도로 `codex plugin marketplace add DietrichGebert/ponytail`, `codex plugin add ponytail@ponytail`을 사용하고 그 환경의 훅 신뢰 상태를 확인한다. `.codex/config.toml`이나 인증 파일을 저장소에 커밋하지 않는다.
- PowerShell에서는 경로에 `[]`와 공백이 있으므로 `Set-Location -LiteralPath`와 절대 경로를 사용한다. `python`/`node`는 사용 가능하며 이 PC에서는 winget이 없었다.
- 원격 `main`의 스킬 아이콘 추가 커밋 `0d6a0db`를 병합했다. 다른 작업자 변경을 보존하고, 푸시 전 항상 fetch와 diff를 확인한다. 강제 푸시는 사용하지 않는다.

프롬프트 원문과 설정은 `tools/asset-prompts.json` 에 순서대로 들어 있다.

| 순서 | id | 내용 | 격자 | 상태 | job id / 파일 |
|---|---|---|---|---|---|
| – | (단독) | 세라 초상화 | – | 완료·반영 | `hf_20261116_113820_08ba2ba2-a81c-488f-a216-cdc71e1b1c0e.png` |
| – | (단독) | 카이 탑다운 스프라이트 | – | 완료, **3D 전환으로 미사용** | `hf_20261116_091153_95e86984-…` |
| – | `heroes` | 영웅 4명 탑다운 스프라이트 시트 | 2×2 | 완료, `sprite_<id>` 로 등록. 초상화가 없는 영웅의 HUD·선택 카드 대체 이미지 (portraits 시트가 오면 자동으로 초상화가 우선) | `hf_20261116_125123_69977583-….webp` |
| 1 | `icons` | 스킬 아이콘 16개 (행 = 카이·리라·브롬·세라) | 4×4 | 완료·반영 | `hf_20261117_015824_080bd72c-….webp` |
| 2 | `portraits` | 초상화 4명 | 2×2 | 미제출 (사용자가 정면 전신 그림·아이템 SVG 우선 여부를 답하면 순서 결정) | |
| 3 | `title` | 타이틀 배경 | – | 미제출 | |
| 4 | `ground` | 바닥 타일 (이음매 없는 반복) | – | 미제출 | |

동시 1건 제한. 다음 제출 후보: `portraits`, 영웅 정면 전신 그림(3D 변환용 원본), 상점 아이템 SVG 아이콘 — 사용자 지정 순서를 따른다.

상점 아이템 아이콘은 아직 이미지가 없어 이모지(`ITEMS[*].glyph`)로 표시한다. 이미지를 만들면 키 `item_<아이템id>` 로 `assets.js` 에 등록하면 자동으로 쓰인다.

### 한 건이 완료됐을 때 할 일

1. `result_url` 의 **파일명**만 떼어 `js/assets.js` 의 `ASSETS` 에 추가한다.
   - 시트: `...sheet('파일명', 열, 행, [키 목록]),` — 키 목록은 `asset-prompts.json` 의 `keys` 를 그대로 쓴다(왼쪽 위부터 행 우선 순서).
   - 단일: `ground: CDN + '파일명',`
2. 시트가 단독본을 대체하면 단독본 줄을 지운다 (`portraits` 가 오면 `portrait_sera` 단독본).
3. `node --check js/assets.js` 후 커밋·푸시.
4. 위 표를 갱신하고, 다음 순서의 항목을 한 건 제출한 뒤 다음 점검을 예약한다.
5. 4건이 모두 끝나면 `mcp__Higgsfield__show_generation_by_ids` 로 전체를 한 번에 사용자에게 보여 주고 결과를 보고한다.

### 에셋 키 규칙

| 키 | 용도 | 요구 사항 |
|---|---|---|
| `portrait_<id>` | 영웅 선택 카드, HUD | 세로 3:4, 얼굴이 위쪽 1/3 |
| `icon_<id>_<0~3>` | 스킬 슬롯 (0 좌클릭, 1 우클릭, 2 Q, 3 E) | 정사각, 어두운 배경, 글자 없음 |
| `title` | 타이틀 화면 배경 | 16:9, 가운데는 어둡고 비어 있게 |
| `ground` | 3D 바닥 텍스처 | 이음매 없이 반복되는 어두운 타일. **WebGL 텍스처라 CDN 이 CORS 를 허용해야만 적용된다.** 실패하면 코드로 그린 바닥이 유지된다 |

3D 전환으로 `hero_<id>`, `tower*`, `core*`, `minion*` 스프라이트 키는 더 이상 쓰지 않는다. 카이는 GLB, 나머지 캐릭터·건물·미니언은 `js/models.js`가 코드로 만든다.

키가 없거나 로드에 실패하면 렌더러가 도형으로 대체하므로 게임은 항상 동작한다.

### 문제가 보고됐을 때

- **시트 칸이 어긋나 아이콘·초상화가 잘림**: 해당 항목만 단독 이미지로 다시 뽑는다 (5장 양식).
- **3D 캐릭터 외형 수정 요청**: GLB 카이는 위 재생성 절차를 따른다. 코드 모델은 `data.js`의 `look`을 수정하고, 새 종류가 필요하면 `models.js`의 범용 모델 생성기에 추가한다. `look`의 색만 바꾸어도 이미 구워진 GLB의 머리·의상이 바뀌지는 않는다.

---

## 5. 프롬프트 양식

새 영웅을 추가하거나 일부만 다시 뽑을 때 쓴다. `{...}` 만 바꾸고 나머지 문장은 유지한다 — 화풍을 맞추는 문장이다.

### 탑다운 스프라이트 (단독) — 3D 전환으로 현재 미사용

설정: `aspect_ratio 1:1`, `resolution 1k`, `quality medium`, `background transparent`, `output_format webp`

```
Top-down 2D game character sprite seen from directly overhead (true bird's-eye orthographic view, camera straight above looking down). {외형 서술}, both shoulders visible from above, holding {무기} extended toward the RIGHT side of the image. The character faces the right side of the image. Single character, centered, entire figure inside the frame with margin, clean cel-shaded game asset with bold outlines, transparent background, no ground, no shadow, no text.
```

### 초상화 (단독)

설정: `aspect_ratio 3:4`, `resolution 1k`, `quality medium`, `output_format webp`

```
Original character splash art for a sci-fi fantasy action arena game. {이름 대문자}: {외형 서술}, {포즈}. Stylized cel-shaded anime-inspired game illustration, dramatic neon rim lighting, dark futuristic ruined-city background with {고유색} {입자: sparks / embers / dust / particles}. Waist-up composition, character centered, no text, no logo.
```

### 스킬 아이콘 (영웅 한 명분 2×2)

설정: `aspect_ratio 1:1`, `resolution 1k`, `quality medium`, `output_format webp`

```
A 2x2 grid of four square game skill icons, exactly equal quadrants, each icon filling its quadrant edge to edge with a dark background, no gaps, no borders, no text. {고유색} {테마} theme. Top-left: {좌클릭 스킬 그림}. Top-right: {우클릭 스킬 그림}. Bottom-left: {Q 스킬 그림}. Bottom-right: {E 스킬 그림}. Stylized glossy cel-shaded MOBA ability icon style.
```

등록: `...sheet('파일명', 2, 2, ['icon_<id>_0', 'icon_<id>_1', 'icon_<id>_2', 'icon_<id>_3']),`

### 건물·유닛 (단독) — 3D 전환으로 현재 미사용

설정: `aspect_ratio 1:1`, `resolution 1k`, `quality medium`, `background transparent`, `output_format webp`

```
Top-down 2D game asset seen from directly overhead: {대상 서술}, glowing {BLUE | RED} energy, steel and dark {navy | crimson} plating. Single object, centered, fills most of the frame, clean cel-shaded game asset with bold outlines, transparent background, no ground, no shadow, no text.
```

### 시트로 묶을 때 붙이는 문장

여러 개를 한 장에 담으면 생성 횟수가 줄지만 칸이 어긋날 위험이 있다. 다음 문장을 끝에 붙인다.

```
Clean cel-shaded game asset style with bold dark outlines, fully transparent background, no ground, no shadows, no text, no grid lines, no borders. Every item is centered in its own cell and stays completely inside it with generous empty padding on all sides; nothing crosses into a neighbouring cell.
```

---

## 6. 코드 구조와 검증

| 파일 | 역할 |
|---|---|
| `js/data.js` | 영웅·스킬·맵·규칙 수치, 영웅 3D 외형 명세(`look`). 스킬은 효과 프리미티브(`arc` `projectile` `dash` `aoe` `blink` `buff` `telegraph`)의 조합 |
| `js/assets.js` | 이미지 주소 목록, 시트 칸 계산, 로더 |
| `js/world.js` | 시뮬레이션과 스킬 해석기. **2D 평면 로직, DOM·렌더러 비의존** (3D 는 표시만 담당) |
| `js/ai.js` | 봇. `hero.intent` 만 채운다 (플레이어와 같은 인터페이스) |
| `js/models.js` | 코드 모델 생성 + GLB 로드·스켈레톤 복제·AnimationMixer 상태 전환 |
| `js/character-style.js` | 피부·의상·금속 재질, 독립된 눈 깜빡임·시선 모프 |
| `character.html`, `js/character-preview.js` | 캐릭터 외형·표정·동작·이전 버전 비교 |
| `tools/build-kai-anime.py` | 최신 Blender 카이·뼈대·모프·클립·렌더 재생성 |
| `js/render3d.js` | Three.js 장면, 3인칭 카메라, 이펙트, 체력바 오버레이 |
| `js/minimap.js` | 미니맵 (2D 캔버스) |
| `js/main.js` | 화면 전환, 키보드·마우스(포인터 잠금)·터치 입력, HUD, 루프 |
| `vendor/three.module.min.js` | Three.js r170 (MIT) |
| `tools/sim.mjs` | 봇끼리 한 판을 돌리는 헤드리스 검증 |
| `tools/asset-prompts.json` | 이미지 생성 대기열 (프롬프트·설정·키) |

좌표 규약: 시뮬레이션 `(x, y)` → 3D `(x·S, 높이, y·S)`, `S = 1/50`. 시뮬레이션 각도 `a` → `rotation.y = -a`. 모델 정면은 +X.

조작: 마우스로 시점 회전(포인터 잠금), 화면 중앙 조준점이 가리키는 지면이 조준 위치, WASD 는 카메라 기준 이동. 터치는 왼쪽 조이스틱 + 오른쪽 화면 끌기(시점) + 스킬 버튼(자동 조준).

### 영웅 추가 절차

1. `data.js` 의 `HEROES` 에 항목 추가, `HERO_ORDER` 에 id 추가. 각 스킬에 `ai: { range, use }` 메타데이터를, 영웅에 `look` (외형·무기·공격 동작 종류)을 넣는다.
2. 5장 양식으로 초상화·아이콘을 생성해 `assets.js` 에 등록.
3. 아래 검증 실행.

### 검증

```bash
for f in js/*.js; do node --check "$f"; done
node tools/sim.mjs 1 1     # 인자: 시드, 난이도(0~2). 예외 없이 승패가 나야 한다
node tools/sim.mjs 2 1     # 한 판 8~20분이 정상 범위. 크게 벗어나면 밸런스 수치를 본다
python3 -m http.server 8000   # 브라우저 확인 (ES 모듈이라 파일로 직접 열면 동작하지 않는다)
# 헤드리스 크롬으로 볼 때는 --use-angle=swiftshader --enable-unsafe-swiftshader 로 WebGL 을 켠다.
# window.__game 으로 상태에 접근할 수 있다 (예: __game.renderer.look(dx, dy) 로 시점 회전).
```

Windows에서는 `npm run dev`로 서버를 띄워도 된다. 브라우저 회귀 검증은 `tools/check-character.cjs`에 보존했다. 별도 터미널에서 서버가 켜진 상태로 실행한다. 게임 실행에는 Playwright가 필요 없고, 테스트에만 사용한다. 다음은 프로젝트 의존성을 바꾸지 않고 임시 폴더에 테스트 도구를 준비하는 예시다.

```powershell
npm install --prefix "$env:TEMP\eclipse-browser-check" playwright
$env:NODE_PATH = "$env:TEMP\eclipse-browser-check\node_modules"
node "$env:NODE_PATH\playwright\cli.js" install chromium
node tools/check-character.cjs
```

이미 설치한 Chromium을 쓰려면 `CHROMIUM_PATH` 환경 변수로 실행 파일을 지정한다. 테스트는 얼굴 모프, 눈 감김, 직전 모델 전환, 별도 캐릭터의 뼈대·표정 독립성, 게임 상태별 Idle/Run/Slash, 평지 발 궤적과 브라우저 예외를 검사한다. 스크린샷은 임시 폴더에 저장하며 최종 로그에 경로를 출력한다. 발 검사 최저치는 최근 약 -0.001m였으며, 이것은 클립의 기하 검사이지 실제 이동 중 발 미끄러짐이 없다는 보증은 아니다.

이번 통합 검증: JavaScript 문법 검사, 시드 1/2 봇 시뮬레이션(9.6분/12.8분), Chromium 회귀 검사. 모바일 실기기 성능, 원격 Render 배포 성공, 스킬 시트 칸별 미술 검수는 별도로 확인해야 한다.

### 커밋

main 에 직접 커밋·푸시한다. 푸시는 `git -c push.negotiate=true push origin main`.

---

## 6.5 골드 · 상점 · 아이템 · 귀환

전부 데이터 기반이다. 수치는 `js/data.js` 의 `RULES`(골드 항목)와 `ITEMS` 만 고친다.

- **골드 획득** (`RULES`): 시작 420, 초당 1.6, 미니언 막타 24, 근처에서 미니언이 죽으면 9, 영웅 처치 150, 도움 60, 타워 파괴 시 팀 전원 120.
- **상점** (`world.quote / buy / sell`): 본진 회복 원 안이거나 죽어 있을 때만 사고판다. 판매는 구매가의 60%. 장비 6칸, 포션은 전용 칸(최대 5개).
- **아이템 능력치 키**: `atk` `hp` `speed` `cdr`(상한 40%) `lifesteal` `armor`(받는 피해 감소, 상한 50%) `regen`. 능력치는 `world.recalc(h)` 한 곳에서만 레벨+아이템으로 재계산한다. 새 능력치 키를 추가하면 `recalc` 와 그 능력치를 쓰는 곳에만 반영하면 된다.
- **같은 `group`** 의 아이템은 하나만 보유하고, 상위 아이템은 차액만 내고 교체된다 (신발 1단계 → 2단계).
- **포션**: 6초간 360 회복. 효과 중에는 중복 사용 불가.
- **귀환**: 4초 동안 가만히 서 있으면 본진으로 이동. 이동·스킬 사용·피격·기절 시 취소.
- **조작**: P 상점(본진에서 구매 가능, 밖에서는 열람만), F 또는 1 포션, B 귀환. 모바일은 상단 🛒·귀환·포션 버튼.
- **봇**: 영웅 데이터의 `build` 순서대로 산다. 다음 아이템 값 + 여유분이 모이고 근처에 적 영웅이 없으면 귀환해서 산다(규칙 기반). 체력 55% 미만이면 포션을 쓴다.

## 7. 알려진 한계와 다음 후보 작업

- 싱글 플레이(봇 5명)만 있다. 실시간 멀티플레이는 서버가 필요하므로 Render Static Site 로는 불가능하고 Web Service 추가가 필요하다.
- 카이만 최신 스킨 GLB다. 무료 Blender/Python 제작에는 Higgsfield 크레딧이 필요 없다. 다른 영웅을 교체할 때도 `buildHero`의 `{ root, update, height }` 인터페이스를 유지한다.
- 립싱크·개별 손가락 애니메이션·물리 천 시뮬레이션은 없다. 코트와 스카프는 뼈대 동작이다. 달리기는 평지용이며 월드 좌표 발 고정이나 경사면 IK는 없으므로 실제 이동 속도에 따라 미끄러짐이 남을 수 있다.
- 현재 스크립트 기반 메시의 얼굴·피부·머리 표현은 상업용 고급 캐릭터와 차이가 있다. 전문적인 조형/텍스처/리토폴로지나 적절한 베이스 모델을 쓰는 것이 더 적합할 수 있다. 확인 없이 “초상화 수준 완성”이라고 보고하지 않는다.
- 시뮬레이션은 평면이다. 점프·고저차·낙하는 없다.
- 카메라는 벽에 가리면 당겨지지만, 다른 유닛에 가리는 경우는 가까운 영웅을 숨기는 정도만 처리했다.
- 효과음·배경음이 없다.
- 상점 아이템 아이콘은 이모지다. 아이템이 10종뿐이고 액티브 효과(사용형 장비)는 없다.
- 봇 조합에 따라 승률이 치우친다.
- 저사양 모바일에서는 그림자·조명 수를 줄여 그린다 (`Renderer3D` 의 `low` 옵션). 실제 기기 성능은 미측정이다.
