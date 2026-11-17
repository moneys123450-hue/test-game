"""Original stylized Kai: shaped meshes, weighted skeleton, three animation clips.
Run: blender --background --python tools/build-kai-anime.py
No generated images, external assets, or paid services.
"""
import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi

OUT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','art','kai-blender'))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
hero=[]

def material(name,h,metal=0,emission=0):
    rgb=tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
    # Input colors are sRGB; Blender shader values are linear.
    rgb=tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in rgb)
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Roughness'].default_value=.73;p.inputs['Metallic'].default_value=metal
    p.inputs['Emission Color'].default_value=(*rgb,1);p.inputs['Emission Strength'].default_value=emission
    return m
skin=material('Skin warm porcelain','EDB99E')
skinshade=material('Face warm shadow','CF8F7C')
navy=material('Coat midnight blue','26364D')
navylight=material('Coat panel blue','3A5069')
dark=material('Undersuit charcoal','141F30')
hair=material('Hair blue black','172335')
hairlight=material('Hair blue sheen','30465D')
silver=material('Silver trim','A6BBCB',.25)
ivory=material('Ivory cloth','D8E1E6')
teal=material('Coat teal lining','137B87')
cyan=material('Cyan energy','35DFFF',0,.65)
iris=material('Iris deep teal','126680')
white=material('Eye whites','F2ECE6')
ink=material('Ink lashes','10192A')
lip=material('Lip muted rose','AC716F')
gold=material('Buckle pale gold','C3A675',.25)

