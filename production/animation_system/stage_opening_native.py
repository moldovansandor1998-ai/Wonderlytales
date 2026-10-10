"""Add existing story props, light cues and packed audio to the native opening.

The 132s excerpt is a review candidate with explicitly unresolved voice takes.
No final visual, acting or phonetic approval is granted by this script.
"""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json,smooth
from animation_system.interactions import author_interactions
from animation_system.crouch import orient_crouch_knees
source,props,audio,dest=map(Path,sys.argv[sys.argv.index('--')+1:])
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False)
scene=bpy.context.scene;second='SC003' in dest.name;scene.frame_set(1)
script=json.loads(dest.with_suffix('.script.json').read_text())
rigs={obj.get('character_code'):obj for obj in scene.objects if obj.type=='ARMATURE' and obj.get('character_code')}
for code,name in script.get('linear_skinning',{}).items():
    for modifier in bpy.data.objects[name].modifiers:
        if modifier.type=='ARMATURE' and modifier.object==rigs[code]:modifier.use_deform_preserve_volume=False
crouch_report=orient_crouch_knees(scene,script,rigs)
interaction_report=author_interactions(scene,script,rigs)
# Reapply the shot contract after staging revisions without rebuilding poses.
markers=sorted(scene.timeline_markers,key=lambda marker:marker.frame)
if len(markers)!=len(script['cameras']):raise ValueError('Shot marker count drift')
for index,(marker,view) in enumerate(zip(markers,script['cameras'])):
    cam=marker.camera;cam.animation_data_clear();cam.data.lens=view.get('lens',40)
    end=script['cameras'][index+1]['start'] if index+1<len(markers) else script['duration']
    a=round(view['start']*24)+1;b=round(end*24)
    for frame in range(a,b+1):
        u=smooth((frame-a)/max(1,b-a));cam.location=Vector(view['position']).lerp(Vector(view.get('end_position',view['position'])),u)
        target=Vector(view['target']).lerp(Vector(view.get('end_target',view['target'])),u)
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.keyframe_insert('location',frame=frame);cam.keyframe_insert('rotation_euler',frame=frame)
    for curve in cam.animation_data.action.fcurves:
        for key in curve.keyframe_points:key.interpolation='LINEAR'
# The location master also contains earlier episode props. Exclude those only
# from this scene; preserve the immutable location and character masters.
environment=bpy.data.collections['LOC_FOREST_MASTER_V021'];hidden=[]
for obj in environment.all_objects:
    if not obj:continue
    name=obj.name.lower()
    keep_environment=any(x in name for x in ('oak','fern','grass','canopy','bush','tree','flower','boulder','foliage','woodland','forest floor','forest path','late afternoon sun','soft camera fill'))
    if not keep_environment:obj.hide_render=True;hidden.append(obj.name)
before=set(bpy.data.objects)
with bpy.data.libraries.load(str(props.resolve()),link=False) as (src,loaded):loaded.objects=src.objects
new=[o for o in bpy.data.objects if o not in before]
star=next(o for o in new if o.name.startswith('PROP_STAR_SHARD'))
scarf=next(o for o in new if o.name.startswith('PROP_FOLDED_SCARF'))
keep={star,*star.children_recursive}
if second:keep.update({scarf,*scarf.children_recursive})
for obj in new:
    if obj in keep:scene.collection.objects.link(obj)
    else:bpy.data.objects.remove(obj,do_unlink=True)
star.location=(-.1,-1.35,.23);star.scale=(.85,.85,.85);star.rotation_euler=(.08,0,.2)
# Keep the original broken-star topology and cloth from the project's prop library.
if second:
    prop=bpy.data.objects.get('PROP_star')
    if not prop:raise ValueError('Missing authored contact prop')
    for frame in range(1,scene.frame_end+1):
        scene.frame_set(frame)
        star.location=prop.location;star.keyframe_insert('location',frame=frame)
        scarf.location=prop.location+Vector((0,0,-.022));scarf.scale=(.5,.5,.5);scarf.keyframe_insert('location',frame=frame)
    prop.hide_render=True
    for obj in [scarf,*scarf.children_recursive]:
        obj.hide_render=True;obj.keyframe_insert('hide_render',frame=1)
        obj.hide_render=False;obj.keyframe_insert('hide_render',frame=17*24+1)
    data=bpy.data.lights.new('Directional shard response','POINT');light=bpy.data.objects.new(data.name,data);scene.collection.objects.link(light);data.color=(.08,.8,1);data.shadow_soft_size=.025
    for frame in range(1,scene.frame_end+1):
        scene.frame_set(frame);light.location=star.location+Vector((0,0,.035));light.keyframe_insert('location',frame=frame)
    for t,power in [(0,.4),(25,.4),(26,2),(31,2),(34,.15),(39,.15),(42,2),(74,2)]:
        data.energy=power;data.keyframe_insert('energy',frame=round(t*24)+1)
