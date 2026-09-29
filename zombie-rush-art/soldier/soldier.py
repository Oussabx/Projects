import sys, os
exec(open('/tmp/claude-0/-home-user-Projects/e974cc7e-d40a-5925-8089-645ccb09b17f/scratchpad/rcommon.py').read())
from mathutils import Matrix, Quaternion
OUT='/tmp/claude-0/-home-user-Projects/e974cc7e-d40a-5925-8089-645ccb09b17f/scratchpad/sold/'
os.makedirs(OUT, exist_ok=True)
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
JOB=argv[0] if argv else 'test'
arm.animation_data_clear(); arm.data.pose_position='POSE'
for pb in arm.pose.bones:
    for c in pb.constraints:
        if c.type=='ACTION' and 'Twist' in c.subtarget: c.mute=True
vl=bpy.context.view_layer

# ---------- realistic materials (procedural fabric/metal detail) ----------
def mat(name, col, metal=0.0, rough=0.7, bump=0.25, scale=180, vary=0.12, emis=None, spots=None):
    m=bpy.data.materials[name]; nt=m.node_tree
    for n in list(nt.nodes):
        if n.type!='OUTPUT_MATERIAL': nt.nodes.remove(n)
    out=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'][0]
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs[0], out.inputs[0])
    tc=nt.nodes.new('ShaderNodeTexCoord')
    nz=nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value=scale; nz.inputs['Detail'].default_value=6
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    big=nt.nodes.new('ShaderNodeTexNoise'); big.inputs['Scale'].default_value=6; big.inputs['Detail'].default_value=3
    nt.links.new(tc.outputs['Object'], big.inputs['Vector'])
    ramp=nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(*[c*(1-vary) for c in col],1); ramp.color_ramp.elements[1].color=(*[min(1,c*(1+vary)) for c in col],1)
    nt.links.new(big.outputs['Fac'], ramp.inputs[0])
    b.inputs['Base Color'].default_value=(*col,1)
    nt.links.new(ramp.outputs[0], b.inputs['Base Color'])
    b.inputs['Metallic'].default_value=metal
    rm=nt.nodes.new('ShaderNodeMapRange'); rm.inputs['To Min'].default_value=rough-0.12; rm.inputs['To Max'].default_value=rough+0.12
    nt.links.new(nz.outputs['Fac'], rm.inputs['Value']); nt.links.new(rm.outputs[0], b.inputs['Roughness'])
    bp=nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=bump; bp.inputs['Distance'].default_value=0.002
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height']); nt.links.new(bp.outputs[0], b.inputs['Normal'])
    if emis:
        b.inputs['Emission Color'].default_value=(*emis,1); b.inputs['Emission Strength'].default_value=0.0
    return m
def srgb(h):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in c)
mat('torso', srgb('#4a5040'), rough=0.8)          # olive combat shirt
mat('arm',   srgb('#3f4536'), rough=0.8)          # sleeves / gloves
mat('pants', srgb('#5a5c48'), rough=0.85)         # olive drab trousers
mat('gear',  srgb('#7a6a4c'), rough=0.75, bump=.35)  # coyote-tan webbing & pouches
mat('jumpjet', srgb('#3a3d40'), metal=0.6, rough=0.45, bump=.1, scale=60)
mat('TECI_helmet', srgb('#454a45'), metal=0.2, rough=0.5, bump=.1, scale=60)

# ---------- rifle ----------
def box(nm, size, loc, col, metal=0.5, rough=0.4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.active_object; o.name=nm; o.scale=size
    m=bpy.data.materials.new(nm+'m'); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*col,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    o.data.materials.append(m); return o
def cyl(nm, r, d, loc, col, metal=0.7, rough=0.35):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, location=loc, rotation=(math.pi/2,0,0), vertices=16)
    o=bpy.context.active_object; o.name=nm
    m=bpy.data.materials.new(nm+'m'); m.use_nodes=True
    p=m.node_tree.nodes['Principled BSDF']; p.inputs['Base Color'].default_value=(*col,1); p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    o.data.materials.append(m); return o
BLK=srgb('#1c1e20'); TAN=srgb('#6e6450')
# built along -Y (forward), origin at the pistol grip
parts=[box('rcv',(0.05,0.34,0.075),(0,-0.10,0.03),BLK),
       box('hg',(0.055,0.26,0.065),(0,-0.39,0.03),TAN,0.1,0.7),
       cyl('brl',0.012,0.22,(0,-0.60,0.04),BLK),
       box('stk',(0.045,0.22,0.08),(0,0.17,0.0),TAN,0.1,0.7),
       box('grp',(0.035,0.04,0.10),(0,0.0,-0.045),BLK),
       box('mag',(0.035,0.06,0.13),(0,-0.14,-0.06),BLK),
       box('opt',(0.03,0.10,0.045),(0,-0.10,0.095),BLK,0.7,0.3),
       box('rail',(0.02,0.30,0.012),(0,-0.25,0.07),BLK)]
