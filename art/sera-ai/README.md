# 세라 AI 3D 제작 — 무료 CPU 변환 검증

**로컬 TripoSR로 색상이 포함된 GLB 생성·저장과 Blender 열람을 확인했다.** 다만 얼굴·손·머리카락·의상 디테일이 많이 뭉개져 원하는 세라 품질에는 미달한다. 뼈대와 애니메이션도 없다. 게임의 캐릭터 모델은 교체하지 않았다. 원본 이미지는 별개의 2D 파일이다.

## 실제 저장된 결과

- `sera-triposr-local.glb`: 로컬 CPU 생성 원본, 256 해상도, 45824개 정점/91656개 면, 약 1.83MB. 모델 로딩 포함 생성 약 42초.
- `sera-triposr-normalized.glb`: Blender에서 축 방향·크기를 보정한 2m 높이 미리보기용 모델.
- `sera-triposr-local.blend`: 생성 모델과 검수용 카메라·조명을 포함한 Blender 파일.
- `sera-triposr-front.png`, `sera-triposr-back.png`: 실제 모델 렌더. 전신 기준 이미지나 그림을 3D 결과라고 제시하지 않는다.
- `http://127.0.0.1:8000/sera-preview.html`: 회전·확대 검수용 화면. 동작 버튼은 비활성화되어 있다.
- 생성 수치는 `triposr-generation.json`, 도구 라이선스는 `TripoSR-LICENSE`에 있다.

## Blender 정면 이미지 투영 실험

- `tools/project-sera-texture.py`가 원본 GLB의 복사본에 전신 기준 이미지를 투영하고, 4096 UV 텍스처로 베이크해 `sera-projected.glb`에 내보낸다. 사용한 이미지는 기존 `sera-reference-cutout.png`이며 새 AI 이미지는 생성하지 않았다.
- 원본 모델의 실제 정면은 Blender +X다. +X 방향의 가시성 raycast와 법선 가중치를 사용해 정면에서 가려진 표면과 뒷면에는 원본 색상을 유지한다. 정면 이미지를 모델의 가로/세로 범위에 맞춰 투영하므로 얼굴·손·옷의 위치가 완전히 맞지는 않는다.
- `sera-projected-albedo.png`: 실제 GLB에 포함된 베이크 텍스처. `sera-projected.blend`: 압축 저장한 편집/검수 원본. `sera-projected-front.png`, `-angle.png`, `-side.png`, `-back.png`는 실제 3D 렌더다.
- `sera-preview.html`은 기본적으로 투영 후를 열고 **투영 전 원본** 버튼으로 같은 각도에서 비교한다. 뷰어는 Sera 모델의 정면 방향도 보정한다.
- 텍스처가 있는 재질은 `characterMaterial()`에서 원본 재질을 복제해 map/UV 채널을 유지한다. 기존 버텍스 컬러를 투영 그림에 이중 곱하지 않도록 투영 결과에는 색상 속성을 제거하고, 사용하지 않는 UV 채널도 제거했다.
- 정점/면 수와 원본 파일 SHA-256 보존을 스크립트에서 검사했다. 원본과 투영 결과는 동일한 91656개 면이다. 세부 기록은 `projection-report.json`에 있다.
- 정면의 눈·색·무늬는 더 읽히지만 형태는 동일하게 거칠다. 옆면에는 늘어짐/경계가 남고 뒷면은 개선되지 않았다. **형태 수정·리깅·게임 적용은 아니다.**

```powershell
& 'C:\Users\USER\AppData\Local\BlenderPortable\blender-4.5.9-windows-x64\blender.exe' --background --python tools/project-sera-texture.py
```

베이크는 emission 색만 저장해 촬영 조명이 텍스처에 추가로 구워지지 않게 했다. 원본 참고 이미지 자체에 있던 명암은 남아 있다. 다시 실행하면 `sera-projected*`만 갱신하며 원본 normalized GLB는 유지한다. 브라우저 회귀 검사는 투영 GLB의 텍스처 로드, 원본과 면 수 동일, 정적 모델 상태와 전/후 전환을 함께 확인한다.

## 로컬 실행 (계정·구독·내보내기 결제 없음)

실제 환경은 Python 3.13, CPU PyTorch 2.15.0, Transformers 4.49.0이다. 공식 구버전 requirements의 일부 패키지는 Python 3.13용 바이너리가 없어 호환 버전을 사용했다. CUDA 확장 torchmcubes 대신 scikit-image 어댑터를 사용하며 `--self-test`로 좌표 규약을 검사한다. 이 PC의 도구·가상환경은 `%LOCALAPPDATA%\TripoSR`, 모델은 그 아래 `weights`에 있다. 1.7GB 모델과 가상환경은 저장소에 넣지 않는다.

설치 예시(저장소 루트, Windows PowerShell):

