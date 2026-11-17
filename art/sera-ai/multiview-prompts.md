# 세라 후면·측면 참고 그림 제작 기록

2026-11-17, Codex 내장 imagegen으로 각 그림을 별도 생성했다. `transparent_background: true`를 요청했으며 RGBA 알파를 확인했다. 기준 정면은 `sera-reference-front.png`, 정면 프롬프트는 `reference-prompt.txt`다. 그림 생성은 비결정적이므로 프롬프트 재실행이 같은 픽셀을 보장하지 않는다. 저장된 PNG를 투영 입력의 기준으로 사용한다.

## 후면: sera-reference-back.png

참조: 정면 PNG 1장. 실제 실행 프롬프트:

```text
Create ONE full body STRICT REAR orthographic turnaround view of this exact adult anime woman Sera for Blender texture projection. Rotate the character 180 degrees, camera perfectly behind, no face visible. Preserve exact costume, proportions, lavender flowing long hair, silver/gold halo crystal head ornament, detached wide ivory and lavender sleeves with violet lining and gold trim, purple fitted bodysuit/leggings, long split coat panels, violet high boots and crystals. Invent coherent rear costume construction continuing the front design, elegant gold seams and subtle violet magical embroidery. Same neutral A pose as reference, arms lowered slightly outward, both hands open, feet same spacing. Keep all hair, halo, fingers and boots inside canvas, vertical portrait 1024x1536 framing with small margin. Polished detailed anime game illustration, evenly lit texture colors, no dramatic shadows, no ground, no text, no grid, no other views. Actual transparent background.
```

## 코가 화면 왼쪽: sera-reference-side-left.png

참조: 정면 PNG 1장. Blender +Y 카메라에 대응하며 해부학적 좌/우 명칭과 혼동하지 않는다.

```text
ONE strict 90 degree SIDE PROFILE full body orthographic turnaround of the EXACT same adult anime woman Sera. Character nose points LEFT on canvas. Show one eye in profile, no three quarter angle, shoulders/hips seen precisely edge on. Same full body proportions, lavender long flowing hair reaching calves behind her, silver gold halo crystal headpiece seen edge on, detached flowing ivory lavender sleeves with purple lining gold trim, purple fitted bodysuit and leggings, split long pointed coat tails, violet high heeled boots and crystals. Match costume and neutral lowered A-pose to reference: arms at sides slightly outward anatomically, side camera sees near arm overlapping torso, no arm pointing forward. Legs straight, same stance. Full halo to boots visible, centered at same vertical framing as reference, portrait 1024x1536, small margin. Detailed polished anime game art, evenly lit local colors suitable Blender projection. Actual transparent background, no halo glow outside silhouette, no shadow, no ground, no text or extra characters.
```

## 코가 화면 오른쪽: sera-reference-side-right.png

참조: 정면 PNG와 위 왼쪽을 향한 프로필 PNG 2장. Blender -Y 카메라에 대응한다.

```text
Create ONE strict RIGHT-facing side profile full-body turnaround of this same adult woman Sera. Nose points RIGHT. The second reference shows the opposite profile; match that silhouette, neutral A-pose, costume proportions, framing and lavender hair exactly, but see her from her other side. 90-degree orthographic camera, only one eye visible. Exact silver gold crystal halo seen edge-on, purple ivory mage bodysuit with gold seams, detached long lavender sleeves with ivory embroidery purple lining, pointed coat tails, fitted purple leggings and heeled violet crystal boots. Hair flows behind the body on LEFT side of canvas. Full headpiece to toes within portrait 1024x1536, centered small margins. Even diffuse lighting, detailed anime texture art. Isolate character with actual transparent background. Absolutely NO luminous aura, NO glow behind silhouette, NO ground shadow, no text, no multiple views.
```

## 검수와 한계

각 결과는 1024×1536 PNG이며 후면과 옆면의 의상/체형을 정면과 비교했다. 회전 관측 데이터가 아니라 AI가 별도로 추정한 그림이므로 자세·머리 길이·장식 위치가 완전히 일치하지 않는다. 가장자리에 반투명한 색/광택이 남을 수 있다. 투영 스크립트는 알파 0.5 이상 영역으로 크기를 맞추고 실제 알파를 가중치에 곱한다. 실제 실루엣 차이와 이음새는 `sera-multiview-*.png`와 뷰어에서 확인한다. 그림을 바꾸면 대응하는 Blender 투영과 리깅을 순서대로 재생성한다.