parts[4].rotation_euler=(math.radians(-15),0,0); parts[5].rotation_euler=(math.radians(10),0,0)
bpy.ops.object.select_all(action='DESELECT')
for p in parts: p.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
vl.objects.active=parts[0]; bpy.ops.object.join(); rifle=parts[0]; rifle.name='Rifle'
# rest-pose placement: grip at the right hip/chest, aimed forward and slightly down
GRIP=Vector((-0.09,-0.19,0.32)); FORE=Vector((0.0,-0.58,0.34))
rifle.location=GRIP; rifle.rotation_euler=Euler((math.radians(7),0,math.radians(4)))
vl.update()
mw=rifle.matrix_world.copy()
rifle.parent=arm; rifle.parent_type='BONE'; rifle.parent_bone='Spine'
vl.update(); rifle.matrix_world=mw
fore_local=rifle.matrix_world.inverted()@(rifle.matrix_world@Vector((0,-0.36,0.0)))
grip_w=rifle.matrix_world@Vector((0,0.0,0.0)); fore_w=rifle.matrix_world@Vector((0,-0.38,0.0))

P=arm.pose.bones
def put(name, v):  # armature-space head location (parent chain must be unposed)
    pb=P[name]; R=pb.bone.matrix_local.to_3x3()
    pb.location=R.inverted()@(Vector(v)-pb.bone.head_local)
def turn(name, q):  # armature-space rotation about the bone head
    pb=P[name]; R=pb.bone.matrix_local.to_3x3().to_quaternion()
    pb.rotation_quaternion=R.inverted()@q@R
def reset():
    for pb in P: pb.location=(0,0,0); pb.rotation_quaternion=(1,0,0,0); pb.scale=(1,1,1)
    vl.update()

def pose(ph, run=1.0, aim=0.0):
    """ph = 0..1 gait phase; run = stride amount (0 = idle stance)"""
    reset()
    # hands on the rifle
    put('@Ik_RightArm', grip_w+Vector((-0.005,0.03,0.0)))
    put('@Ik_LeftArm',  fore_w+Vector((0.02,0.0,-0.01)))
    put('@Pole_RightArm', Vector((-0.55,0.35,-0.05)))
    put('@Pole_LeftArm',  Vector((0.45,0.10,-0.25)))
    P['@Control_RHandClose'].rotation_quaternion=Quaternion((0,0,1), math.radians(16))
    P['@Control_LHandclose'].rotation_quaternion=Quaternion((0,0,1), math.radians(16))
    # feet
    a=2*math.pi*ph
    for side,off,ctl in ((1,0,'@Control_Lfoot'),(-1,math.pi,'@Control_Rfoot')):
        s=math.sin(a+off); c=math.cos(a+off)
        y = -0.30*run*c                     # forward swing when c<0
        lift = max(0.0, s)*0.20*run           # swing phase lifts the foot
        rest=arm.data.bones[ctl].head_local
        put(ctl, Vector((rest.x*0.9, rest.y+y, rest.z+lift)))
        # toe roll: plant heel forward, push off the toes behind
        ang = (-0.35*c if s>0 else 0.25*max(0,c))*run
        turn(ctl, Quaternion((1,0,0), ang))
    # body: slight crouch, forward lean, bob, twist
    bob = 0.035*abs(math.sin(a))*run
    put('Spine', Vector((0, -0.03*run, -0.03 - 0.03*run + bob)))
    turn('Spine', Euler((math.radians(3+7*run), math.radians(4*math.sin(a)*run), math.radians(-4*math.cos(a)*run))).to_quaternion())
    vl.update()

cam=cam_setup(res=(240,300), ortho=2.25)
sc.cycles.samples=int(os.environ.get('SAMPLES','32')); sc.cycles.use_denoising=True
from bpy_extras.object_utils import world_to_camera_view
def footinfo(tag):
    vl.update(); f=world_to_camera_view(sc, cam, Vector((0,0,-0.99))); h=world_to_camera_view(sc, cam, Vector((0,0,0.88)))
    print('FOOT',tag, sc.render.resolution_x, sc.render.resolution_y, round(f.x,4), round(1-f.y,4), 'head', round(1-h.y,4))
def aimcam(az, el, dist=6, tz=-0.02):
    # az: 0 = camera behind the soldier (soldier faces -Y, camera on +Y side)
    azr=math.radians(az); elr=math.radians(el)
    tgt=Vector((0,0,tz))
    pos=tgt+Vector((math.sin(azr)*math.cos(elr), math.cos(azr)*math.cos(elr), math.sin(elr)))*dist
    cam.location=pos
    d=(tgt-pos); cam.rotation_euler=d.to_track_quat('-Z','Y').to_euler()
def shot(path):
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)

if JOB=='test':
    for i,(ph,az,el) in enumerate([(0,0,22),(0.25,0,22),(0,180,6),(0.25,90,10),(0.5,45,50)]):
        pose(ph, 1.0 if i!=2 else 0.0); aimcam(az,el); shot(OUT+f't{i}.png')
elif JOB=='back':   # lane squad: seen from behind & above
    N=16
    sc.render.resolution_x, sc.render.resolution_y = 200, 250
    for f in range(N): pose(f/N,1.0); aimcam(0,22); shot(OUT+f'back_{f:02d}.png')
    footinfo('back')
elif JOB=='front':
    for f,(ph) in enumerate([0.0]):
        sc.render.resolution_x, sc.render.resolution_y = 320, 400
        pose(0,0.0); aimcam(212,5); shot(OUT+f'front_{f:02d}.png'); footinfo('front')
elif JOB=='arena':
    N=12; sc.render.resolution_x, sc.render.resolution_y = 160, 200
    sc.world.node_tree.nodes['Background'].inputs[1].default_value=1.3
    for l in bpy.data.lights: l.energy*=1.6
    for d in range(8):
        for f in range(N): pose(f/N,1.0); aimcam(180-d*45,52); shot(OUT+f'ar_{d}_{f:02d}.png')
    footinfo('arena')
