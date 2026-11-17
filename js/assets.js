// Higgsfield 로 생성한 이미지 목록. 키가 없거나 로드에 실패하면 렌더러가 도형으로 대체한다.
// 값 형식:  '주소'  또는  { src: '주소', grid: [열, 행], cell: [x, y] }  (한 장에 여러 개를 담은 시트의 한 칸)
// 저장소에 파일로 옮긴 뒤에는 주소를 'assets/파일명' 같은 상대 경로로 바꾸면 된다.
// 키 규칙: portrait_<id> 초상화 / icon_<id>_<0~3> 스킬 아이콘 / title 타이틀 배경 / ground 3D 바닥 텍스처
// (캐릭터·건물·미니언은 이미지가 아니라 js/models.js 가 3D 로 만든다)
// 생성 프롬프트는 tools/asset-prompts.json 에 있다.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3LwojqBAWQYRiqw0VgFcSDJLR64/';
const sheet = (file, cols, rows, keys) => Object.fromEntries(keys.map((k, i) => [k, { src: CDN + file, grid: [cols, rows], cell: [i % cols, Math.floor(i / cols)] }]).filter(([k]) => k));

export const ASSETS = {
  portrait_sera: CDN + 'hf_20261116_113820_08ba2ba2-a81c-488f-a216-cdc71e1b1c0e.png',
  // 영웅 탑다운 그림 (2D 시절 생성분). 초상화가 없는 영웅의 HUD·선택 화면 대체 이미지로 쓴다
  ...sheet('hf_20261116_125123_69977583-1aa2-4d59-ad44-e4c35543fa7a.webp', 2, 2, ['sprite_kai', 'sprite_lyra', 'sprite_brom', 'sprite_sera']),
};

// CSS 배경으로 쓸 때의 스타일 (시트의 한 칸만 보이게)
export function cssBg(key) {
  const a = ASSETS[key];
  if (!a) return null;
  if (typeof a === 'string') return { backgroundImage: `url(${a})` };
  const [c, r] = a.grid, [x, y] = a.cell;
  return { backgroundImage: `url(${a.src})`, backgroundSize: `${c * 100}% ${r * 100}%`, backgroundPosition: `${c > 1 ? (x / (c - 1)) * 100 : 0}% ${r > 1 ? (y / (r - 1)) * 100 : 0}%` };
}

// 반환값: 키 → { img, sx, sy, sw, sh } (시트면 해당 칸의 영역)
export function loadAssets(onProgress) {
  const out = {};
  const keys = Object.keys(ASSETS).filter((k) => ASSETS[k]);
  const srcs = [...new Set(keys.map((k) => ASSETS[k].src || ASSETS[k]))];
  if (!srcs.length) return Promise.resolve(out);
  let done = 0;
  const imgs = {};
  return Promise.all(srcs.map((src) => new Promise((res) => {
    const img = new Image();
    const fin = (ok) => { if (ok) imgs[src] = img; onProgress && onProgress(++done / srcs.length); res(); };
    img.onload = () => fin(true); img.onerror = () => fin(false);
    img.src = src;
  }))).then(() => {
    for (const k of keys) {
      const a = ASSETS[k], img = imgs[a.src || a];
      if (!img) continue;
      if (a.grid) { const sw = img.width / a.grid[0], sh = img.height / a.grid[1]; out[k] = { img, sx: a.cell[0] * sw, sy: a.cell[1] * sh, sw, sh }; }
      else out[k] = { img, sx: 0, sy: 0, sw: img.width, sh: img.height };
    }
    return out;
  });
}

