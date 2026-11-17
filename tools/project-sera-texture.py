"""Blender: project the existing Sera front reference onto a COPY of the static GLB.
Bake to a regular UV texture and GLB. Geometry and original files stay unchanged.
Run: blender --background --python tools/project-sera-texture.py
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'art'/'sera-ai'
SOURCE=OUT/'sera-triposr-normalized.glb'
REFERENCE=OUT/'sera-reference-cutout.png'
MULTIVIEW='--multiview' in sys.argv
PREFIX='sera-multiview' if MULTIVIEW else 'sera-projected'
original_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(meshes)==1
obj=meshes[0];bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
obj.name='Sera_Projected_Static'
mesh=obj.data;counts=(len(mesh.vertices),len(mesh.polygons))
coords=np.array([v.co[:] for v in mesh.vertices]);lo=coords.min(0);hi=coords.max(0)
image=bpy.data.images.load(str(REFERENCE),check_existing=True)
pixels=np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4)
ys,xs=np.where(pixels[:,:,3]>.5);assert len(xs)>100
u0,u1=xs.min()/image.size[0],(xs.max()+1)/image.size[0]
v0,v1=ys.min()/image.size[1],(ys.max()+1)/image.size[1]
assert u1>u0 and v1>v0
uv=mesh.uv_layers.new(name='ProjectionUV')
for loop in mesh.loops:
    p=mesh.vertices[loop.vertex_index].co
    uv.data[loop.index].uv=(u0+(p.y-lo[1])/(hi[1]-lo[1])*(u1-u0),v0+(p.z-lo[2])/(hi[2]-lo[2])*(v1-v0))

# shortcut: only a front reference exists. Occluded and back-facing surfaces keep
# their original vertex colors; supply side/back references for full coverage.
bvh=BVHTree.FromPolygons([v.co for v in mesh.vertices],[p.vertices[:] for p in mesh.polygons])
weight=mesh.attributes.new('ProjectionWeight','FLOAT','POINT')
visible=0
for v in mesh.vertices:
    hit,normal,face,distance=bvh.ray_cast(Vector((hi[0]+5,v.co.y,v.co.z)),Vector((-1,0,0)))
    facing=max(0,min(1,(v.normal.x-.12)/.5))
    exposed=hit is not None and abs(hit.x-v.co.x)<.035
    w=(facing*facing*(3-2*facing)) if exposed else 0
    weight.data[v.index].value=w
    visible+=w>.1

atlas=bpy.data.images.new('Sera_Projected_Albedo',width=4096,height=4096,alpha=False)
atlas.filepath_raw=str(OUT/f'{PREFIX}-albedo.png');atlas.file_format='PNG'
references=[]
if MULTIVIEW:
    # Camera +Y sees the character's nose pointing left; -Y points right.
    for name,axis,sign,haxis,hsign in [('front',0,1,1,1),('back',0,-1,1,-1),('side-left',1,1,0,-1),('side-right',1,-1,0,1)]:
        ref=image if name=='front' else bpy.data.images.load(str(OUT/f'sera-reference-{name}.png'))
        rgba=np.array(ref.pixels[:],dtype=np.float32).reshape(ref.size[1],ref.size[0],4)
        yy,xx=np.where(rgba[:,:,3]>.5);assert len(xx)>100
        bounds=(xx.min()/ref.size[0],(xx.max()+1)/ref.size[0],yy.min()/ref.size[1],(yy.max()+1)/ref.size[1])
        layer=mesh.uv_layers.new(name=f'View_{name}')
        weights=mesh.attributes.new(f'Weight_{name}','FLOAT','POINT')
        painted=0
        for v in mesh.vertices:
            origin=v.co.copy();origin[axis]=(hi[axis]+5) if sign>0 else (lo[axis]-5)
            direction=Vector((0,0,0));direction[axis]=-sign
            hit,_,_,_=bvh.ray_cast(origin,direction)
            exposed=hit is not None and abs(hit[axis]-v.co[axis])<.035
            w=max(0,v.normal[axis]*sign)**6 if exposed else 0
            weights.data[v.index].value=w;painted+=w>.01
        assert painted>100, (name,painted)
        for loop in mesh.loops:
            p=mesh.vertices[loop.vertex_index].co
            horizontal=(p[haxis]-lo[haxis])/(hi[haxis]-lo[haxis])
            if hsign<0:horizontal=1-horizontal
            layer.data[loop.index].uv=(bounds[0]+horizontal*(bounds[1]-bounds[0]),bounds[2]+(p.z-lo[2])/(hi[2]-lo[2])*(bounds[3]-bounds[2]))
        references.append((name,ref,painted))
for material in mesh.materials:
    material.use_nodes=True;material.use_fake_user=True
    nodes=material.node_tree.nodes;links=material.node_tree.links
    bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    base=bsdf.inputs['Base Color'];base_socket=base.links[0].from_socket if base.is_linked else None
    uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='ProjectionUV'
    texture=nodes.new('ShaderNodeTexImage');texture.image=image;texture.extension='CLIP';links.new(uvnode.outputs['UV'],texture.inputs['Vector'])
    attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='ProjectionWeight'
    multiply=nodes.new('ShaderNodeMath');multiply.operation='MULTIPLY';links.new(attr.outputs['Fac'],multiply.inputs[0]);links.new(texture.outputs['Alpha'],multiply.inputs[1])
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';links.new(multiply.outputs[0],mix.inputs[0])
    if base_socket:links.new(base_socket,mix.inputs[1])
    else:mix.inputs[1].default_value=base.default_value
    links.new(texture.outputs['Color'],mix.inputs[2])
    if MULTIVIEW:
        # Weighted mean avoids order-dependent seams; alpha rejects image backgrounds.
        total=None;colors=None
        for name,ref,_ in references:
            viewuv=nodes.new('ShaderNodeUVMap');viewuv.uv_map=f'View_{name}'
            tex=nodes.new('ShaderNodeTexImage');tex.image=ref;tex.extension='CLIP';links.new(viewuv.outputs['UV'],tex.inputs['Vector'])
            attr=nodes.new('ShaderNodeAttribute');attr.attribute_name=f'Weight_{name}'
            weightnode=nodes.new('ShaderNodeMath');weightnode.operation='MULTIPLY';links.new(attr.outputs['Fac'],weightnode.inputs[0]);links.new(tex.outputs['Alpha'],weightnode.inputs[1])
            weighted=nodes.new('ShaderNodeVectorMath');weighted.operation='SCALE';links.new(tex.outputs['Color'],weighted.inputs[0]);links.new(weightnode.outputs[0],weighted.inputs['Scale'])
            if total is None:total=weightnode.outputs[0];colors=weighted.outputs['Vector']
            else:
                add=nodes.new('ShaderNodeMath');add.operation='ADD';links.new(total,add.inputs[0]);links.new(weightnode.outputs[0],add.inputs[1]);total=add.outputs[0]
                addcolor=nodes.new('ShaderNodeVectorMath');addcolor.operation='ADD';links.new(colors,addcolor.inputs[0]);links.new(weighted.outputs['Vector'],addcolor.inputs[1]);colors=addcolor.outputs['Vector']
        divisor=nodes.new('ShaderNodeMath');divisor.operation='MAXIMUM';links.new(total,divisor.inputs[0]);divisor.inputs[1].default_value=.00001
        inverse=nodes.new('ShaderNodeMath');inverse.operation='DIVIDE';inverse.inputs[0].default_value=1;links.new(divisor.outputs[0],inverse.inputs[1])
        average=nodes.new('ShaderNodeVectorMath');average.operation='SCALE';links.new(colors,average.inputs[0]);links.new(inverse.outputs[0],average.inputs['Scale'])
        coverage=nodes.new('ShaderNodeMath');coverage.operation='MULTIPLY';coverage.use_clamp=True;links.new(total,coverage.inputs[0]);coverage.inputs[1].default_value=12
        links.new(coverage.outputs[0],mix.inputs[0]);links.new(average.outputs['Vector'],mix.inputs[2])
    emission=nodes.new('ShaderNodeEmission');links.new(mix.outputs[0],emission.inputs['Color'])
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');links.new(emission.outputs[0],output.inputs['Surface'])
    target=nodes.new('ShaderNodeTexImage');target.image=atlas;nodes.active=target

mesh.uv_layers.new(name='BakeUV');mesh.uv_layers.active=mesh.uv_layers['BakeUV'];mesh.uv_layers['BakeUV'].active_render=True
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.1519,island_margin=.002);bpy.ops.object.mode_set(mode='OBJECT')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
scene.render.bake.use_clear=True
print('Baking projected front texture to 4096 UV atlas',flush=True)
bpy.ops.object.bake(type='EMIT',margin=8)
atlas.save();atlas.pack();image.pack()
for _,ref,_ in references:ref.pack()
material=bpy.data.materials.new('Sera_Projected_Baked');material.use_nodes=True
nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes.get('Principled BSDF')
bsdf.inputs['Metallic'].default_value=0;bsdf.inputs['Roughness'].default_value=.85
texture=nodes.new('ShaderNodeTexImage');texture.image=atlas
uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map='BakeUV';links.new(uvnode.outputs['UV'],texture.inputs['Vector']);links.new(texture.outputs['Color'],bsdf.inputs['Base Color'])
old_materials=list(mesh.materials);mesh.materials.clear();mesh.materials.append(material)
for p in mesh.polygons:p.material_index=0
mesh.uv_layers.active=mesh.uv_layers['BakeUV']
assert counts==(len(mesh.vertices),len(mesh.polygons))
assert np.allclose(coords,np.array([v.co[:] for v in mesh.vertices]))
assert original_hash==hashlib.sha256(SOURCE.read_bytes()).hexdigest()
target=OUT/f'{PREFIX}.glb'
for attr in list(mesh.color_attributes):mesh.color_attributes.remove(attr)
for layer in list(mesh.uv_layers):
    if layer.name!='BakeUV':mesh.uv_layers.remove(layer)
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True)
(OUT/('multiview-report.json' if MULTIVIEW else 'projection-report.json')).write_text(json.dumps({'source':SOURCE.name,'source_sha256':original_hash,'reference':REFERENCE.name,'method':'four-view orthographic projection, visibility/normal/alpha weighted' if MULTIVIEW else 'front orthographic projection, visibility/normal weighted, original colors on back','views':{name:painted for name,_,painted in references},'atlas':4096,'vertices':counts[0],'faces':counts[1],'painted_vertices':visible,'geometry_changed':False,'rigged':False,'output':target.name},indent=2),encoding='utf-8')

def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
stage=bpy.data.materials.new('Stage');stage.diffuse_color=(.025,.035,.055,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.data.materials.append(stage)
for loc,power,color in [((3,-4,5),500,(1,.9,.85)),((-3,1,3),650,(.6,.75,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.color=color;light.data.size=4;aim(light,(0,0,1))
bpy.ops.object.camera_add(location=(5,0,1.3));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.55;aim(cam,(0,0,1));scene.camera=cam
scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.15,.15,.15)
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{PREFIX}.blend'),compress=True)
for name,pos in [('front',(5,0,1.3)),('angle',(5,2.6,2.5)),('side',(.01,5,1.3)),('back',(-5,0,1.3)),('side-right',(0,-5,1.3))]:
    cam.location=pos;aim(cam,(0,0,1));scene.render.filepath=str(OUT/f'{PREFIX}-{name}.png');bpy.ops.render.render(write_still=True)
print('Projected GLB saved:',target,flush=True)
