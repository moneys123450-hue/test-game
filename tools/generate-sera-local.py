"""Run the MIT TripoSR model locally on CPU; export a real vertex-colored GLB.
Requires an external TripoSR checkout and its Python dependencies. No paid API.
Use --self-test to check the Windows marching-cubes compatibility adapter.
"""
import argparse
import json
import os
import sys
import time
import types
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=Path(os.environ.get('LOCALAPPDATA', Path.home())) / 'TripoSR' / 'source')
parser.add_argument('--resolution', type=int, default=128)
parser.add_argument('--weights', default='stabilityai/TripoSR', help='Hugging Face model ID or local folder containing config.yaml and model.ckpt')
parser.add_argument('--self-test', action='store_true')
args = parser.parse_args()

import numpy as np
import torch
from skimage.measure import marching_cubes

# shortcut: CPU scikit-image replaces the optional compiled torchmcubes extension;
# use native torchmcubes if moving this authoring script to a supported CUDA setup.
def cpu_marching_cubes(field, threshold):
    vertices, faces, _, _ = marching_cubes(field.detach().cpu().numpy(), level=threshold)
    return torch.from_numpy(vertices[:, [2, 1, 0]].copy()), torch.from_numpy(faces.copy().astype(np.int64))

if args.self_test:
    grid = np.indices((32, 32, 32)).astype(np.float32)
    field = 7 - np.sqrt(((grid - np.array([12, 15, 18], dtype=np.float32)[:, None, None, None]) ** 2).sum(0))
    v, f = cpu_marching_cubes(torch.from_numpy(field), 0)
    assert v.shape[1] == 3 and len(f) > 100
    assert np.allclose(v.mean(0).numpy(), [18, 15, 12], atol=.2)
    print('CPU surface extraction adapter passed')
    sys.exit(0)

assert 64 <= args.resolution <= 256
assert (args.source / 'tsr' / 'system.py').is_file(), 'Specify the official TripoSR checkout with --source'
compat = types.ModuleType('torchmcubes')
compat.marching_cubes = cpu_marching_cubes
sys.modules['torchmcubes'] = compat
sys.path.insert(0, str(args.source))
from PIL import Image
from tsr.system import TSR

torch.set_num_threads(min(4, os.cpu_count() or 1))
OUT = Path(__file__).resolve().parent.parent / 'art' / 'sera-ai'
image_path = OUT / 'sera-reference-cutout.png'
assert image_path.is_file(), 'Missing background-removed reference image'
print('Loading public TripoSR weights (first run downloads approximately 1.7 GB)', flush=True)
start = time.time()
model = TSR.from_pretrained(args.weights, config_name='config.yaml', weight_name='model.ckpt')
model.eval().to('cpu')
model.renderer.set_chunk_size(4096)
print(f'Model loaded after {time.time()-start:.1f}s', flush=True)

# Official preprocessing: crop to foreground, add padding and composite onto gray.
from tsr.utils import resize_foreground, remove_background
source_image = Image.open(image_path).convert('RGBA')
if source_image.getextrema()[3][0] == 255:
    import rembg
    print('Input has no alpha mask; separating original foreground with local u2netp', flush=True)
    source_image = remove_background(Image.open(OUT / 'sera-reference-front.png'), rembg.new_session('u2netp'))
    source_image.save(image_path)
assert source_image.getextrema()[3][0] < 128 and source_image.getextrema()[3][1] > 128, 'Foreground alpha mask missing'
image = resize_foreground(source_image, .85)
rgba = np.asarray(image, dtype=np.float32) / 255
rgb = rgba[:, :, :3] * rgba[:, :, 3:4] + (1 - rgba[:, :, 3:4]) * .5
image = Image.fromarray((rgb * 255).astype(np.uint8))
image.save(OUT / 'sera-triposr-input.png')
print('Running CPU image-to-3D inference', flush=True)
with torch.inference_mode():
    scene_codes = model([image], device='cpu')
    print(f'Extracting colored mesh at {args.resolution}^3 resolution', flush=True)
    meshes = model.extract_mesh(scene_codes, True, resolution=args.resolution)
mesh = meshes[0]
assert len(mesh.vertices) > 100 and len(mesh.faces) > 100, 'Empty reconstruction'
assert np.isfinite(mesh.vertices).all(), 'Invalid reconstruction coordinates'
mesh.fix_normals()
target = OUT / 'sera-triposr-local.glb'
mesh.export(target)
assert target.read_bytes()[:4] == b'glTF'
report = {'provider': 'TripoSR, local CPU', 'model': 'stabilityai/TripoSR',
          'resolution': args.resolution, 'vertices': len(mesh.vertices), 'faces': len(mesh.faces),
          'bytes': target.stat().st_size, 'seconds': round(time.time()-start, 1),
          'rigged': False, 'output': target.name}
(OUT / 'triposr-generation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report), flush=True)
