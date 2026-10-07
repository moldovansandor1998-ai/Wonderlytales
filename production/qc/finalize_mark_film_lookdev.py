"""Remove failed seam relaxation and render an honest V013 draft checkpoint."""
import bpy, hashlib, json, sys
from pathlib import Path

source, destination = map(Path, sys.argv[sys.argv.index('--')+1:])
assert not destination.exists()
bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
s = bpy.context.scene
s.frame_set(1)
body = bpy.data.objects['geometry_0']
body.modifiers.remove(body.modifiers['V012 gentle cheek surface relaxation'])
body.vertex_groups.remove(body.vertex_groups['V012_Local_Surface_Relaxation'])
hair = bpy.data.materials['V012 brown hair surface'].node_tree.nodes.get('Principled BSDF')
hair.inputs['Roughness'].default_value = .5
s['status'] = 'DRAFT_FILM_LOOKDEV_V013_NOT_APPROVED'
s['production_approved'] = False
s['quality_gate_passed'] = False
s.render.resolution_percentage = 100
s.cycles.samples = 48
destination.mkdir(parents=True)
blend = destination/'CHAR_MARK_FILM_LOOKDEV_V013_DRAFT.blend'
s.render.filepath = str((destination/'Wonderly_Tales_Mark_V013_1080p_DRAFT.png').resolve())
bpy.ops.wm.save_as_mainfile(filepath=str(blend.resolve()),compress=True)
bpy.ops.render.render(write_still=True)
report = {'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'blend_sha256':hashlib.sha256(blend.read_bytes()).hexdigest(),
 'resolution':[s.render.resolution_x,s.render.resolution_y],
 'native_vertices':len(body.data.vertices),
 'fine_hair_strands':len(bpy.data.objects['V012_HEAD_HAIR_FINE_STRANDS'].data.splines),
 'failed_surface_relaxation_removed':True,'production_approved':False,
 'quality_gate_passed':False,
 'remaining':['hair sculpt too chunky for approved reference','eye socket/lid transition remains draft',
              'lip corners and skin topology need authored sculpt and retopology',
              'not a final film character or complete cartoon']}
(destination/'lookdev_manifest.json').write_text(json.dumps(report,indent=2))
print('V013_RENDERED',json.dumps(report))
