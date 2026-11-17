"""Blender CPU preview: --background --python tools/preview-ai-model.py -- input.glb.
Normalizes a static generated mesh to 2m tall; does not claim to rig or animate it.
"""
import bpy
import sys
from pathlib import Path
from mathutils import Vector, Matrix
from math import pi

args = sys.argv[sys.argv.index('--')+1:]
assert len(args)==1, 'Pass one input GLB after --'
source=Path(args[0]).resolve();assert source.is_file()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert meshes
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
if len(meshes)>1:bpy.ops.object.join()
model=bpy.context.object;model.name='Sera_AI_Unrigged'
def bounds():
    pts=[model.matrix_world@Vector(v) for v in model.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]),Vector([max(p[i] for p in pts) for i in range(3)])
lo,hi=bounds();axis=max(range(3),key=lambda i:(hi-lo)[i])
if axis!=2:model.matrix_world=Matrix.Rotation(-pi/2,4,'X' if axis==1 else 'Y')@model.matrix_world
lo,hi=bounds();model.matrix_world=Matrix.Scale(2/(hi.z-lo.z),4)@model.matrix_world
lo,hi=bounds();model.location-=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
bpy.context.view_layer.update()
for p in model.data.polygons:p.use_smooth=True
for m in model.data.materials:
    if m and m.use_nodes:
        for node in m.node_tree.nodes:
            if node.type=='BSDF_PRINCIPLED':
                node.inputs['Metallic'].default_value=0
                node.inputs['Roughness'].default_value=.85
bpy.ops.export_scene.gltf(filepath=str(source.with_name('sera-triposr-normalized.glb')),export_format='GLB',use_selection=True)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
mat=bpy.data.materials.new('Stage');mat.diffuse_color=(.025,.035,.055,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(mat)
for loc,power,color in [((3,-4,5),500,(1,.9,.85)),((-3,1,3),650,(.6,.75,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.color=color;l.data.shape='DISK';l.data.size=4;aim(l,(0,0,1))
bpy.ops.object.camera_add(location=(2.6,-5,2.5));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.7;aim(cam,(0,0,1))
scene=bpy.context.scene;scene.camera=cam;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.world.color=(.15,.15,.15)
bpy.ops.wm.save_as_mainfile(filepath=str(source.with_suffix('.blend')))
for name,pos in [('front',(2.6,-5,2.5)),('back',(-2.6,5,2.5))]:
    cam.location=pos;aim(cam,(0,0,1));scene.render.filepath=str(source.with_name('sera-triposr-'+name+'.png'));bpy.ops.render.render(write_still=True)
print('Static AI mesh inspected and rendered:',source)