def mesh(name,verts,faces,mat,bone=None,weights=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    for p in data.polygons:p.use_smooth=True
    if bone:o.vertex_groups.new(name=bone).add(list(range(len(verts))),1,'REPLACE')
    if weights:
        groups={}
        for i,ws in enumerate(weights):
            for b,w in ws.items():
                if w>0:
                    if b not in groups:groups[b]=o.vertex_groups.new(name=b)
                    groups[b].add([i],w,'REPLACE')
    hero.append(o);return o

def loft(name,rings,mat,bone=None,segments=24,weight=None):
    # rings: z, half-width X, half-depth Y, center X, center Y
    vs=[];ws=[]
    for z,rx,ry,x,y in rings:
        for j in range(segments):
            a=2*pi*j/segments;vs.append((x+rx*cos(a),y+ry*sin(a),z))
            if weight:ws.append(weight(z))
    fs=[]
    for k in range(len(rings)-1):
        for j in range(segments):
            a=k*segments+j;b=k*segments+(j+1)%segments;fs.append((a,b,b+segments,a+segments))
    fs.append(tuple(reversed(range(segments))));fs.append(tuple((len(rings)-1)*segments+j for j in range(segments)))
    return mesh(name,vs,fs,mat,bone,ws if weight else None)

def ellipsoid(name,loc,scale,mat,bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE');hero.append(o);return o

def tube(name,points,radii,mat,bone,segments=8):
    vs=[]
    for i,p in enumerate(points):
        p=Vector(p);t=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        if t.length<1e-6:t=Vector((0,0,1))
        t.normalize();n=t.cross(Vector((0,1,0)))
        if n.length<.01:n=t.cross(Vector((1,0,0)))
        n.normalize();b=t.cross(n).normalized()
        for j in range(segments):vs.append(tuple(p+radii[i]*(cos(2*pi*j/segments)*n+sin(2*pi*j/segments)*b)))
    fs=[]
    for i in range(len(points)-1):
        for j in range(segments):a=i*segments+j;k=i*segments+(j+1)%segments;fs.append((a,k,k+segments,a+segments))
    fs.extend([tuple(reversed(range(segments))),tuple((len(points)-1)*segments+j for j in range(segments))])
    return mesh(name,vs,fs,mat,bone)

def panel(name,outline,mat,bone,thickness=.008):
    # A curved outlined panel, with a shallow bevel rather than a box primitive.
    o=mesh(name,outline,[tuple(range(len(outline)))],mat,bone)
    m=o.modifiers.new('Panel thickness','SOLIDIFY');m.thickness=thickness
    m=o.modifiers.new('Soft tailored edge','BEVEL');m.width=.006;m.segments=2
    return o

def ribbon(name,points,widths,mat,bone,depth=.014):
    # Volumetric tapered locks / fabric folds along a curved centerline.
    vs=[]
    for i,p in enumerate(points):
        for j in range(8):
            a=j*2*pi/8;vs.append((p[0]+widths[i]*cos(a),p[1]+depth*sin(a)*min(1,widths[i]/.02),p[2]))
    fs=[]
    for i in range(len(points)-1):
        for j in range(8):a=i*8+j;b=i*8+(j+1)%8;fs.append((a,b,b+8,a+8))
    fs.extend([tuple(reversed(range(8))),tuple((len(points)-1)*8+j for j in range(8))])
    o=mesh(name,vs,fs,mat,bone)
    mod=o.modifiers.new('Flowing surfaces','SUBSURF');mod.levels=1
    return o

# Tailored torso: a narrow waist, rib cage, sloping shoulders, collar opening.
loft('Fitted undersuit',[(.94,.16,.105,0,0),(1.04,.145,.095,0,0),(1.15,.145,.09,0,0),(1.30,.20,.115,0,0),(1.43,.235,.12,0,0),(1.49,.215,.10,0,0),(1.54,.11,.075,0,0)],dark,'spine')
loft('Sculpted jacket',[(1.02,.174,.12,0,.006),(1.10,.153,.104,0,.006),(1.22,.165,.106,0,.006),(1.36,.215,.129,0,.006),(1.44,.245,.13,0,.006),(1.49,.225,.105,0,.006),(1.53,.115,.078,0,.006)],navy,'spine')
loft('Pelvis fabric',[(.91,.16,.105,0,.015),(.96,.18,.12,0,.015),(1.04,.16,.11,0,.015)],dark,'hips')
loft('Neck',[(1.51,.062,.058,0,.008),(1.60,.065,.06,0,.008),(1.66,.07,.06,0,.006)],skin,'head')
loft('Standing collar',[(1.51,.105,.085,0,.012),(1.55,.098,.079,0,.012),(1.61,.089,.073,0,.012)],navy,'spine')
for s in [-1,1]:
    side='R' if s==1 else 'L';x=s*.112
    def legweights(z,side=side):
        t=max(0,min(1,(z-.46)/.14));return {'thigh.'+side:t,'shin.'+side:1-t}
    loft('Anatomical trousers '+side,[(.16,.055,.055,x,.02),(.27,.063,.068,x,.02),(.40,.070,.074,x,-.004),(.49,.071,.075,x,-.025),(.56,.078,.083,x,-.014),(.68,.092,.097,x,.005),(.81,.098,.103,x,.01),(.92,.095,.102,x,.012),(.99,.079,.089,x,.009)],dark,weight=legweights)
    loft('High boot '+side,[(.11,.069,.083,x,.012),(.22,.073,.076,x,.015),(.34,.078,.08,x,.006),(.43,.08,.075,x,-.01)],navy,'shin.'+side)
    ellipsoid('Sculpted boot toe '+side,(x,-.065,.087),(.075,.145,.07),dark,'foot.'+side)
    tube('Boot piping '+side,[(x+s*.045,-.057,.18),(x+s*.05,-.065,.30),(x+s*.054,-.068,.405)],[.008,.007,.006],silver,'shin.'+side)
    panel('Knee shield '+side,[(x-.055,-.087,.54),(x+.055,-.087,.54),(x+.058,-.107,.49),(x,-.12,.435),(x-.058,-.107,.49)],navylight,'shin.'+side)
    panel('Coat front lapel '+side,[(s*.035,-.12,1.54),(s*.19,-.13,1.45),(s*.15,-.14,1.32),(s*.035,-.12,1.23),(s*.071,-.14,1.43)],navylight,'spine')
    tube('Lapel ivory seam '+side,[(s*.055,-.131,1.54),(s*.19,-.143,1.45),(s*.15,-.151,1.32),(s*.035,-.132,1.23)],[.005]*4,ivory,'spine')
    tube('Energy chest seam '+side,[(s*.105,-.14,1.37),(s*.082,-.13,1.29),(s*.055,-.115,1.12)],[.008,.007,.005],cyan,'spine')
    # Arms are relaxed, with two-bone deformation at each elbow.
    def armweights(z,side=side):
        t=max(0,min(1,(z-1.14)/.12));return {'upper_arm.'+side:t,'forearm.'+side:1-t}
    loft('Sleeve '+side,[(.89,.046,.055,s*.305,-.04),(.99,.060,.062,s*.31,-.025),(1.11,.061,.065,s*.315,-.007),(1.20,.064,.067,s*.308,0),(1.32,.074,.078,s*.29,.004),(1.43,.082,.087,s*.262,.004),(1.47,.07,.075,s*.245,0)],navy,weight=armweights)
    ellipsoid('Shoulder sculpt '+side,(s*.257,0,1.43),(.104,.113,.087),navylight,'upper_arm.'+side)
    tube('Shoulder silver edge '+side,[(s*.18,-.075,1.49),(s*.25,-.108,1.48),(s*.325,-.081,1.43)],[.007]*3,silver,'upper_arm.'+side)
    loft('Bracer '+side,[(.91,.054,.063,s*.305,-.04),(.97,.067,.075,s*.31,-.025),(1.08,.07,.078,s*.315,-.015),(1.115,.059,.066,s*.315,-.01)],navylight,'forearm.'+side)
    tube('Bracer light '+side,[(s*.31,-.10,.94),(s*.315,-.10,1.075)],[.01,.007],cyan,'forearm.'+side)
    ellipsoid('Gloved palm '+side,(s*.305,-.04,.858),(.047,.036,.065),dark,'hand.'+side)
    for f in range(4):
        xx=s*.305+(f-1.5)*.019
        tube('Glove finger '+side,[(xx,-.046,.848),(xx,-.048,.805),(xx,-.064,.795)],[.012,.010,.006],dark,'hand.'+side)
    tube('Thumb '+side,[(s*.265,-.04,.88),(s*.252,-.055,.85),(s*.258,-.08,.824)],[.017,.013,.009],dark,'hand.'+side)
    # Split coat skirts with curvature, contrasting lining and a pointed hem.
    pts=[(s*.105,.12,1.12),(s*.19,.12,.99),(s*.25,.155,.83),(s*.28,.19,.65)]
    ribbon('Long split coat '+side,pts,[.055,.075,.085,.015],navy,'coat.'+side,.026)
    ribbon('Teal coat facing '+side,[(x,y+.026,z) for x,y,z in pts],[.045,.062,.067,.006],teal,'coat.'+side,.004)
    tube('Coat hem stitch '+side,[(s*.16,.145,1.08),(s*.24,.17,.94),(s*.32,.195,.78),(s*.28,.20,.65)],[.004]*4,silver,'coat.'+side)

loft('Belt leather',[(1.045,.176,.123,0,.005),(1.085,.169,.118,0,.005)],dark,'hips')
panel('Diamond clasp',[(-.03,-.125,1.08),(0,-.135,1.11),(.03,-.125,1.08),(0,-.139,1.05)],gold,'hips')
panel('Diamond reactor',[(-.014,-.142,1.08),(0,-.145,1.096),(.014,-.142,1.08),(0,-.145,1.064)],cyan,'hips')
# Asymmetric ivory scarf and its two trailing ends.
loft('Ivory neck scarf',[(1.53,.096,.086,0,.003),(1.56,.105,.09,0,.003),(1.585,.091,.077,0,.003)],ivory,'spine')
ribbon('Scarf trailing fold',[(.08,.08,1.56),(.20,.20,1.52),(.30,.31,1.43),(.38,.34,1.33)],[.038,.045,.042,.003],ivory,'scarf',.015)
ribbon('Scarf teal underside',[(.08,.085,1.55),(.17,.23,1.49),(.23,.30,1.35)],[.025,.026,.002],teal,'scarf',.008)

# Sculpted head: chin, jaw, cheeks, temples and crown instead of a sphere.
face=loft('Sculpted face',[(1.635,.016,.025,0,-.034),(1.66,.055,.053,0,-.015),(1.70,.083,.073,0,.001),(1.74,.106,.086,0,.008),(1.79,.112,.093,0,.012),(1.84,.108,.095,0,.014),(1.89,.104,.091,0,.018),(1.93,.085,.075,0,.022),(1.955,.045,.045,0,.023),(1.965,.005,.005,0,.023)],skin,'head',32)
face.modifiers.new('Soft facial contours','SUBSURF').levels=1
for s in [-1,1]:
    ellipsoid('Ear',(s*.109,.009,1.765),(.022,.022,.040),skin,'head')
    ellipsoid('Ear inset',(s*.121,-.004,1.764),(.007,.013,.023),skinshade,'head')
    # Almond eyes sit on the facial plane, with sculpted upper lids.
    cx=s*.049;z=1.802
    outline=[(cx-.036,-.078,z+.001),(cx-.019,-.088,z+.017),(cx+.017,-.088,z+.015),(cx+.036,-.076,z+.002),(cx+.016,-.090,z-.014),(cx-.017,-.09,z-.013)]
    panel('Almond eye',outline,white,'head',.001)
    ellipsoid('Iris dark ring',(cx,-.094,z),(.014,.003,.014),iris,'head')
    ellipsoid('Cyan iris',(cx,-.098,z-.001),(.010,.002,.011),cyan,'head')
    ellipsoid('Pupil',(cx,-.101,z+.001),(.0045,.0015,.008),ink,'head')
    ellipsoid('Eye catchlight',(cx-.004,-.103,z+.006),(.003,.0015,.003),white,'head')
    tube('Upper eyelid',[(cx-.037,-.08,z+.002),(cx-.020,-.094,z+.019),(cx+.015,-.094,z+.018),(cx+.038,-.08,z+.003)],[.0015,.0027,.0027,.001],ink,'head')
    tube('Lower eyelid',[(cx-.027,-.087,z-.009),(cx,-.096,z-.016),(cx+.027,-.087,z-.007)],[.001,.0015,.001],skinshade,'head')
    tube('Expressive eyebrow',[(s*.016,-.09,1.846),(s*.047,-.092,1.851),(s*.082,-.075,1.839)],[.004,.005,.001],hair,'head')
# Integrated nose bridge and small nostril shadows.
mesh('Nose planes',[(-.009,-.078,1.816),(.009,-.078,1.816),(-.012,-.092,1.751),(0,-.108,1.757),(.012,-.092,1.751),(0,-.091,1.744)],[(0,2,3),(0,3,1),(1,3,4),(2,5,3),(3,5,4)],skin,'head')
tube('Mouth contour',[(-.025,-.074,1.706),(0,-.083,1.704),(.025,-.074,1.706)],[.0008,.0018,.0008],lip,'head')
tube('Lower lip light',[(-.013,-.078,1.697),(0,-.081,1.695),(.013,-.078,1.697)],[.0008,.0013,.0008],skinshade,'head')
# Shaped scalp, then overlapping swept locks with curved, flattened surfaces.
loft('Hair scalp',[(1.80,.106,.092,0,.036),(1.86,.115,.101,0,.026),(1.92,.109,.095,0,.028),(1.975,.080,.073,0,.027),(1.999,.015,.015,0,.026)],hair,'head',32)
for i in range(9):
    x=-.105+i*.026
    ribbon('Swept fringe %02d'%i,[(x*.6,.015,1.989),(x*.85,-.045,1.978),(x+.025,-.082,1.91),(x+.035,-.099,1.835+(i%3)*.016)],[.013,.026,.023,.001],hairlight if i in (2,6) else hair,'head',.017)
for s in [-1,1]:
    for i in range(4):
        ribbon('Side swept lock',[(s*.07,.01+i*.025,1.98),(s*.115,.005+i*.022,1.93),(s*.133,.006+i*.024,1.84),(s*.11,.015+i*.022,1.77-i*.006)],[.018,.027,.021,.001],hair,'head',.018)
    for i in range(4):
        ribbon('Back layered lock',[(s*(.02+i*.025),.07,1.96),(s*(.03+i*.027),.12,1.90),(s*(.04+i*.03),.125,1.80),(s*(.05+i*.026),.10,1.73)],[.018,.027,.022,.001],hairlight if i==2 else hair,'head',.02)
ribbon('Signature cyan hair streak',[(-.055,-.005,1.992),(-.055,-.052,1.973),(-.028,-.092,1.912),(-.009,-.109,1.865)],[.004,.007,.005,.0005],teal,'head',.004)
for i in range(5):
    y=.015+i*.018
    ribbon('Swept crown tuft',[(-.09,y,1.94),(-.06,y-.016,1.996),(.005,y-.025,2.037),(.09,y-.01,2.008)],[.008,.022,.019,.0005],hairlight if i==1 else hair,'head',.016)

# Slim, curved energy katana held in the right hand, angled forward/down.
grip=Vector((.307,-.055,.85));tip=Vector((.35,-.80,.25));axis=(tip-grip).normalized()
tube('Katana wrapped grip',[tuple(grip-axis*.09),tuple(grip),tuple(grip+axis*.09)],[.021]*3,dark,'hand.R',12)
for i in range(7):
    c=grip+axis*(-.075+i*.025)
    tube('Grip wrap',[(c.x-.022,c.y,c.z),(c.x+.022,c.y+.006,c.z+.007)],[.003,.003],silver,'hand.R',6)
g=grip+axis*.1
ellipsoid('Katana oval guard',g,(.065,.032,.024),gold,'hand.R')
points=[tuple(g),tuple(g+axis*.20),tuple(g+axis*.43+Vector((.005,0,.015))),tuple(tip)]
ribbon('Katana blade',points,[.026,.025,.019,.0005],silver,'hand.R',.007)
tube('Katana energy edge',[(p[0]+.024*(1-i/4),p[1]-.006,p[2]) for i,p in enumerate(points)],[.006,.006,.004,.0005],cyan,'hand.R',6)

# Weighted armature. Every mesh uses an Armature modifier, including rigid accessories.
bpy.ops.object.armature_add(enter_editmode=True);rig=bpy.context.object;rig.name='Kai_Rig'
eb=rig.data.edit_bones;eb.remove(eb[0])
def bone(name,head,tail,parent=None):
    b=eb.new(name);b.head=head;b.tail=tail
    if parent:b.parent=eb[parent]
bone('root',(0,0,0),(0,0,.2))
bone('hips',(0,0,.94),(0,0,1.09),'root')
bone('spine',(0,0,1.09),(0,0,1.53),'hips')
bone('head',(0,0,1.53),(0,0,1.91),'spine')
for s in [-1,1]:
    side='R' if s==1 else 'L'
    bone('upper_arm.'+side,(s*.245,0,1.45),(s*.315,-.005,1.18),'spine')
    bone('forearm.'+side,(s*.315,-.005,1.18),(s*.305,-.04,.91),'upper_arm.'+side)
    bone('hand.'+side,(s*.305,-.04,.91),(s*.305,-.055,.80),'forearm.'+side)
    bone('thigh.'+side,(s*.112,0,.97),(s*.112,-.025,.51),'hips')
    bone('shin.'+side,(s*.112,-.025,.51),(s*.112,.015,.14),'thigh.'+side)
    bone('foot.'+side,(s*.112,.015,.14),(s*.112,-.15,.08),'shin.'+side)
    bone('coat.'+side,(s*.14,.12,1.10),(s*.27,.18,.67),'hips')
bone('scarf',(.08,.08,1.56),(.32,.28,1.38),'spine')
bpy.ops.object.mode_set(mode='OBJECT')
for o in hero:
    mod=o.modifiers.new('Kai skin weights','ARMATURE');mod.object=rig;o.parent=rig

# Bake surface shaping and join into one skinned mesh: material batches instead of
# hundreds of separate draw calls per character in the browser.
for o in hero:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):
        if mod.type!='ARMATURE':bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.object.select_all(action='DESELECT')
for o in hero:o.select_set(True)
bpy.context.view_layer.objects.active=hero[0];bpy.ops.object.join()
joined=bpy.context.object;joined.name='Kai_SkinnedCharacter';hero=[joined]

sc=bpy.context.scene;sc.render.fps=30
def pose(frame,angles):
    for b in rig.pose.bones:
        e=angles.get(b.name,(0,0,0))
        # Descending limb bones have their local Y axis pointing down: invert
        # their X flexion so knees fold toward the heel and elbows toward front.
        if b.name.startswith(('upper_arm.','forearm.','hand.','thigh.','shin.','foot.','coat.')):e=(-e[0],e[1],e[2])
        b.rotation_mode='XYZ';b.rotation_euler=e;b.location=(0,0,0)
        b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('location',frame=frame)
def clip(name,frames):
    rig.animation_data_create();rig.animation_data.action=None
    for f,a in frames:pose(f,a)
    a=rig.animation_data.action;a.name=name
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,a)
    rig.animation_data.action=None

