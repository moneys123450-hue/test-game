"""Run with Blender --background --python tools/build-kai.py. No paid services."""
import bpy, math, os
from mathutils import Vector

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'art', 'kai-blender'))
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def mat(name, color, metal=0, emit=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=.38
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emit
    return m
navy=mat('Midnight armor',(.035,.055,.105),.55)
steel=mat('Edge plates',(.16,.22,.30),.7)
black=mat('Hair and undersuit',(.012,.018,.03))
cyan=mat('Cyan energy',(.025,.7,1),.3,3)
skin=mat('Skin',(.72,.44,.30))
white=mat('Eyes',(.8,.9,1),0,.3)
hero=[]
def box(name, loc, size, material, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.name=name
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        mod=o.modifiers.new('Crafted edges','BEVEL'); mod.width=bevel; mod.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    hero.append(o); return o
def orb(name,loc,size,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc)
    o=bpy.context.object; o.name=name; o.scale=size; o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    hero.append(o); return o
def spike(name,start,end,r,material):
    d=Vector(end)-Vector(start)
    bpy.ops.mesh.primitive_cone_add(vertices=5,radius1=r,radius2=0,depth=d.length,location=(Vector(start)+Vector(end))/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(material);hero.append(o)

# Blender coordinates: forward -Y, up Z. Named pieces remain individually editable.
box('Pelvis',(0,0,1.0),(.39,.26,.22),black)
box('Armored jacket',(0,0,1.36),(.52,.30,.57),navy,.07)
for s in [-1,1]:
    x=s*.14
    orb('Hip joint',(x,0,.96),(.11,.11,.11),black)
    box('Thigh',(x,0,.75),(.20,.23,.40),navy,.045)
    orb('Knee',(x,-.015,.53),(.105,.105,.10),black)
    box('Knee plate',(x,-.115,.54),(.17,.075,.17),steel)
    box('Shin',(x,.01,.32),(.18,.22,.36),navy,.035)
    box('Boot',(x,-.065,.105),(.22,.38,.18),black,.04)
    box('Shin light',(x,-.108,.32),(.025,.015,.24),cyan,.005)
    box('Chest plate',(s*.135,-.17,1.47),(.22,.075,.25),steel,.035)
    stripe=box('Chest circuit',(s*.13,-.214,1.43),(.025,.014,.27),cyan,.005);stripe.rotation_euler.y=s*.25
    box('Shoulder',(s*.35,0,1.56),(.25,.35,.22),steel,.05)
    box('Shoulder light',(s*.35,-.18,1.56),(.18,.015,.035),cyan,.005)
    box('Upper arm',(s*.37,0,1.32),(.17,.20,.30),navy,.04)
    orb('Elbow',(s*.38,-.015,1.15),(.09,.09,.09),black)
    box('Forearm gauntlet',(s*.39,-.05,1.02),(.20,.24,.27),steel,.04)
    box('Glove',(s*.39,-.075,.84),(.14,.17,.14),black)
    box('Coat tail',(s*.22,.13,.94),(.19,.09,.40),navy,.02)
box('Belt',(0,-.01,1.08),(.46,.32,.09),black)
box('Belt reactor',(0,-.18,1.08),(.12,.04,.06),cyan,.01)
orb('Neck',(0,0,1.69),(.08,.08,.10),skin)
orb('Head',(0,-.015,1.88),(.17,.145,.215),skin)
orb('Hair cap',(0,.025,2.00),(.18,.15,.13),black)
for i in range(11):
    a=i*2.399; x=math.cos(a)*.12;y=math.sin(a)*.10
    spike('Hair lock',(x,y,2.025),(x*.9+.045,y+.04,2.18+(i%3)*.035),.065,cyan if i==3 else black)
for s in [-1,1]:
    box('Eye',(s*.068,-.151,1.91),(.062,.018,.025),white,.008)
    box('Iris',(s*.066,-.163,1.91),(.021,.008,.024),cyan,.003)
    brow=box('Brow',(s*.066,-.15,1.95),(.075,.025,.018),black,.003);brow.rotation_euler.y=s*.16
spike('Nose',(0,-.13,1.88),(0,-.19,1.865),.025,skin)
box('Mouth',(0,-.15,1.80),(.055,.008,.009),black,.002)
box('High collar',(0,.09,1.69),(.40,.16,.15),navy,.03)
# Sword held downwards, visible from the front and shoulder camera.
box('Katana grip',(.39,-.08,.71),(.075,.08,.25),black,.012)
box('Katana guard',(.39,-.08,.59),(.30,.13,.045),steel,.012)
box('Blade spine',(.39,-.08,.13),(.075,.055,.88),steel,.008)
box('Energy edge',(.44,-.08,.13),(.035,.06,.88),cyan,.006)
spike('Blade tip',(.415,-.08,-.31),(.415,-.08,-.44),.05,cyan)
# Lift sword arm slightly for clearance.
for o in hero:
    if o.name.startswith(('Katana','Blade','Energy edge')):o.location.z+=.50

bpy.ops.object.select_all(action='DESELECT')
for o in hero:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'kai-prototype.glb'),export_format='GLB',use_selection=True)

floor=mat('Stage',(.018,.027,.045),.3)
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.05,depth=.08,location=(0,0,-.045));bpy.context.object.data.materials.append(floor)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.09));bpy.context.object.data.materials.append(floor)
def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
for name,loc,power,color,size in [('Key',(3,-4,5),650,(.65,.82,1),4),('Rim',(-3,2,4),900,(.05,.65,1),3),('Fill',(-3,-2,2),220,(1,.7,.48),3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
bpy.ops.object.camera_add(location=(3,-5,2.9));cam=bpy.context.object;aim(cam,(0,0,1.1));cam.data.type='ORTHO';cam.data.ortho_scale=3.05
sc=bpy.context.scene;sc.camera=cam;sc.render.engine='CYCLES';sc.cycles.samples=32
sc.render.resolution_x=1000;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
sc.world.color=(.08,.08,.08);sc.render.image_settings.file_format='PNG'
sc.render.filepath=os.path.join(OUT,'kai-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'kai-prototype.blend'))
bpy.ops.render.render(write_still=True)
cam.location=(3,5,2.9);aim(cam,(0,0,1.1));sc.render.filepath=os.path.join(OUT,'kai-back.png');bpy.ops.render.render(write_still=True)
print('KAI_OUTPUT', OUT)
