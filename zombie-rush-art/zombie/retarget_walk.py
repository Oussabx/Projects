import bpy, math, os, sys
from mathutils import Vector, Euler, Matrix, Quaternion
S='/tmp/claude-0/-home-user-Projects/e974cc7e-d40a-5925-8089-645ccb09b17f/scratchpad/'
UP='/root/.claude/uploads/e974cc7e-d40a-5925-8089-645ccb09b17f/'
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
JOB=argv[0] if argv else 'test'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene; vl=bpy.context.view_layer
bpy.ops.import_scene.fbx(filepath=UP+'591e9d09-Walking.fbx')
beta=bpy.data.objects['Armature']; act=beta.animation_data.action
for n in ('Beta_Surface','Beta_Joints'): bpy.data.objects[n].hide_render=True
bpy.ops.wm.obj_import(filepath=UP+'aa81881d-Mutant.obj')
mu=[o for o in bpy.data.objects if o.type=='MESH' and not o.name.startswith('Beta')][0]
k=1.81/174.1; mu.scale=(k,k,k); vl.update()
vs=[mu.matrix_world@v.co for v in mu.data.vertices]
mu.location=(-(min(v.x for v in vs)+max(v.x for v in vs))/2, -(min(v.y for v in vs)+max(v.y for v in vs))/2, -min(v.z for v in vs)); vl.update()
MW=mu.matrix_world.copy()
J={k2:MW@Vector(v) for k2,v in dict(
    pelvis=(0,92,24), chest=(0,118,28), neck=(0,146,40), head=(0,166,46),
    hipA=(12,90,24), kneeA=(23,48,28), ankleA=(24,11,12), toeA=(26,1,32),
    hipB=(-12,90,24), kneeB=(-23,48,28), ankleB=(-24,11,12), toeB=(-22,1,34),
    shA=(20,136,33), elA=(44,108,30), wrA=(56,90,29), handA=(52,74,27),
    shB=(-20,136,33), elB=(-44,108,30), wrB=(-58,88,31), handB=(-60,72,32)).items()}
L=lambda a,b,t: a+(b-a)*t
# Mixamo "Left" is +x in Blender (= the A-side joints)
NEW={'Hips':J['pelvis'],'Spine':L(J['pelvis'],J['chest'],.45),'Spine1':J['chest'],'Spine2':L(J['chest'],J['neck'],.5),
     'Neck':J['neck'],'Head':L(J['neck'],J['head'],.35),'HeadTop_End':L(J['neck'],J['head'],1.9)}
for s,x in (('Left','A'),('Right','B')):
    sh=J['sh'+x]
    NEW.update({f'{s}Shoulder':L(Vector((0,sh.y,sh.z)),sh,.3), f'{s}Arm':sh, f'{s}ForeArm':J['el'+x], f'{s}Hand':J['wr'+x],
        f'{s}UpLeg':J['hip'+x], f'{s}Leg':J['knee'+x], f'{s}Foot':J['ankle'+x],
        f'{s}ToeBase':Vector((L(J['ankle'+x],J['toe'+x],.6).x, L(J['ankle'+x],J['toe'+x],.6).y, J['toe'+x].z+0.02)), f'{s}Toe_End':J['toe'+x]})
NEW={'mixamorig:'+a:b for a,b in NEW.items()}

# ---- mutant armature: copy of the mixamo rig, joints moved onto the mutant (A-pose) ----
ma=beta.copy(); ma.data=beta.data.copy(); ma.animation_data_clear(); sc.collection.objects.link(ma); ma.name='MutArm'
AW=ma.matrix_world.copy(); AWi=AW.inverted()
bpy.ops.object.select_all(action='DESELECT'); vl.objects.active=ma; ma.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb=ma.data.edit_bones
oldh={b.name:AW@b.head for b in eb}; oldt={b.name:AW@b.tail for b in eb}
def rigid_of(name):  # nearest mapped ancestor
    b=eb[name]
    while b and b.name not in NEW: b=b.parent
    return b.name if b else None