clip('Idle',[(1,{'forearm.R':(.16,0,0),'upper_arm.L':(.02,0,-.05)}),(31,{'spine':(.012,0,.012),'head':(-.015,0,-.015),'forearm.R':(.21,0,0),'coat.R':(.025,0,0),'scarf':(.035,0,.04)}),(61,{'forearm.R':(.16,0,0),'upper_arm.L':(.02,0,-.05)})])
runframes=[]
for f in range(1,26,3):
    a=(f-1)/24*2*pi;w=sin(a);angles={'spine':(.12,0,w*.045),'head':(-.08,0,-w*.025),'scarf':(.25,0,cos(a)*.12)}
    for s in [-1,1]:
        side='R' if s==1 else 'L';v=w*s
        angles['thigh.'+side]=(v*.65,0,0);angles['shin.'+side]=(-max(0,-v)*1.1-.13,0,0)
        angles['foot.'+side]=(max(0,-v)*.3,0,0)
        angles['upper_arm.'+side]=(-v*.45,0,s*.06);angles['forearm.'+side]=(.35+max(0,v)*.35,0,0)
        angles['coat.'+side]=(.18+max(0,-v)*.22,0,s*.08)
    runframes.append((f,angles))
clip('Run',runframes)
clip('Slash',[(1,{'forearm.R':(.2,0,0)}),(6,{'spine':(.05,0,-.5),'upper_arm.R':(1.5,-.3,-.9),'forearm.R':(.9,0,0),'upper_arm.L':(.2,0,.3),'coat.R':(.15,0,-.12)}),(10,{'spine':(.15,0,.65),'upper_arm.R':(.6,.5,1.05),'forearm.R':(.20,0,0),'upper_arm.L':(-.4,0,.4),'scarf':(.3,0,-.4)}),(19,{'forearm.R':(.2,0,0)})])
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0)
sc.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in hero:o.select_set(True)
# Export NLA clips without an active action. All tracks must be unmuted for the exporter.
for t in rig.animation_data.nla_tracks:t.mute=False
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'kai-anime.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0)
rig.pose.bones['forearm.R'].rotation_euler.x=-.12

