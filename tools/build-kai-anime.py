"""Original stylized Kai: shaped meshes, weighted skeleton, three animation clips.
Run: blender --background --python tools/build-kai-anime.py
No generated images, external assets, or paid services.
"""
import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi, sqrt, acos, atan2, exp

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
loft('Neck',[(1.51,.057,.054,0,.008),(1.60,.055,.053,0,.008),(1.66,.057,.053,0,.006)],skin,'head')
loft('Standing collar',[(1.51,.105,.085,0,.012),(1.55,.098,.079,0,.012),(1.61,.089,.073,0,.012)],navy,'spine')
for s in [-1,1]:
    side='R' if s==1 else 'L';x=s*.112
    def legweights(z,side=side):
        t=max(0,min(1,(z-.46)/.14));return {'thigh.'+side:t,'shin.'+side:1-t}
    loft('Anatomical trousers '+side,[(.16,.055,.055,x,.02),(.27,.063,.068,x,.02),(.40,.070,.074,x,-.004),(.49,.071,.075,x,-.025),(.56,.078,.083,x,-.014),(.68,.092,.097,x,.005),(.81,.098,.103,x,.01),(.92,.095,.102,x,.012),(.99,.079,.089,x,.009)],dark,weight=legweights)
    loft('High boot '+side,[(.11,.069,.083,x,.012),(.22,.073,.076,x,.015),(.34,.078,.08,x,.006),(.43,.08,.075,x,-.01)],navy,'shin.'+side)
    ellipsoid('Sculpted boot toe '+side,(x,-.065,.087),(.075,.145,.07),dark,'foot.'+side)
    loft('Boot sole '+side,[(.002,.060,.105,x,-.05),(.014,.075,.145,x,-.065),(.035,.074,.14,x,-.065)],dark,'foot.'+side)
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
    if side=='R':
        grip=Vector((.285,-.055,.85));axis=(Vector((.31,-.80,.25))-grip).normalized()
        n=Vector((1,0,0));n=(n-axis*n.dot(axis)).normalized();v=axis.cross(n)
        for f in range(4):
            c=grip+axis*(-.032+f*.021)
            pts=[tuple(c+n*cos(a)*r+v*sin(a)*r) for a,r in [(0,.033),(.85,.033),(1.65,.030),(2.5,.025),(3.2,.020)]]
            tube('Curled sword finger',pts,[.010,.010,.009,.008,.006],dark,'hand.R',10)
            ellipsoid('Glove knuckle',pts[1],(.011,.009,.011),navylight,'hand.R')
        tube('Opposed sword thumb',[(.272,-.018,.887),(.258,-.043,.866),(.266,-.075,.851),(.284,-.078,.848)],[.014,.012,.010,.006],dark,'hand.R')
    else:
        for f in range(4):
            xx=s*.305+(f-1.5)*.018
            tube('Relaxed glove finger',[(xx,-.046,.848),(xx,-.05,.814),(xx,-.066,.800),(xx,-.080,.813)],[.010,.010,.008,.005],dark,'hand.L')
        tube('Relaxed thumb',[(s*.265,-.04,.88),(s*.252,-.055,.85),(s*.258,-.08,.824)],[.015,.012,.007],dark,'hand.L')
    # Cloth tension folds, seams and small stitched details follow the sleeves.
    for j in range(3):
        z=1.20+j*.022
        tube('Elbow fabric fold',[(s*.26,-.067,z),(s*.302,-.078,z-.011),(s*.35,-.059,z-.02)],[.001,.003,.001],navylight,'upper_arm.'+side,6)
    for j in range(3):
        z=.60+j*.026
        tube('Trouser knee fold',[(x-.06,-.067,z),(x,-.092,z-.012),(x+.057,-.072,z-.005)],[.001,.0025,.0006],navy,'thigh.'+side,6)
    tube('Tailored side seam',[(s*.177,.015,1.10),(s*.187,.035,1.24),(s*.222,.04,1.38)],[.002]*3,navylight,'spine',6)
    for j in range(3):
        z=1.11+j*.036
        ribbon('Waist fabric tension',[(s*.14,-.075,z),(s*.11,-.097,z+.012),(s*.07,-.107,z+.017)],[.0004,.004,.0004],navylight,'spine',.002)
    for j in range(7):
        z=1.12+j*.032
        tube('Side stitch',[(s*(.176+(z-1.12)*.15),.012,z),(s*(.176+(z-1.12)*.15),.012,z+.008)],[.0013,.0013],silver,'spine',5)
    for j in range(3):
        tube('Gauntlet vent',[(s*.28,-.101,.98+j*.025),(s*.335,-.102,.98+j*.025)],[.002,.002],dark,'forearm.'+side,6)
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