```powershell
$toolRoot = "$env:LOCALAPPDATA\TripoSR"
git clone --depth 1 https://github.com/VAST-AI-Research/TripoSR.git "$toolRoot\source"
python -m venv "$toolRoot\venv"
& "$toolRoot\venv\Scripts\python.exe" -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
& "$toolRoot\venv\Scripts\python.exe" -m pip install -r tools/requirements-triposr-cpu.txt
python tools/download-triposr.py
& "$toolRoot\venv\Scripts\python.exe" tools/generate-sera-local.py --self-test
& "$toolRoot\venv\Scripts\python.exe" tools/generate-sera-local.py --weights "$toolRoot\weights" --resolution 256
```

공개 모델은 `stabilityai/TripoSR`(MIT, gated=false)이다. 다운로드 스크립트는 새로 받은 model.ckpt의 SHA-256을 확인한다. 웹 서비스의 생성 결과나 유료 내보내기 데이터를 추출하는 방식이 아니다.

첫 시도에서 데모의 전처리 PNG를 투명 이미지로 잘못 취급해 검정 배경까지 복원했다. 로컬 rembg/u2netp로 원본 배경을 제거하고 실제 알파 범위를 검사한 뒤 재실행했다. `.convert('RGBA')`만으로 투명 배경이 생기는 것은 아니다. Blender로 가져올 때 glTF/Blender 축 차이로 거꾸로 보일 수 있어 축 보정도 확인했다.

Blender 검수/정규화:

```powershell
& 'C:\Users\USER\AppData\Local\BlenderPortable\blender-4.5.9-windows-x64\blender.exe' --background --python tools/preview-ai-model.py -- art/sera-ai/sera-triposr-local.glb
```

서버가 켜져 있고 Playwright를 별도 설치했다면 `node tools/check-local-ai.cjs`로 색상 속성·2m 높이·정적 모델 표시·브라우저 예외를 검사한다. 설치 방법과 `NODE_PATH`/`CHROMIUM_PATH`는 HANDOFF의 브라우저 검사 절차와 같다.

## 이전 웹 경로 시도

## 이번 실행

- 기존 세라 초상화를 참조해 내장 imagegen 도구로 `sera-reference-front.png`를 생성했다. 얼굴·은보라 머리·보라/아이보리 의상을 유지하고, 전신 정면 A 포즈·배경과 효과 최소화를 요청했다. 최종 프롬프트는 `reference-prompt.txt`다.
- Microsoft 공식 `microsoft/TRELLIS.2` Hugging Face 공개 데모에 세션 시작과 이미지 전처리를 요청했고 성공했다.
- 실제 `/image_to_3d` 호출은 ZeroGPU 할당량 오류로 거절됐다. 모델과 GLB는 반환되지 않았다. 오류 후 같은 서비스에 생성 재요청을 반복하거나 제한을 우회하지 않았다.
- 이 PC는 GTX 1060 3GB다. 고해상도 생성 모델을 로컬에 설치하지 않았다. Blender에 AI 모델 생성이 기본 내장된 것은 아니며 외부 서비스/애드온 연동이 필요하다.
- fal의 공식 Blender 확장과 3D 생성 플러그인을 찾았으나, 현재 대화에서 fal 연결은 확인되지 않았다. 결제·유료 API 요청은 하지 않았다. 로컬 Blender MCP/AI 확장도 아직 설치하지 않았다.

## 이어서 할 일

계정 연결이나 인증 후 무료 이용 가능량부터 확인한다. 인증정보를 저장소나 대화에 붙여넣지 않는다. 공개 데모를 다시 사용할 수 있을 때:

```powershell
# gradio_client를 별도 가상환경/도구 폴더에 설치한 Python에서 실행
# 인증이 필요한 경우 HF_TOKEN은 로컬 환경 변수나 자격증명 관리로 제공
python tools/generate-sera-ai.py
```

스크립트는 1024 해상도, seed 17로 생성하고 100000면/2048 텍스처의 `sera-trellis-raw.glb`를 요청한다. 서비스가 반환한 GLB만 복사하며 유료 API로 자동 전환하지 않는다. 재실행 시 무료 quota와 서비스 이용 조건을 먼저 확인한다. 패키지는 이 PC에서 `C:\Users\USER\AppData\Local\Codex3DTools`에 별도 설치했고, 게임 실행에는 필요 없다.

GLB가 생기면 Blender에서 정면/측면/후면, 손가락·얼굴·머리카락/천 분리, 텍스처와 용량을 검수한다. **정적 AI GLB만 생성됐다고 걷기/공격 애니메이션까지 완료된 것이 아니다.** 리토폴로지·리깅·가중치·동작 연결을 확인한 뒤 게임에 적용한다. 현재 `characterMaterial()`은 일부 재질을 toon 재질로 바꾸므로, AI 텍스처가 손실되지 않도록 map/normal/alpha 처리를 검토해야 한다.

참고:
- https://github.com/microsoft/TRELLIS.2
- https://huggingface.co/spaces/microsoft/TRELLIS.2
- https://github.com/fal-ai/fal-blender-extension
