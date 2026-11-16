// Higgsfield 로 생성한 이미지 목록. 키가 없거나 로드에 실패하면 렌더러가 도형으로 대체한다.
// 값 형식:  '주소'  또는  { src: '주소', grid: [열, 행], cell: [x, y] }  (한 장에 여러 개를 담은 시트의 한 칸)
// 저장소에 파일로 옮긴 뒤에는 주소를 'assets/파일명' 같은 상대 경로로 바꾸면 된다.
// 키 규칙: hero_<id> 탑다운 스프라이트(오른쪽을 바라봄) / portrait_<id> 초상화 / icon_<id>_<0~3> 스킬 아이콘
//          tower0·tower1·core0·core1·minion0·minion1 (0=블루, 1=레드) / ground 바닥 타일 / title 타이틀 배경
// 생성 프롬프트는 tools/asset-prompts.json 에 있다.
const CDN = 'https://d8j0ntlcm91z4.cloudfront.net/user_3LwojqBAWQYRiqw0VgFcSDJLR64/';
const sheet = (file, cols, rows, keys) => Object.fromEntries(keys.map((k, i) => [k, { src: CDN + file, grid: [cols, rows], cell: [i % cols, Math.floor(i / cols)] }]).filter(([k]) => k));

export const ASSETS = {
  hero_kai: CDN + 'hf_20261116_091153_95e86984-b2b5-4867-a6dd-e86c28b75c57.png',
  portrait_sera: CDN + 'hf_20261116_113820_08ba2ba2-a81c-488f-a216-cdc71e1b1c0e.png',
};

// CSS 배경으로 쓸 때의 스타일 (시트의 한 칸만 보이게)
export function cssBg(key) {
  const a = ASSETS[key];
  if (!a) return null;
  if (typeof a === 'string') return { backgroundImage: `url(${a})` };
  const [c, r] = a.grid, [x, y] = a.cell;
  return { backgroundImage: `url(${a.src})`, backgroundSize: `${c * 100}% ${r * 100}%`, backgroundPosition: `${c > 1 ? (x / (c - 1)) * 100 : 0}% ${r > 1 ? (y / (r - 1)) * 100 : 0}%` };
}
