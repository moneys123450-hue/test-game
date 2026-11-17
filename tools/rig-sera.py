"""Skin the four-view Sera mesh without replacing its UVs or texture.
Run: blender --background --python tools/rig-sera.py
"""
import bpy
import hashlib
import json
from pathlib import Path
from math import sin, cos, pi, exp, sqrt, atan2, acos
from mathutils import Vector, Matrix

OUT=Path(__file__).resolve().parent.parent/'art'/'sera-ai'
SOURCE=OUT/'sera-multiview.glb'
PREFIX='sera-rigged-v2'
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
bone('spine',(0,0,1.18),(0,0,1.32),'hips')
bone('spine_upper',(0,0,1.32),(0,0,1.45),'spine')
bone('chest',(0,0,1.45),(0,0,1.60),'spine_upper')
bone('neck',(0,0,1.60),(0,0,1.66),'chest')
bone('neck_upper',(0,0,1.66),(0,0,1.70),'neck')
bone('head',(0,0,1.70),(0,0,1.98),'neck_upper')
for s,side in [(1,'R'),(-1,'L')]:
    bone('clavicle.'+side,(s*.045,0,1.57),(s*.20,0,1.56),'chest')
    bone('upper_arm.'+side,(s*.20,0,1.56),(s*.33,-.015,1.30),'clavicle.'+side)
    bone('upper_twist.'+side,(s*.265,-.0075,1.43),(s*.33,-.015,1.30),'upper_arm.'+side)
    bone('forearm.'+side,(s*.33,-.015,1.30),(s*.45,-.04,1.09),'upper_arm.'+side)
    bone('forearm_twist.'+side,(s*.39,-.0275,1.195),(s*.45,-.04,1.09),'forearm.'+side)
    bone('hand.'+side,(s*.45,-.04,1.09),(s*.53,-.04,1.00),'forearm.'+side)
    bone('thigh.'+side,(s*.11,0,1.04),(s*.115,-.015,.57),'hips')
    bone('thigh_twist.'+side,(s*.1125,-.0075,.805),(s*.115,-.015,.57),'thigh.'+side)
    bone('shin.'+side,(s*.115,-.015,.57),(s*.12,0,.13),'thigh.'+side)
    bone('shin_twist.'+side,(s*.1175,-.0075,.35),(s*.12,0,.13),'shin.'+side)
    bone('foot.'+side,(s*.12,0,.13),(s*.12,-.16,.055),'shin.'+side)
    bone('toe.'+side,(s*.12,-.105,.065),(s*.12,-.18,.05),'foot.'+side)
    bone('coat.'+side,(s*.19,.035,1.07),(s*.23,.05,.80),'hips')
    bone('coat_mid.'+side,(s*.23,.05,.80),(s*.26,.06,.54),'coat.'+side)
    bone('coat_tip.'+side,(s*.26,.06,.54),(s*.27,.07,.30),'coat_mid.'+side)
    bone('hair.'+side,(s*.10,.12,1.68),(s*.19,.15,1.40),'head')
    bone('hair_mid.'+side,(s*.19,.15,1.40),(s*.27,.17,1.14),'hair.'+side)
    bone('hair_tip.'+side,(s*.27,.17,1.14),(s*.32,.17,.90),'hair_mid.'+side)
    bone('hair_end.'+side,(s*.32,.17,.90),(s*.34,.17,.68),'hair_tip.'+side)
    bone('sleeve.'+side,(s*.35,-.005,1.27),(s*.40,.015,1.04),'forearm.'+side)
    bone('sleeve_tip.'+side,(s*.40,.015,1.04),(s*.43,.035,.82),'sleeve.'+side)
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
    torso=['hips','spine','spine_upper','chest','neck','neck_upper','head']
    arm=[n+'.'+side for n in ['clavicle','upper_arm','upper_twist','forearm','forearm_twist','hand']]
    leg=[n+'.'+side for n in ['thigh','thigh_twist','shin','shin_twist','foot','toe']]
    coat=[n+'.'+side for n in ['coat','coat_mid','coat_tip']]
    hair=[n+'.'+side for n in ['hair','hair_mid','hair_tip','hair_end']]
    sleeve=[n+'.'+side for n in ['sleeve','sleeve_tip']]
    candidates=torso+arm+leg+coat+hair+sleeve
    arm_factor=smooth(.18,.34,ax)*smooth(.88,1.12,z)*(1-smooth(1.59,1.73,z))
    hair_factor=smooth(.045,.14,y)*smooth(.70,1.0,z)*(1-smooth(1.62,1.80,z))
    coat_factor=smooth(.18,.30,ax)*(1-smooth(1.00,1.16,z))
    sleeve_factor=arm_factor*(1-smooth(1.17,1.32,z))*smooth(.055,.12,distance(p,'hand.'+side))
    scores=[]
    for name in candidates:
        factor=1
        if name in torso:factor=(1-arm_factor)*(1-coat_factor)*(1-hair_factor)*smooth(.92,1.12,z)
        elif name in arm:factor=arm_factor*(1-hair_factor)*(1-sleeve_factor)
        elif name in leg:factor=(1-coat_factor)*(1-smooth(1.04,1.17,z))
        elif name in coat:factor=coat_factor*(1-hair_factor)
        elif name in sleeve:factor=sleeve_factor*(1-hair_factor)
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
    pose={'spine':(.004*sin(a),0,.003*sin(a)),'spine_upper':(.006*sin(a),0,0),'chest':(.006*sin(a),0,.003*sin(a)),'neck':(-.004*sin(a),0,0),'head':(0,.009*sin(a),0)}
    for side,s in [('R',1),('L',-1)]:
        pose['forearm.'+side]=(-.045-.018*sin(a),0,0)
        pose['hair.'+side]=(.012*sin(a+.5),0,s*.008*sin(a))
        pose['coat.'+side]=(.012*sin(a+.8),0,s*.01*sin(a))
        pose['clavicle.'+side]=(0,0,s*.006*sin(a))
        for n,lag in [('hair_mid',.8),('hair_tip',1.1),('hair_end',1.4),('coat_mid',1),('coat_tip',1.3),('sleeve',.6),('sleeve_tip',1)]:
            pose[n+'.'+side]=(.008*sin(a-lag),0,s*.006*sin(a-lag))
    idle.append((f,pose))
