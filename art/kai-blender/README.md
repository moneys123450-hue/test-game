# 카이 Blender 외형 시제품

Blender 4.5.9 LTS에서 Python 스크립트로 직접 제작했다. 외부 생성 API나 유료 에셋을 사용하지 않았다.

- `kai-preview.png`: 앞쪽 3/4 렌더
- `kai-back.png`: 뒤쪽 3/4 렌더
- `kai-prototype.blend`: 개별 부품·재질·조명·카메라를 편집할 수 있는 원본
- `kai-prototype.glb`: 캐릭터만 내보낸 모델. 받침대와 촬영 조명은 제외
- 재생성: `blender --background --python tools/build-kai.py` (저장소 루트에서 실행)

게임의 카이에 적용했다. 별도 스켈레톤은 없으며 이름으로 팔·다리 부품을 기존 피벗에 연결해 이동·공격 동작을 사용한다. 뼈대 기반 자연스러운 변형은 후속 작업이다. 렌더의 조명은 게임 조명과 다르므로 게임 화면의 색과 광택은 달라질 수 있다.

`npm run dev` 후 http://127.0.0.1:8000 에서 카이를 선택한다. 기존 모델 비교는 http://127.0.0.1:8000/?model=original 로 연다. 로드 실패 시 기존 모델을 유지한다.
