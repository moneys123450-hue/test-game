# 카이 Blender 캐릭터

Blender 4.5.9 LTS에서 Python 스크립트로 직접 제작했다. 외부 생성 API나 유료 에셋을 사용하지 않았다.

## 곡면 / 뼈대 버전

- `kai-anime.glb`: 현재 게임에 적용한 모델. 인체 곡면, 의상, 얼굴·눈·머리카락, 스카프와 검을 포함한다.
- `kai-anime.blend`: 가중치와 19개 뼈대가 있는 편집 원본. 렌더를 위해 NLA 트랙은 mute 상태로 저장했다. 애니메이션을 편집할 때 해당 트랙을 활성화한다.
- `kai-anime-front.png`, `kai-anime-back.png`, `kai-anime-face.png`: Blender 스튜디오 렌더.
- `tools/build-kai-anime.py`: 원본을 재생성하는 Blender 스크립트.
- `Idle`, `Run`, `Slash` 클립을 게임 상태에 따라 전환한다. 머티리얼별로 합쳐 브라우저 렌더 호출을 줄였다. 인스턴스별 뼈대는 `SkeletonUtils.clone`으로 분리한다.
- `http://127.0.0.1:8000/character.html`: 이전 모델 비교, 회전, 얼굴 확대, 동작 재생 화면.
- `http://127.0.0.1:8000/?model=block`: 이전 Blender 모델로 게임 실행.
- `http://127.0.0.1:8000/?model=original`: 최초 코드 모델로 게임 실행.

손가락 개별 애니메이션, 표정/립싱크, 물리 기반 천 시뮬레이션은 없다. 코트·스카프는 뼈대 애니메이션으로 움직인다. 세라 초상화와의 일치도를 수치로 측정한 결과는 아니다.

## 이전 시제품 (비교용 보존)

- `kai-preview.png`: 앞쪽 3/4 렌더
- `kai-back.png`: 뒤쪽 3/4 렌더
- `kai-prototype.blend`: 개별 부품·재질·조명·카메라를 편집할 수 있는 원본
- `kai-prototype.glb`: 캐릭터만 내보낸 모델. 받침대와 촬영 조명은 제외
- 재생성: `blender --background --python tools/build-kai.py` (저장소 루트에서 실행)

이전 시제품에는 별도 스켈레톤이 없으며 이름으로 팔·다리 부품을 기존 피벗에 연결해 이동·공격 동작을 사용한다. 렌더의 조명은 게임 조명과 다르므로 게임 화면의 색과 광택은 달라질 수 있다.

`npm run dev` 후 http://127.0.0.1:8000 에서 카이를 선택한다. 기존 모델 비교는 http://127.0.0.1:8000/?model=original 로 연다. 로드 실패 시 기존 모델을 유지한다.
