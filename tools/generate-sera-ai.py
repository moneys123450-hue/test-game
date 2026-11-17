"""Optional AI asset authoring, not a game dependency.
Requires gradio_client. Uses the official public TRELLIS.2 demo and respects
its authentication/quota errors; does not require or invoke any paid API.
"""
import json
import os
import shutil
from pathlib import Path
from gradio_client import Client, handle_file

OUT = Path(__file__).resolve().parent.parent / 'art' / 'sera-ai'
REFERENCE = OUT / 'sera-reference-front.png'
assert REFERENCE.is_file(), f'Missing reference image: {REFERENCE}'
client = Client('microsoft/TRELLIS.2', hf_token=os.environ.get('HF_TOKEN'), verbose=False, download_files=str(OUT / 'downloads'))
print('Starting public demo session', flush=True)
client.predict(api_name='/start_session')
print('Preprocessing Sera full-body reference', flush=True)
processed = client.predict(handle_file(str(REFERENCE)), api_name='/preprocess_image')
print('Generating textured 3D asset, seed 17, resolution 1024', flush=True)
client.predict(image=handle_file(processed), seed=17, resolution='1024', api_name='/image_to_3d')
print('Exporting GLB: 100000 faces, 2048 texture', flush=True)
result = client.predict(decimation_target=100000, texture_size=2048, api_name='/extract_glb')
files = result if isinstance(result, (list, tuple)) else [result]
paths = [Path(f) for f in files if isinstance(f, str) and f.lower().endswith('.glb')]
assert paths and paths[0].is_file(), f'No GLB returned: {result!r}'
target = OUT / 'sera-trellis-raw.glb'
shutil.copy2(paths[0], target)
assert target.read_bytes()[:4] == b'glTF', 'Invalid GLB signature'
(OUT / 'generation.json').write_text(json.dumps({
    'provider': 'microsoft/TRELLIS.2 official public demo',
    'reference': REFERENCE.name, 'seed': 17, 'resolution': '1024',
    'decimation_target': 100000, 'texture_size': 2048,
    'output': target.name, 'rigged': False,
}, indent=2), encoding='utf-8')
print(f'Generated {target} ({target.stat().st_size} bytes)', flush=True)