# Facial surfaces share a fitted depth function, so eyes follow the cheeks.
face_rings=[(1.64,.018,.029,0,-.022),(1.665,.056,.057,0,-.008),(1.705,.084,.076,0,.005),(1.75,.109,.088,0,.010),(1.795,.113,.096,0,.014),(1.84,.109,.098,0,.017),(1.89,.104,.093,0,.022),(1.93,.085,.075,0,.024),(1.955,.045,.045,0,.025),(1.965,.005,.005,0,.025)]
def facial_y(x,z):
    for a,b in zip(face_rings,face_rings[1:]):
        if a[0]<=z<=b[0]:
            t=(z-a[0])/(b[0]-a[0]);rx=a[1]*(1-t)+b[1]*t;ry=a[2]*(1-t)+b[2]*t;cy=a[4]*(1-t)+b[4]*t
            return cy-ry*sqrt(max(.04,1-(x/rx)**2))
    return -.065
face=loft('Sculpted face',face_rings,skin,'head',48)
face.modifiers.new('Soft facial contours','SUBSURF').levels=2
def expression(o,group):
    o.vertex_groups.new(name=group).add(list(range(len(o.data.vertices))),1,'REPLACE');return o
def eye_point(x,z,depth=.002):return (x,facial_y(x,z)-depth,z)
def eye_disc(name,cx,z,rx,rz,mat,depth):
    vs=[eye_point(cx,z,depth)]
    for i in range(33):
        a=2*pi*i/32;vs.append(eye_point(cx+rx*cos(a),z+rz*sin(a),depth))
    o=mesh(name,vs,[(0,i+1,i+2) for i in range(32)],mat,'head')
    expression(o,'expr.Blink');expression(o,'expr.Gaze');return o
for s in [-1,1]:
    ellipsoid('Ear',(s*.110,.010,1.765),(.017,.019,.034),skin,'head')
    ellipsoid('Ear concha',(s*.121,-.003,1.764),(.005,.011,.019),skinshade,'head')
    tube('Ear helix',[(s*.12,-.012,1.79),(s*.128,-.015,1.778),(s*.128,-.014,1.754),(s*.12,-.01,1.744)],[.0025]*4,skin,'head')
    cx=s*.049;z=1.802
    upper=[];lower=[];vs=[]
    for i in range(17):
        t=i/16;x=cx+(t-.5)*.064;slant=s*(x-cx)*.07;h=sin(pi*t)**.7
        zu=z+.0135*h+slant;zl=z-.0095*h+slant
        upper.append(eye_point(x,zu,.003));lower.append(eye_point(x,zl,.0025))
        for j in range(5):vs.append(eye_point(x,zl+(zu-zl)*j/4,.0025))
    fs=[]
    for i in range(16):
        for j in range(4):a=i*5+j;fs.append((a,a+5,a+6,a+1))
    expression(mesh('Fitted almond sclera',vs,fs,white,'head'),'expr.Blink')
    # Sculpted lid rim plus a tapered lash line; both close with the blink key.
    expression(tube('Upper lid skin',[(x,y+.001,zz+.0025) for x,y,zz in upper],[.001+.0015*sin(pi*i/16) for i in range(17)],skin,'head',8),'expr.Blink')
    expression(expression(tube('Tapered upper lash',[(x,y-.0005,zz) for x,y,zz in upper],[.0003+.0013*sin(pi*i/16) for i in range(17)],ink,'head',6),'expr.Blink'),'expr.Lash')
    expression(tube('Lower lid',lower,[.0002+.0006*sin(pi*i/16) for i in range(17)],skinshade,'head',6),'expr.Blink')
    eye_disc('Iris limbal ring',cx,z,.013,.0118,iris,.0040)
    eye_disc('Iris cyan',cx,z-.0006,.0106,.0101,cyan,.0048)
    eye_disc('Iris lower glint',cx,z-.005,.0072,.0032,teal,.0055)
    eye_disc('Pupil',cx,z+.0007,.0042,.0075,ink,.0062)
    eye_disc('Catchlight',cx-.003,z+.005,.0023,.0022,white,.0070)
    eye_disc('Catchlight small',cx+.0038,z-.003,.0010,.0010,white,.0070)
    tube('Brow arch',[eye_point(s*x,zz,.002) for x,zz in [( .018,1.839),(.038,1.845),(.059,1.844),(.080,1.833)]],[.001,.0027,.0022,.0003],hair,'head')
    # Subtle eyelid crease and inner corner rather than a heavy painted outline.
    tube('Upper lid crease',[eye_point(cx-.022,1.826,.001),eye_point(cx,1.83,.001),eye_point(cx+.023,1.824,.001)],[.0003,.0006,.0002],skinshade,'head',6)
    ellipsoid('Inner eye corner',eye_point(cx-s*.030,1.801,.003),(.002,.0015,.0016),lip,'head')