clip('Idle',idle)
foot_targets=[]
for f in range(1,34):
    phase=(f-1)/32;a=phase*2*pi;drop=.025+.006*cos(2*a)
    pose={'spine':(.035,0,.008*sin(a)),'spine_upper':(.025,-.022*sin(a),0),'chest':(.015,-.025*sin(a),0),'neck':(-.025,0,0),'head':(-.035,.018*sin(a),0),'@hips':(.004*sin(a),-drop,0)}
    for side,s in [('R',1),('L',-1)]:
        p=(phase+(0 if s==1 else .5))%1
        if p<.60:
            u=p/.60;y=-.14+.28*u;lift=0
        else:
            u=(p-.60)/.40;y=.14-.28*(u*u*(3-2*u));lift=.075*sin(pi*u)**2
        # Two-link leg solve: planted heel height, forward knee, level ankle.
        down=1.04-drop-(.13+lift);l1=sqrt(.47**2+.015**2);l2=sqrt(.44**2+.015**2)
        d=min(l1+l2-.0001,sqrt(y*y+down*down));theta=atan2(-y,down)
        alpha=acos(max(-1,min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))))
        beta=pi-acos(max(-1,min(1,(l1*l1+l2*l2-d*d)/(2*l1*l2))))
        thigh=-(theta+alpha-atan2(.015,.47));shin=beta-atan2(.015,.47)-atan2(.015,.44)
        pose['thigh.'+side]=(thigh,0,0);pose['shin.'+side]=(shin,0,0)
        pose['foot.'+side]=(-thigh-shin,0,0)
        pose['toe.'+side]=(-.035*sin(pi*u) if p>=.60 else 0,0,0)
        w=sin(a+(0 if s==1 else pi))
        pose['clavicle.'+side]=(.012*w,0,s*.012*w)
        pose['upper_arm.'+side]=(.19*w,.025*w,0);pose['forearm.'+side]=(-.16-.055*max(0,-w),.035*w,0)
        pose['upper_twist.'+side]=(0,-.0125*w,0);pose['forearm_twist.'+side]=(0,-.0175*w,0)
        pose['hand.'+side]=(.025*sin(a-.3),0,0)
        for n,lag,amp in [('coat',.3,.022),('coat_mid',.7,.026),('coat_tip',1.1,.03),('hair',.4,.012),('hair_mid',.8,.016),('hair_tip',1.2,.018),('hair_end',1.6,.02),('sleeve',.4,.016),('sleeve_tip',.8,.022)]:
            pose[n+'.'+side]=(amp*sin(a-lag+s),0,s*.008*sin(a-lag))
        foot_targets.append((f,side,Vector((s*.12,y,.13+lift)),p<.60))
    run.append((f,pose))
