import bpy, math, mathutils
from mathutils import Vector, Euler
bpy.ops.wm.open_mainfile(filepath="/root/.claude/uploads/e974cc7e-d40a-5925-8089-645ccb09b17f/adc0ff02-teci_pilot_b291.blend")
sc=bpy.context.scene
for o in list(bpy.data.objects):
    if o.type in ('MESH','LIGHT') and o.name!='TECI_Pilot': bpy.data.objects.remove(o)
arm=bpy.data.objects['ArmaRig']; me=bpy.data.objects['TECI_Pilot']; me.hide_render=False; sc.render.resolution_percentage=100
def flat(mat, col, metal=0.0, rough=0.6, emis=None):
    m=bpy.data.materials[mat]; nt=m.node_tree
    for n in list(nt.nodes):
        if n.type not in ('OUTPUT_MATERIAL',): nt.nodes.remove(n)
    b=nt.nodes.new('ShaderNodeBsdfPrincipled'); out=[n for n in nt.nodes if n.type=='OUTPUT_MATERIAL'][0]
    nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs['Base Color'].default_value=(*col,1); b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
    return b
def cam_setup(res=(400,500), ortho=2.3, loc=(0,5,0.2), rot=(90,0,180)):
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=24; sc.cycles.use_denoising=False
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.film_transparent=True
    cd=bpy.data.cameras.new('c'); cd.type='ORTHO'; cd.ortho_scale=ortho
    c=bpy.data.objects.new('cam',cd); sc.collection.objects.link(c); c.location=loc; c.rotation_euler=Euler([math.radians(a) for a in rot]); sc.camera=c
    w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.35,0.36,0.4,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.6
    for nm,en,rot2 in [('key',4.0,(50,0,150)),('rim',3.0,(60,0,-20)),('fill',1.0,(70,0,-120))]:
        ld=bpy.data.lights.new(nm,'SUN'); ld.energy=en; l=bpy.data.objects.new(nm,ld); sc.collection.objects.link(l); l.rotation_euler=Euler([math.radians(a) for a in rot2])
    return c