# A rounded nose mesh with a smooth bridge and alar contours.
loft('Sculpted nose',[(1.743,.004,.003,0,-.084),(1.75,.010,.010,0,-.090),(1.759,.010,.011,0,-.093),(1.777,.007,.009,0,-.087),(1.801,.005,.005,0,-.083),(1.818,.001,.001,0,-.081)],skin,'head',16).modifiers.new('Nose smoothing','SUBSURF').levels=1
for s in [-1,1]:
    tube('Nostril',[(s*.006,-.099,1.75),(s*.010,-.096,1.751)],[.0006,.0004],skinshade,'head',6)
tube('Cupid lip',[eye_point(-.022,1.709,.001),eye_point(-.007,1.710,.0015),eye_point(0,1.7085,.0015),eye_point(.007,1.710,.0015),eye_point(.022,1.709,.001)],[.0003,.0008,.001,.0008,.0003],lip,'head',8)
tube('Lower lip volume',[eye_point(-.014,1.705,.001),eye_point(0,1.702,.002),eye_point(.014,1.705,.001)],[.0004,.0014,.0004],skin,'head',8)

# Varied swept locks: broad primary clumps with thinner offset secondary strands.
loft('Hair scalp',[(1.80,.106,.092,0,.036),(1.86,.115,.101,0,.026),(1.92,.109,.095,0,.028),(1.975,.080,.073,0,.027),(1.999,.015,.015,0,.026)],hair,'head',32)
fringes=[(-.100,-.075,1.836,.019),(-.074,-.040,1.858,.027),(-.042,-.007,1.842,.029),(-.010,.030,1.872,.025),(.026,.064,1.856,.023),(.060,.094,1.873,.020),(.087,.117,1.832,.014)]
for i,(rootx,tipx,tipz,w) in enumerate(fringes):
    pts=[(rootx*.65,.01,1.988),(rootx*.85-.012,-.052,1.983),((rootx+tipx)*.5,-.092,1.921),(tipx,-.105 if abs(tipx)<.09 else -.065,tipz)]
    ribbon('Primary swept fringe',pts,[w*.45,w,w*.72,.00025],hair,'head',.012)
    # Narrow surface glint follows each strand and tapers out before the end.
    ribbon('Hair strand sheen',[(x-.004,y-.012,z+.002) for x,y,z in pts[:-1]]+[(tipx-.002,pts[-1][1]-.003,tipz+.015)],[.001,.0025,.0017,.0001],hairlight,'head',.001)
    if i in (1,3,5):
        ribbon('Fine fringe',[(pts[0][0]-.007,0,1.98),(pts[1][0]-.012,-.066,1.95),(pts[2][0]-.008,-.101,1.90),(tipx-.01,pts[-1][1]-.008,tipz-.012)],[.003,.009,.006,.0002],hair,'head',.005)
for s in [-1,1]:
    for i in range(5):
        ribbon('Side layered lock',[(s*.07,.01+i*.022,1.975),(s*(.11+i*.002),.004+i*.018,1.93),(s*(.13-i*.004),.012+i*.020,1.835),(s*(.106-i*.005),.02+i*.018,1.748+i*.007)],[.012,.021-i*.001,.014,.0002],hair,'head',.012)
    for i in range(5):
        ribbon('Nape layered lock',[(s*(.015+i*.022),.07,1.954),(s*(.025+i*.024),.116,1.89),(s*(.03+i*.027),.126,1.797),(s*(.025+i*.025),.106,1.735+(i%2)*.016)],[.013,.022,.015,.0002],hairlight if i==2 else hair,'head',.014)
