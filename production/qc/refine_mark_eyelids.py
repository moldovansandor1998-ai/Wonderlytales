"""V011 native lid correction; multi-pose geometry follows the eye surface.
Blender -b -t 2 --python this.py -- V010_ACTING.blend NEW_DIRECTORY
The speech action and existing face controls are retained.
"""
import bpy,sys,json,math,hashlib,numpy as np
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];source,out=[Path(x).resolve() for x in args]
out.mkdir(parents=True,exist_ok=True);dest=out/'CHAR_MARK_ACTING_V011_DRAFT.blend'
assert not dest.exists(),'Use a fresh destination.'
sha=hashlib.sha256(source.read_bytes()).hexdigest()
# The previous acting draft is a reviewed, packed source, not a new identity.
assert sha=='50096838c515bff320cb61d66027f9d26ff1028d34fef6dc44c1625f422783be'
bpy.ops.wm.open_mainfile(filepath=str(source));s=bpy.context.scene
r=next(o for o in s.objects if o.type=='ARMATURE');assert r.name.startswith('CHAR_MARK')
assert s['status']=='DRAFT_EXPRESSION_AUTHORING_NOT_APPROVED'
N=96;R=12;steps=8;reports=[]
for side in ['R','L']:
 lid=bpy.data.objects['EYELIDS.'+side];mount=bpy.data.objects['EYE_HEAD_MOUNT.'+side]
 assert len(lid.data.vertices)==N*R
 old=lid.data.shape_keys.key_blocks['Basis'];oldverts=[v.co.copy() for v in old.data]
 cx=float(np.mean([v.x for v in oldverts]));cz=float(np.mean([v.z for v in oldverts]))
 # A radius-0.018 eyeball is flattened vertically by its native head mount.
 s.frame_set(1);r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update()
 # Centers are pinned from the V008 authoring landmarks, in mesh coordinates.
 cy={'R':-.1068039983510971,'L':-.10598115622997284}[side]
 bpy.context.view_layer.objects.active=lid
 bpy.ops.object.shape_key_remove(all=True)
 def coords(blink):
  values=[]
  for i,p in enumerate(oldverts):
   f=(i//N)/(R-1);angle=2*math.pi*(i%N)/N
   x=(.017+.006*f)*math.cos(angle)
   # Almond-like resting contour, connected to the unchanged outer rim.
   h=(.0106 if math.sin(angle)>=0 else .0088)*(1-f)+.0195*f
   opening=h*math.sin(angle)
   closure=-.0012*(1-math.cos(angle)**2)
   z=opening*(1-blink*(1-f))+closure*blink*(1-f)
   # Bound both adjacent interpolation segments, including globe entry.
   zs=[opening*(1-b*(1-f))+closure*b*(1-f) for b in [max(0,blink-1/steps),blink,min(1,blink+1/steps)]]
   nearest=0. if min(zs)<=0<=max(zs) else min(abs(v) for v in zs)
   rad2=.018**2-x*x-(nearest/.86)**2
   # Avoid the original chord through the globe at intermediate blinks.
   globe=cy-math.sqrt(max(0.,rad2))-.00085
   y=min(p.y,globe) if rad2>0 else p.y
   # Preserve the exact outside border for every pose.
   if f==1:x=p.x-cx;z=p.z-cz;y=p.y
   values.append((cx+x,y,cz+z))
  return values
 basecoords=coords(0.)
 for v,p in zip(lid.data.vertices,basecoords):v.co=p
 lid.shape_key_add(name='Basis')
 for i in range(1,steps+1):
  center=i/steps;k=lid.shape_key_add(name='LidPose_%02d'%i)
  for v,p in zip(k.data,coords(center)):v.co=p
  d=k.driver_add('value').driver;d.type='SCRIPTED';var=d.variables.new();var.name='b';var.type='SINGLE_PROP';var.targets[0].id=r;var.targets[0].data_path='["blink"]'
  d.expression='max(0,1-abs(max(0,min(1,b))-%s)*%d)'%(center,steps)
 reports.append({'side':side,'lid_vertices':len(lid.data.vertices),'blink_pose_samples':steps+1,'center':[cx,cy,cz],'native_radius':.018,'minimum_globe_clearance':.00085})
s['status']='DRAFT_EYELID_REFINEMENT_NOT_APPROVED';s['production_approved']=False;s['facial_ready']=False;s['lip_sync_ready']=False
s['eyelid_note']='Nine native lid samples with segment bounds against the globe. Art review required.'
s.frame_set(1)
for o in [r]+[bpy.data.objects['EYELIDS.'+x].data.shape_keys for x in ['R','L']]:
 if o.animation_data:
  for fc in o.animation_data.drivers:fc.driver.expression=fc.driver.expression
r.update_tag(refresh={'OBJECT'});bpy.context.view_layer.update();bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
report={'version':'V011_EYELID_DRAFT','source_sha256':sha,'source_library_file_id':'libfile_4ed5c4f5c6688191add605efaba1bdd1','output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'character':'CHAR_MARK','eyes':reports,'existing_speech_action_retained':True,'production_approved':False,'quality_gate_passed':False,'phoneme_alignment':False}
(out/'eyelid_report.json').write_text(json.dumps(report,indent=2));print('V011_LIDS_SAVED')
