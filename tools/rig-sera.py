"""Skin the four-view Sera mesh without replacing its UVs or texture.
Run: blender --background --python tools/rig-sera.py
"""
import bpy
import hashlib
import json
from pathlib import Path
from math import sin, cos, pi, exp
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent.parent/'art'/'sera-ai'
SOURCE=OUT/'sera-multiview.glb'
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
obj=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM');bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Match Kai: Blender front -Y, up Z; glTF front +Z, up Y.
obj.data.transform(Matrix.Rotation(-pi/2,4,'Z'));obj.name='Sera_SkinnedCharacter'
mesh=obj.data;counts=(len(mesh.vertices),len(mesh.polygons))
uv_before=[tuple(v.uv) for v in mesh.uv_layers.active.data]
bpy.ops.object.armature_add(enter_editmode=True);rig=bpy.context.object;rig.name='Sera_Rig';rig.show_in_front=True
eb=rig.data.edit_bones;eb.remove(eb[0])
segments={}
def bone(name,head,tail,parent=None):
    b=eb.new(name);b.head=head;b.tail=tail
    if parent:b.parent=eb[parent]
    segments[name]=(Vector(head),Vector(tail))
bone('root',(0,0,0),(0,0,.15))
bone('hips',(0,0,1.02),(0,0,1.18),'root')
bone('spine',(0,0,1.18),(0,0,1.45),'hips')
bone('chest',(0,0,1.45),(0,0,1.62),'spine')
bone('neck',(0,0,1.62),(0,0,1.70),'chest')
bone('head',(0,0,1.70),(0,0,1.98),'neck')
for s,side in [(1,'R'),(-1,'L')]:
    bone('upper_arm.'+side,(s*.20,0,1.56),(s*.33,-.015,1.30),'chest')
    bone('forearm.'+side,(s*.33,-.015,1.30),(s*.45,-.04,1.09),'upper_arm.'+side)
    bone('hand.'+side,(s*.45,-.04,1.09),(s*.53,-.04,1.00),'forearm.'+side)
    bone('thigh.'+side,(s*.11,0,1.04),(s*.115,-.015,.57),'hips')
    bone('shin.'+side,(s*.115,-.015,.57),(s*.12,0,.13),'thigh.'+side)
    bone('foot.'+side,(s*.12,0,.13),(s*.12,-.16,.055),'shin.'+side)
    bone('coat.'+side,(s*.19,.035,1.07),(s*.27,.07,.30),'hips')
    bone('hair.'+side,(s*.10,.12,1.68),(s*.29,.17,1.04),'head')
    bone('hair_tip.'+side,(s*.29,.17,1.04),(s*.34,.17,.68),'hair.'+side)
bpy.ops.object.mode_set(mode='OBJECT')
groups={name:obj.vertex_groups.new(name=name) for name in segments}
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def distance(p,name):
    a,b=segments[name];ab=b-a;t=max(0,min(1,(p-a).dot(ab)/ab.length_squared))
    return (p-a-t*ab).length
# shortcut: reconstructed hair, sleeves and torso are fused; spatial skinning
# cannot give them fully independent motion. Separate/retopologize for large poses.
for v in mesh.vertices:
    p=v.co;x,y,z=p;side='R' if x>=0 else 'L';ax=abs(x)
    torso=['hips','spine','chest','neck','head']
    arm=['upper_arm.'+side,'forearm.'+side,'hand.'+side]
    leg=['thigh.'+side,'shin.'+side,'foot.'+side]
    candidates=torso+arm+leg+['coat.'+side,'hair.'+side,'hair_tip.'+side]
    arm_factor=smooth(.18,.34,ax)*smooth(.88,1.12,z)*(1-smooth(1.59,1.73,z))
    hair_factor=smooth(.045,.14,y)*smooth(.70,1.0,z)*(1-smooth(1.62,1.80,z))
    coat_factor=smooth(.18,.30,ax)*(1-smooth(1.00,1.16,z))
    scores=[]
    for name in candidates:
        factor=1
        if name in torso:factor=(1-arm_factor)*(1-coat_factor)*(1-hair_factor)
        elif name in arm:factor=arm_factor*(1-hair_factor)
        elif name in leg:factor=(1-coat_factor)*(1-smooth(1.04,1.17,z))
        elif name.startswith('coat.'):factor=coat_factor
        else:factor=hair_factor
        scores.append((factor*exp(-(distance(p,name)/.115)**2),name))
    selected=sorted(scores,reverse=True)[:4];total=sum(w for w,_ in selected)
    if total<1e-20:selected=[(1,min(candidates,key=lambda n:distance(p,n)))];total=1
    for w,name in selected:
        if w/total>1e-6:groups[name].add([v.index],w/total,'REPLACE')
for v in mesh.vertices:
    total=sum(g.weight for g in v.groups)
    assert abs(total-1)<1e-4 and 1<=len(v.groups)<=4,(v.index,total)
mod=obj.modifiers.new('Sera skin weights','ARMATURE');mod.object=rig;obj.parent=rig
scene=bpy.context.scene;scene.render.fps=30
def clip(name,frames):
    rig.animation_data_create();rig.animation_data.action=None
    for frame,angles in frames:
        for b in rig.pose.bones:
            b.rotation_mode='XYZ';b.rotation_euler=angles.get(b.name,(0,0,0));b.location=angles.get('@'+b.name,(0,0,0))
            b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('location',frame=frame)
    action=rig.animation_data.action;action.name=name
    track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action)
    strip.action_slot=action.slots[0]
    strip.influence=1;strip.use_animated_influence=False;strip.extrapolation='NOTHING'
    rig.animation_data.use_nla=True
    rig.animation_data.action=None