ribbon('Signature cyan hair streak',[(-.055,-.008,1.992),(-.060,-.068,1.974),(-.031,-.106,1.912),(-.012,-.112,1.87)],[.002,.004,.0028,.00015],teal,'head',.002)
for i in range(6):
    y=.006+i*.016
    ribbon('Swept crown tuft',[(-.09,y,1.94),(-.055,y-.016,1.985),(.008,y-.025,2.012+(i%2)*.003),(.075-i*.004,y-.01,1.975)],[.006,.019,.013,.0002],hair,'head',.011)

# Slim, curved energy katana held in the right hand, angled forward/down.
grip=Vector((.285,-.055,.85));tip=Vector((.31,-.80,.25));axis=(tip-grip).normalized()
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

# Paint warm cheeks, nose and eyelid shadows directly on the skin vertices.
# The glTF vertex colors are retained in both the viewer and game materials.
paint=joined.data.color_attributes.new(name='SkinPaint',type='FLOAT_COLOR',domain='CORNER')
base=skin.diffuse_color[:3]
for poly in joined.data.polygons:
    is_skin=joined.data.materials[poly.material_index]==skin
    for li in poly.loop_indices:
        v=joined.data.vertices[joined.data.loops[li].vertex_index].co
        rgb=[1.,1.,1.]
        if is_skin:
            front=max(0,min(1,(-v.y-.025)/.045))
            cheek=(exp(-((v.x-.066)/.028)**2-((v.z-1.755)/.024)**2)+exp(-((v.x+.066)/.028)**2-((v.z-1.755)/.024)**2))*front
            under_eye=exp(-((abs(v.x)-.049)/.030)**2-((v.z-1.784)/.010)**2)*front
            nose=exp(-(v.x/.018)**2-((v.z-1.755)/.020)**2)*front
            rgb=[base[0]*(1-.035*under_eye),base[1]*(1-.16*cheek-.09*nose-.075*under_eye),base[2]*(1-.11*cheek-.06*nose-.055*under_eye)]
        paint.data[li].color=(*rgb,1)
vc=skin.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='SkinPaint'
skin.node_tree.links.new(vc.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

# Facial morphs are independent of body clips, so blinking and gaze continue
# across idle/run/slash cross-fades without sharing state between characters.
joined.shape_key_add(name='Basis')
blink_group=joined.vertex_groups.get('expr.Blink');gaze_group=joined.vertex_groups.get('expr.Gaze');lash_group=joined.vertex_groups.get('expr.Lash')
def in_group(v,group):return group and any(g.group==group.index and g.weight>0 for g in v.groups)
for key_name in ['Blink','LookLeft','LookRight']:
    key=joined.shape_key_add(name=key_name)
    for v in joined.data.vertices:
        p=key.data[v.index].co
        if key_name=='Blink' and in_group(v,blink_group):
            if in_group(v,lash_group):
                s=1 if p.x>0 else -1;cx=s*.049;t=max(0,min(1,(p.x-cx+.032)/.064))
                top=1.802+.0135*sin(pi*t)**.7+s*(p.x-cx)*.07
                p.z=1.802+.0015*sin(pi*t)+(p.z-top)*.7
                p.y=facial_y(p.x,p.z)-.0045
            else:
                p.z=1.802+(p.z-1.802)*.025
                p.y=facial_y(p.x,p.z)+.002
        elif key_name.startswith('Look') and in_group(v,gaze_group):
            oldx=p.x;p.x+=-.0034 if key_name=='LookLeft' else .0034
            p.y+=facial_y(p.x,p.z)-facial_y(oldx,p.z)

sc=bpy.context.scene;sc.render.fps=30
def pose(frame,angles):
    for b in rig.pose.bones:
        e=angles.get(b.name,(0,0,0))
        # Descending limb bones have their local Y axis pointing down: invert
        # their X flexion so knees fold toward the heel and elbows toward front.
        if b.name.startswith(('upper_arm.','forearm.','hand.','thigh.','shin.','foot.','coat.')):e=(-e[0],e[1],e[2])
        b.rotation_mode='XYZ';b.rotation_euler=e;b.location=angles.get('@'+b.name,(0,0,0));b.scale=angles.get('$'+b.name,(1,1,1))
        b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('location',frame=frame);b.keyframe_insert('scale',frame=frame)
def clip(name,frames):
    rig.animation_data_create();rig.animation_data.action=None
    for f,a in frames:pose(f,a)
    a=rig.animation_data.action;a.name=name
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,1,a)
    rig.animation_data.action=None