# hand rotation: old hand dir -> new hand dir
HR={}
for s,x in (('Left','A'),('Right','B')):
    h='mixamorig:%sHand'%s
    od=(oldh['mixamorig:%sHandMiddle1'%s]-oldh[h]); nd=(J['hand'+x]-J['wr'+x])
    HR[h]=(od.rotation_difference(nd), nd.length/od.length)
def newpos(name, p_old):
    if name in NEW and p_old is None: return NEW[name]
    anc=rigid_of(name)
    q,sc_=HR.get(anc,(Quaternion(),1.0))
    return NEW[anc]+ (q@(p_old-oldh[anc]))*sc_
heads={b.name:(NEW[b.name] if b.name in NEW else newpos(b.name,oldh[b.name])) for b in eb}
for b in eb:
    kids=[c for c in b.children]
    main=[c for c in kids if c.name in NEW] or kids
    if main: t=heads[main[0].name]
    else:
        anc=rigid_of(b.name); q,sc_=HR.get(anc,(Quaternion(),1.0))
        t=heads[b.name]+(q@(oldt[b.name]-oldh[b.name]))*sc_*(1 if b.name not in NEW else 1)
    if (t-heads[b.name]).length<1e-4: t=heads[b.name]+Vector((0,0,0.02))
    b.head=AWi@heads[b.name]; b.tail=AWi@t
bpy.ops.object.mode_set(mode='OBJECT')

# ---- skin ----
bpy.ops.object.select_all(action='DESELECT'); mu.select_set(True); ma.select_set(True); vl.objects.active=ma
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
empty=[g.name for g in mu.vertex_groups]
print('VGROUPS',len(mu.vertex_groups))
from mathutils import kdtree
# loose parts (teeth, jaw bits...): any part with unweighted verts moves rigidly with the body point nearest its centre
nv=len(mu.data.vertices); par=list(range(nv))
def fnd(x):
    while par[x]!=x: par[x]=par[par[x]]; x=par[x]
    return x
for e in mu.data.edges:
    a_,b_=fnd(e.vertices[0]),fnd(e.vertices[1])
    if a_!=b_: par[a_]=b_
parts={}
for i in range(nv): parts.setdefault(fnd(i),[]).append(i)
V=mu.data.vertices
big=max(parts.values(),key=len); bigset=set(big)
wv=[i for i in big if len(V[i].groups)]
kd=kdtree.KDTree(len(wv))
for j,i in enumerate(wv): kd.insert(V[i].co,j)
kd.balance()
fixed=0
for root,idx in parts.items():
    if idx is big: continue
    if len(idx)>=200 and all(len(V[i].groups) for i in idx): continue
    c=sum((V[i].co for i in idx),Vector())/len(idx)
    _,j,_=kd.find(c); src=V[wv[j]]
    for g in mu.vertex_groups: g.remove(idx)
    for g in src.groups: mu.vertex_groups[g.group].add(idx, g.weight, 'REPLACE')
    fixed+=len(idx)
for i in big:
    if not V[i].groups:
        _,j,_=kd.find(V[i].co); src=V[wv[j]]
        for g in src.groups: mu.vertex_groups[g.group].add([i], g.weight, 'REPLACE')
        fixed+=1
print('PARTS',len(parts),[len(x) for x in sorted(parts.values(),key=len,reverse=True)[:8]])
print('UNWEIGHTED fixed',fixed)

# ---- straighten into the mixamo rest pose (bone directions = beta rest directions) ----
ma.data.pose_position='POSE'
BW=beta.matrix_world
order=[]
def walk(b):
    order.append(b.name); [walk(c) for c in b.children]
for b in ma.data.bones:
    if not b.parent: walk(b)
R3=AW.to_3x3().normalized()
for n in order:
    pb=ma.pose.bones[n]; vl.update()
    cur=(AW@pb.tail-AW@pb.head); bb=beta.data.bones[n]; tgt=(BW@bb.tail_local-BW@bb.head_local)
    if cur.length<1e-6 or tgt.length<1e-6: continue
    q=cur.rotation_difference(tgt)
    qa=(R3.inverted()@q.to_matrix()@R3)
    m=pb.matrix.copy(); t=m.translation.copy(); r=qa.to_4x4()@m; r.translation=t; pb.matrix=r
