"""Apply source-preserving V025 facial repairs to a separate existing scene."""
import bpy,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from animation_system.spec import digest,atomic_json
from animation_system.facial_seams import repair_eyelid
from animation_system.seam_edges import coalesce_existing_seams
from animation_system.gaze import stabilize_sclera,bake_bounded_gaze
from animation_system.facial_substrate import create_eye_substrate
from animation_system.recover_facial_edges import recover_eye_faces
from animation_system.mouth_support import connect_oral_skin
from animation_system.facial_fur import add_lid_fur
from animation_system.evaluation import rig_only_evaluation


def main(source,dest):
    if source.resolve()==dest.resolve() or dest.exists():raise ValueError('New candidate output required')
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()),use_scripts=False);scene=bpy.context.scene;scene.frame_set(1)
    rigs={o.get('character_code'):o for o in scene.objects if o.type=='ARMATURE' and o.get('character_code')};report={'source_sha256':digest(source),'characters':{},'production_approved':False}
    for code,rig in rigs.items():
        if code not in ('CHAR_MARK','CHAR_LILI'):continue
        body=max((o for o in scene.objects if o.type=='MESH' and o.parent==rig),key=lambda o:len(o.data.vertices));entry={}
        if bpy.data.objects[code+'_EYELID.R'].get('topology_revision')!='V025_SHARED_SOURCE_PERIMETER':
            stabilize_sclera(code,rig)
            if code=='CHAR_LILI':entry['source_recovery']=recover_eye_faces(body,rig,code)
            entry['eyes']=[]
            for side in ('R','L'):
                skin,skin_report=create_eye_substrate(scene,body,rig,code,side) if code=='CHAR_LILI' else (body,{})
                entry['eyes'].append({'skin':skin_report,'seam':repair_eyelid(scene,code,rig,skin,side)})
            if code=='CHAR_MARK':entry['seam_coalescing']=coalesce_existing_seams(body)
        if code=='CHAR_LILI':
            bpy.context.view_layer.update()
            entry['fur']=[add_lid_fur(scene,rig,bpy.data.objects[code+'_EYELID.'+side],25025+i) for i,side in enumerate(('R','L'))]
        entry['mouth']=connect_oral_skin(scene,code,rig,body);report['characters'][code]=entry
    with rig_only_evaluation(scene):bake_bounded_gaze(scene,rigs)
    scene.frame_set(1);dest.parent.mkdir(parents=True,exist_ok=True);scene['production_approved']=False
    bpy.ops.wm.save_as_mainfile(filepath=str(dest.resolve()),compress=True);report['candidate_sha256']=digest(dest);atomic_json(dest.with_suffix('.faces.json'),report);print('V025_FACES',json.dumps(report),flush=True)

if __name__=='__main__':main(*map(Path,sys.argv[sys.argv.index('--')+1:]))
