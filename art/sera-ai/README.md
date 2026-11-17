# 세라 AI 3D 제작 준비 — 모델 생성 미완료

현재 파일은 **전신 기준 이미지**이며, 실제 AI 3D GLB나 애니메이션이 아니다. 게임의 캐릭터 모델은 이 작업으로 교체하지 않았다.

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