vl.update()
bpy.ops.object.select_all(action='DESELECT'); vl.objects.active=mu; mu.select_set(True)
modn=[m.name for m in mu.modifiers if m.type=='ARMATURE'][0]
bpy.ops.object.modifier_apply(modifier=modn)
bpy.ops.object.select_all(action='DESELECT'); vl.objects.active=ma; ma.select_set(True)
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
# match every bone's roll to the mixamo rest frame so the mocap rotations mean the same thing
bpy.ops.object.mode_set(mode='EDIT')
BWi3=BW.to_3x3(); errs=[]
for e in ma.data.edit_bones:
    bb=beta.data.bones[e.name]
    zw=BWi3@(bb.matrix_local.to_3x3()@Vector((0,0,1)))
    e.align_roll(AWi.to_3x3()@zw)
    yw=(AW@e.tail-AW@e.head).normalized(); yb=(BW@bb.tail_local-BW@bb.head_local).normalized()
    errs.append(math.degrees(yw.angle(yb)) if yw.length and yb.length else 0)
print('DIRERR max', round(max(errs),2))
bpy.ops.object.mode_set(mode='OBJECT')
md=mu.modifiers.new('Armature','ARMATURE'); md.object=ma
for pb in ma.pose.bones: pb.location=(0,0,0); pb.rotation_quaternion=(1,0,0,0); pb.rotation_euler=(0,0,0)

# ---- animation: same local rotations as the mocap; hips bob kept, forward drift removed ----
ma.animation_data_create(); ma.animation_data.action=act
hp='pose.bones["mixamorig:Hips"].location'
fcs=[fc for fc in act.fcurves if fc.data_path==hp]
for fc in fcs:
    ks=fc.keyframe_points; a,b=ks[0].co[1],ks[-1].co[1]; f0,f1=ks[0].co[0],ks[-1].co[0]
    print('HIPS',fc.array_index,round(a,2),round(b,2))
    if abs(b-a)>20:   # forward travel (cm)
        for kp in ks:
            d=a+(b-a)*(kp.co[0]-f0)/(f1-f0); kp.co[1]-=d; kp.handle_left[1]-=d; kp.handle_right[1]-=d
FR=act.frame_range
def sig(f):
    sc.frame_set(f); vl.update(); P=ma.pose.bones
    return [c for n in ('mixamorig:LeftFoot','mixamorig:RightFoot','mixamorig:LeftHand','mixamorig:RightHand') for c in (P[n].head-P['mixamorig:Hips'].head)]
sigs={f:sig(f) for f in range(int(FR[0]),int(FR[1])+1)}
best=None
for Pd in range(24,int(FR[1]-FR[0])):
    for f0 in range(int(FR[0]),int(FR[1])-Pd+1):
        d=sum((x-y)**2 for x,y in zip(sigs[f0],sigs[f0+Pd]))
        if best is None or d<best[0]: best=(d,Pd,f0)
print('LOOP',best)
_,PER,F0=best

# ---- undead skin material ----
m=bpy.data.materials.new('skin'); m.use_nodes=True; nt=m.node_tree; N=nt.nodes; Lk=nt.links
bs=N['Principled BSDF']
tc=N.new('ShaderNodeTexCoord')
def noise(scale,detail=6,rough=.6):
    n=N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value=scale; n.inputs['Detail'].default_value=detail; n.inputs['Roughness'].default_value=rough
    Lk.new(tc.outputs['Generated'],n.inputs['Vector']); return n
def ramp(inp, stops):
    r=N.new('ShaderNodeValToRGB'); e=r.color_ramp.elements
    e[0].position,e[0].color=stops[0]; e[1].position,e[1].color=stops[-1]
    for p,c in stops[1:-1]:
        x=e.new(p); x.color=c
    Lk.new(inp,r.inputs[0]); return r
def srgb(h,a=1):
    h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in c)+(a,)