idle=[];run=[]
for f in range(1,122,6):
    a=(f-1)/120*2*pi
    pose={'chest':(.009*sin(a),0,.006*sin(a)),'head':(0,.012*sin(a),0)}
    for side,s in [('R',1),('L',-1)]:
        pose['forearm.'+side]=(-.045-.018*sin(a),0,0)
        pose['hair.'+side]=(.012*sin(a+.5),0,s*.008*sin(a))
        pose['coat.'+side]=(.012*sin(a+.8),0,s*.01*sin(a))
    idle.append((f,pose))
clip('Idle',idle)
for f in range(1,26):
    a=(f-1)/24*2*pi
    pose={'spine':(.045,0,0),'head':(-.03,0,0),'@hips':(0,-.012*(1-cos(2*a)),0)}
    for side,s in [('R',1),('L',-1)]:
        w=sin(a+(0 if s==1 else pi))
        pose['thigh.'+side]=(-.32*w,0,0)
        pose['shin.'+side]=(.43*max(0,w),0,0)
        pose['foot.'+side]=(.32*w-.43*max(0,w),0,0)
        pose['upper_arm.'+side]=(.16*w,0,0);pose['forearm.'+side]=(-.20,0,0)
        pose['coat.'+side]=(-.06+.045*sin(a-.6+s),0,0)
        pose['hair.'+side]=(.035+.016*sin(a-.5),0,s*.01*sin(a))
        pose['hair_tip.'+side]=(.025*sin(a-.9),0,0)
    run.append((f,pose))
clip('Run',run)
# Same clip contract as Kai; Sera's Slash clip is a restrained casting gesture.
clip('Slash',[(1,{}),(8,{'chest':(0,-.07,0),'upper_arm.R':(-.24,0,-.06),'forearm.R':(-.18,0,0),'hand.R':(.08,0,0),'upper_arm.L':(-.08,0,.03)}),(14,{'chest':(0,.055,0),'upper_arm.R':(-.35,0,-.05),'forearm.R':(-.08,0,0),'hand.R':(-.08,0,0),'hair.R':(.025,0,0)}),(25,{})])
def rest():
    rig.animation_data.action=None
    for t in rig.animation_data.nla_tracks:t.mute=True
    for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
    scene.frame_set(1);bpy.context.view_layer.update()
rest()
assert counts==(len(mesh.vertices),len(mesh.polygons))
assert uv_before==[tuple(v.uv) for v in mesh.uv_layers.active.data]
assert source_hash==hashlib.sha256(SOURCE.read_bytes()).hexdigest()
# Finite skinning and bounded displacement across every exported animation.
deformation={}
for track in rig.animation_data.nla_tracks:
    rest();track.mute=False;max_move=0;min_z=100
    rig.animation_data.action=track.strips[0].action;rig.animation_data.action_slot=track.strips[0].action.slots[0];track.mute=True
    for frame in range(1,int(track.strips[0].frame_end)+1,4):
        scene.frame_set(frame);bpy.context.view_layer.update();evaluated=obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        positions=[v.co for v in evaluated.data.vertices]
        assert all(all(abs(c)<5 for c in p) for p in positions)
        max_move=max(max_move,max((p-v.co).length for p,v in zip(positions,mesh.vertices)))
        min_z=min(min_z,min(p.z for p in positions))
    assert .001<max_move<.9,(track.name,max_move)
    deformation[track.name]={'max_displacement':max_move,'min_z':min_z}
rest();bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.export_scene.gltf(filepath=str(OUT/'sera-rigged.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
rest()
for image in bpy.data.images:
    if image.size[0]>0 and image.type=='IMAGE':image.pack()
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
stage=bpy.data.materials.new('Stage');stage.diffuse_color=(.025,.035,.055,1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02));bpy.context.object.data.materials.append(stage)
for loc,power,color in [((2,-4,5),550,(1,.92,.88)),((-3,-1,3),350,(.7,.8,1)),((1,3,4),550,(.6,.65,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.color=color;light.data.size=4;aim(light,(0,0,1))
bpy.ops.object.camera_add(location=(2,-5,1.8));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.55;aim(cam,(0,0,1));scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.15,.15,.15)
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'sera-rigged.blend'),compress=True)
for name in ['Idle','Run','Slash']:
    rest();action=next(t for t in rig.animation_data.nla_tracks if t.name==name).strips[0].action
    rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
    scene.frame_set({'Idle':31,'Run':7,'Slash':14}[name]);scene.render.filepath=str(OUT/f'sera-rigged-{name.lower()}.png');bpy.ops.render.render(write_still=True)
(OUT/'rig-report.json').write_text(json.dumps({'source':SOURCE.name,'source_sha256':source_hash,'bones':len(rig.data.bones),'vertices':counts[0],'faces':counts[1],'uv_preserved':True,'max_influences':4,'clips':deformation,'method':'spatial segment skinning, fused cloth/hair remain approximate'},indent=2),encoding='utf-8')
print('SERA_RIGGED_COMPLETE',deformation,flush=True)