clip('Run',run)
# Same clip contract as Kai; Sera's Slash clip is a restrained casting gesture.
casting=[]
for f in range(1,38,2):
    t=(f-1)/36;wind=sin(pi*smooth(0,.45,t))*(1-smooth(.45,.7,t));release=sin(pi*smooth(.25,1,t))**2
    pose={'spine':(0,-.025*wind,0),'spine_upper':(0,-.035*wind+.025*release,0),'chest':(0,-.035*wind+.035*release,0),'neck':(0,.015*wind,0),'head':(0,.035*wind-.025*release,0),
          'clavicle.R':(-.025*release,0,-.035*release),'upper_arm.R':(-.18*wind-.36*release,.04*release,-.035*release),
          'upper_twist.R':(0,-.02*release,0),'forearm.R':(-.25*wind-.08*release,.08*release,0),'forearm_twist.R':(0,-.04*release,0),'hand.R':(.08*wind-.06*release,0,0),
          'clavicle.L':(0,0,.015*release),'upper_arm.L':(-.08*release,0,.02*release),'forearm.L':(-.08*release,0,0)}
    for side,s in [('R',1),('L',-1)]:
        for n,lag in [('hair',.04),('hair_mid',.08),('hair_tip',.12),('hair_end',.16),('coat',.03),('coat_mid',.07),('coat_tip',.11),('sleeve',.04),('sleeve_tip',.09)]:
            wave=sin(pi*smooth(.25+lag,1,t))*.012
            pose[n+'.'+side]=(wave,0,s*wave*.5)
    casting.append((f,pose))
clip('Slash',casting)
def rest():
    rig.animation_data.action=None
    for t in rig.animation_data.nla_tracks:t.mute=True
    for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
    scene.frame_set(1);bpy.context.view_layer.update()
rest()
assert len(rig.data.bones)==50
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
rest();run_action=next(t for t in rig.animation_data.nla_tracks if t.name=='Run').strips[0].action
rig.animation_data.action=run_action;rig.animation_data.action_slot=run_action.slots[0]
max_ankle_error=0;contact_heights=[]
for frame,side,target,contact in foot_targets:
    scene.frame_set(frame);bpy.context.view_layer.update()
    actual=rig.pose.bones['foot.'+side].head
    max_ankle_error=max(max_ankle_error,(actual-target).length)
    if contact:contact_heights.append(actual.z)
assert max_ankle_error<.035,max_ankle_error
assert max(contact_heights)-min(contact_heights)<.025,contact_heights
rest();bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for track in rig.animation_data.nla_tracks:track.mute=False
bpy.ops.export_scene.gltf(filepath=str(OUT/f'{PREFIX}.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
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
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{PREFIX}.blend'),compress=True)
for name in ['Idle','Run','Slash']:
    rest();action=next(t for t in rig.animation_data.nla_tracks if t.name==name).strips[0].action
    rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
    scene.frame_set({'Idle':31,'Run':9,'Slash':21}[name]);scene.render.filepath=str(OUT/f'{PREFIX}-{name.lower()}.png');bpy.ops.render.render(write_still=True)
(OUT/'rig-v2-report.json').write_text(json.dumps({'source':SOURCE.name,'source_sha256':source_hash,'bones':len(rig.data.bones),'vertices':counts[0],'faces':counts[1],'uv_preserved':True,'max_influences':4,'clips':deformation,'max_ankle_target_error':max_ankle_error,'stance_ankle_height_range':max(contact_heights)-min(contact_heights),'method':'50-bone anatomical helpers and phased limb solve; fused cloth/hair remain approximate'},indent=2),encoding='utf-8')
print('SERA_RIGGED_COMPLETE',deformation,flush=True)