blot=noise(5,5,.55)       # large blotches
fine=noise(90,8,.7)
base=ramp(blot.outputs['Fac'],[(0.32,srgb('#3c4630')),(0.45,srgb('#66704f')),(0.55,srgb('#7c7a5e')),(0.64,srgb('#5e4a3e')),(0.74,srgb('#4a2e2c'))])
geo=N.new('ShaderNodeNewGeometry')
cav=ramp(geo.outputs['Pointiness'],[(0.44,(0.18,0.14,0.13,1)),(0.52,(1,1,1,1))])
mul=N.new('ShaderNodeMix'); mul.data_type='RGBA'; mul.blend_type='MULTIPLY'; mul.inputs['Factor'].default_value=0.85
Lk.new(base.outputs[0],mul.inputs[6]); Lk.new(cav.outputs[0],mul.inputs[7])
Lk.new(mul.outputs[2],bs.inputs['Base Color'])
rr=N.new('ShaderNodeMapRange'); rr.inputs['To Min'].default_value=0.45; rr.inputs['To Max'].default_value=0.8
Lk.new(fine.outputs['Fac'],rr.inputs['Value']); Lk.new(rr.outputs[0],bs.inputs['Roughness'])
bp=N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value=0.35; bp.inputs['Distance'].default_value=0.01
Lk.new(fine.outputs['Fac'],bp.inputs['Height']); Lk.new(bp.outputs[0],bs.inputs['Normal'])
bs.inputs['Subsurface Weight'].default_value=0.08; bs.inputs['Subsurface Radius'].default_value=(0.6,0.25,0.2)
bs.inputs['Specular IOR Level'].default_value=0.6
mu.data.materials.clear(); mu.data.materials.append(m)
for p in mu.data.polygons: p.use_smooth=True

# ---- camera & lights ----
sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=int(os.environ.get('SAMPLES','32')); sc.cycles.use_denoising=True
sc.render.film_transparent=True; sc.render.resolution_x=200; sc.render.resolution_y=250; sc.render.resolution_percentage=100
cd=bpy.data.cameras.new('c'); cd.type='ORTHO'; cd.ortho_scale=float(os.environ.get('ORTHO','2.1'))
cam=bpy.data.objects.new('cam',cd); sc.collection.objects.link(cam); sc.camera=cam
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.5,0.52,0.58,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.55
for nm,en,rot,col in [('key',4.2,(55,0,-35),(1,.95,.88)),('rim',5.0,(70,0,165),(.75,.85,1)),('fill',0.9,(75,0,60),(.8,.85,1))]:
    ld=bpy.data.lights.new(nm,'SUN'); ld.energy=en; ld.color=col; ld.angle=0.1; l=bpy.data.objects.new(nm,ld); sc.collection.objects.link(l); l.rotation_euler=Euler([math.radians(a) for a in rot])
from bpy_extras.object_utils import world_to_camera_view
def aim(az,el,tz=0.85):
    a=math.radians(az); e=math.radians(el); tgt=Vector((0,0,tz))
    cam.location=tgt+Vector((math.sin(a)*math.cos(e),-math.cos(a)*math.cos(e),math.sin(e)))*8
    cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler(); vl.update()
    # shift so the ground point lands at foot px 237.5
    g=world_to_camera_view(sc,cam,Vector((0,0,0))); dy=(1-g.y)*250-237.5
    cam.location+= cam.matrix_world.to_3x3()@Vector((0,1,0))*(dy/250*cd.ortho_scale); vl.update()
OUT=S+'zw/'
def frame_t(i,n): return F0+PER*i/n
if JOB=='test':
    for i,(fr,az,el) in enumerate([(F0,0,10),(F0+PER*0.25,0,10),(F0+PER*.5,90,5),(F0+PER*.75,35,12)]):
        sc.frame_set(int(fr), subframe=fr%1); aim(az,el); sc.render.filepath=OUT+f'r{i}.png'; bpy.ops.render.render(write_still=True)
elif JOB=='sheet':
    n=16
    for i in range(n):
        fr=frame_t(i,n); sc.frame_set(int(fr), subframe=fr%1); aim(0,10)
        sc.render.filepath=OUT+f's{i:02d}.png'; bpy.ops.render.render(write_still=True)
    # top of head in px for modelH
    tops=[]
    print('DONE')