else:
    # A leaf lifted by a moving glow, then three distinct signals at the roots.
    verts=[(-.07,0,0),(-.046,-.02,.002),(-.013,-.032,.005),(.034,-.022,.008),(.07,0,.01),(.034,.023,.006),(-.013,.034,.002),(-.046,.019,0),(0,0,.009)]
    mesh=bpy.data.meshes.new('Signal leaf');mesh.from_pydata(verts,[],[(i,(i+1)%8,8) for i in range(8)]);mesh.update()
    leaf=bpy.data.objects.new('Story signal leaf',mesh);scene.collection.objects.link(leaf)
    material=bpy.data.materials.new('Autumn signal leaf');material.diffuse_color=(.29,.075,.018,1);leaf.data.materials.append(material)
    solid=leaf.modifiers.new('Leaf thickness','SOLIDIFY');solid.thickness=.001
    vein_material=bpy.data.materials.new('Leaf copper veins');vein_material.diffuse_color=(.48,.22,.05,1)
    for i,points in enumerate([[(-.069,0,.003),(.065,0,.013)]]+[[(-.03+offset,0,.012),(-.016+offset,side*.024,.012)] for offset in (0,.028) for side in (-1,1)]):
        curve=bpy.data.curves.new('Leaf vein '+str(i),'CURVE');curve.dimensions='3D';curve.bevel_depth=.0007;curve.bevel_resolution=1;line=curve.splines.new('POLY');line.points.add(1)
        for point,co in zip(line.points,points):point.co=(*co,1)
        vein=bpy.data.objects.new(curve.name,curve);scene.collection.objects.link(vein);vein.parent=leaf;curve.materials.append(vein_material)
    for t,z,tilt in [(0,.008,0),(15,.008,0),(16,.075,.4),(17.5,.025,-.2),(19,.008,0)]:
        leaf.location=(-.3,-1.1,z);leaf.rotation_euler=(tilt,.1,tilt*.5)
        leaf.keyframe_insert('location',frame=round(t*24)+1);leaf.keyframe_insert('rotation_euler',frame=round(t*24)+1)
    data=bpy.data.lights.new('Travelling story glimmer','POINT');light=bpy.data.objects.new(data.name,data);scene.collection.objects.link(light);data.color=(.08,.8,1);data.shadow_soft_size=.025
    for t,energy,pos in [(0,0,[-.3,-1.1,.05]),(15,0,[-.3,-1.1,.05]),(16,4,[-.3,-1.1,.06]),(18,0,[.2,-.5,.04]),(29,0,[.2,-.5,.04]),(29.2,3,[.2,-.5,.04]),(29.5,0,[.2,-.5,.04]),(30,3,[.1,-.8,.04]),(30.3,0,[.1,-.8,.04]),(30.8,4,[-.1,-1.35,.25]),(31.1,0,[-.1,-1.35,.25]),(49,2,[-.1,-1.35,.25])]:
        light.location=pos;light.keyframe_insert('location',frame=round(t*24)+1);data.energy=energy;data.keyframe_insert('energy',frame=round(t*24)+1)
# A small flat stone establishes the pickup support surface.
bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=(-.1,-1.35,.09));stone=bpy.context.object;stone.name='Story shard support stone';stone.scale=(.25,.19,.13)
mat=bpy.data.materials.new('Story moss stone');mat.diffuse_color=(.16,.22,.15,1);stone.data.materials.append(mat)
for poly in stone.data.polygons:poly.use_smooth=True
editor=scene.sequence_editor_create()
for strip in list(editor.strips):editor.strips.remove(strip)
sound=editor.strips.new_sound('V024 original HU takes and review mix',str(audio.resolve()),channel=1,frame_start=1)
sound.sound.pack()
scene.render.use_sequencer=False;scene['production_approved']=False;scene['status']='V024_CONNECTED_OPENING_REVIEW';scene['script_sha256']=digest(dest.with_suffix('.script.json'))
scene.frame_set(1);bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True)
atomic_json(dest.with_suffix('.stage.json'),{'blender':bpy.app.version_string,'source_sha256':digest(source),'props_sha256':digest(props),'audio_sha256':digest(audio),'output_sha256':digest(dest),'frames':scene.frame_end,'production_approved':False,'crouch_report':crouch_report,'interaction_report':interaction_report,'hidden_prior_scene_objects':hidden,'unresolved_recordings_in_trial':3,'score_status':'procedural review cue, not final music'})