idleframes=[]
for f in range(1,122,6):
    a=(f-1)/120*2*pi
    idleframes.append((f,{'spine':(.005*sin(a),.007*sin(a),.006*sin(a)), '$spine':(1,1+.004*(1-cos(a)),1), '@hips':(.003*sin(a),0,0), 'head':(-.004*sin(a),-.012*sin(a),0),'forearm.R':(.14+.018*sin(a),0,0),'upper_arm.L':(.035,0,-.035),'forearm.L':(.10,0,0),'coat.R':(.012*sin(a+.3),0,0),'scarf':(.012*sin(a+.7),0,.016*sin(a))}))
clip('Idle',idleframes)
runframes=[]
for f in range(1,26):
    phase=(f-1)/24;a=phase*2*pi;w=sin(a);drop=.043+.008*cos(a*2)
    angles={'@hips':(.009*sin(a),-drop,0),'hips':(0,w*.035,0),'spine':(.115,-w*.06,w*.025),'head':(-.08,w*.025,-w*.012),'scarf':(.18,0,sin(a-.4)*.07)}
    for s in [-1,1]:
        side='R' if s==1 else 'L';p=(phase+(0 if s==1 else .5))%1
        if p<.58:
            u=p/.58;y=-.235+.47*u;lift=0
        else:
            u=(p-.58)/.42;y=.235-.47*(u*u*(3-2*u));lift=.15*sin(pi*u)
        down=.97-drop-(.14+lift);l1=sqrt(.46**2+.025**2);l2=sqrt(.37**2+.04**2)
        d=min(l1+l2-.002,sqrt(y*y+down*down));theta=atan2(-y,down)
        alpha=acos(max(-1,min(1,(l1*l1+d*d-l2*l2)/(2*l1*d))))
        beta=pi-acos(max(-1,min(1,(l1*l1+l2*l2-d*d)/(2*l1*l2))))
        thigh=theta+alpha-atan2(.025,.46);shin=-beta+atan2(.025,.46)+atan2(.04,.37)
        angles['thigh.'+side]=(thigh,0,0);angles['shin.'+side]=(shin,0,0)
        heel=.12*max(0,(p-.42)/.16) if p<.58 else -.12*sin(pi*u)
        angles['foot.'+side]=(-thigh-shin+heel,0,0)
        swing=sin(a+(0 if s==1 else pi))
        angles['upper_arm.'+side]=(-swing*.30,0,s*.035)
        angles['forearm.'+side]=(.28+max(0,swing)*.24,0,0)
        angles['coat.'+side]=(.12+.10*sin(a-.6+s),0,s*.035)
    runframes.append((f,angles))
clip('Run',runframes)
clip('Slash',[(1,{'forearm.R':(.14,0,0)}),(5,{'@hips':(-.018,-.025,-.018),'hips':(0,-.12,0),'spine':(-.035,-.36,-.025),'head':(0,.17,0),'upper_arm.R':(1.25,-.15,-.6),'forearm.R':(.85,0,0),'upper_arm.L':(.16,0,.18),'forearm.L':(.25,0,0),'coat.R':(.05,0,-.09)}),(8,{'@hips':(.014,-.035,.035),'hips':(0,.20,0),'spine':(.13,.52,.035),'head':(-.04,-.19,0),'upper_arm.R':(.95,.25,.7),'forearm.R':(.20,0,0),'upper_arm.L':(-.2,0,.25),'forearm.L':(.28,0,0),'scarf':(.18,0,-.24),'coat.L':(.16,0,.10)}),(12,{'@hips':(.009,-.018,.023),'spine':(.05,.18,.015),'upper_arm.R':(.32,.10,.35),'forearm.R':(.28,0,0),'coat.R':(.11,0,.10),'scarf':(.10,0,.12)}),(20,{'forearm.R':(.14,0,0),'forearm.L':(.1,0,0)})])
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
sc.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
for o in hero:o.select_set(True)
# Export NLA clips without an active action. All tracks must be unmuted for the exporter.
for t in rig.animation_data.nla_tracks:t.mute=False
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'kai-anime.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_morph_normal=False)
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
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