# Studio presentation; game uses its own toon material and lighting.
stage=material('Stage','172334')
bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.76,depth=.035,location=(0,0,-.023));bpy.context.object.data.materials.append(stage)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.043));bpy.context.object.data.materials.append(stage)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,color,size in [('Key',(2,-4,4),450,(1,.88,.79),4),('Fill',(-3,-2,3),320,(.65,.83,1),4),('Rim',(1,3,3),600,(.25,.85,1),3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1.1))
bpy.ops.object.camera_add(location=(2.7,-5.5,2.5));cam=bpy.context.object;aim(cam,(0,0,1.04));cam.data.type='ORTHO';cam.data.ortho_scale=2.55
sc.camera=cam;sc.render.engine='CYCLES';sc.cycles.samples=40;sc.cycles.use_denoising=True
sc.render.resolution_x=1000;sc.render.resolution_y=1100;sc.render.resolution_percentage=100
sc.world.color=(.17,.17,.17);sc.view_settings.view_transform='Standard';sc.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.name for i in sc.view_settings.bl_rna.properties['look'].enum_items] else 'None'
sc.render.image_settings.file_format='PNG';sc.render.filepath=os.path.join(OUT,'kai-anime-front.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'kai-anime.blend'))
bpy.ops.render.render(write_still=True)
cam.location=(2.7,5.5,2.4);aim(cam,(0,0,1.05));sc.render.filepath=os.path.join(OUT,'kai-anime-back.png');bpy.ops.render.render(write_still=True)
cam.location=(.7,-3,1.92);aim(cam,(0,-.01,1.79));cam.data.ortho_scale=.62
sc.render.resolution_x=1000;sc.render.resolution_y=1000;sc.render.filepath=os.path.join(OUT,'kai-anime-face.png');bpy.ops.render.render(write_still=True)
print('KAI_ANIME_COMPLETE',OUT)
