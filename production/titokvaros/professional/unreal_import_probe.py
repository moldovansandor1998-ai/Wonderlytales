"""DRAFT Unreal Editor Python adapter. Runtime NOT tested in this environment.

TV_EXCHANGE_DIR points to one immutable output of maya_export_probe.py.
Imports into a content-hash namespace. Never replaces existing engine assets.
An import result is NOT rig, material, animation or feature-quality approval.
"""
import hashlib
import json
import os
from pathlib import Path
import unreal

package = Path(os.environ['TV_EXCHANGE_DIR']).resolve()
report = json.loads((package/'maya_export.json').read_text())
fbx = package/'FELIX_exchange.fbx'
digest = hashlib.sha256(fbx.read_bytes()).hexdigest()
if report.get('kind') != 'MAYA_FBX_EXPORT_ONLY' or digest != report.get('fbx_sha256'):
    raise RuntimeError('Missing or mismatched actual Maya export evidence.')
destination = '/Game/Titokvaros/Exchange/FX_' + digest[:16]
if unreal.EditorAssetLibrary.does_directory_exist(destination):
    raise RuntimeError('Import destination already exists. Inspect previous attempt; no automatic overwrite.')
options = unreal.FbxImportUI()
options.set_editor_property('automated_import_should_detect_type', False)
options.set_editor_property('mesh_type_to_import', unreal.FBXImportType.FBXIT_SKELETAL_MESH)
options.set_editor_property('import_as_skeletal', True)
options.set_editor_property('import_mesh', True)
options.set_editor_property('import_animations', True)
options.set_editor_property('import_materials', False)
options.set_editor_property('import_textures', False)
options.set_editor_property('create_physics_asset', False)
options.skeletal_mesh_import_data.set_editor_property('import_morph_targets', True)
task = unreal.AssetImportTask()
for name, value in {'filename':str(fbx), 'destination_path':destination,
                    'automated':True, 'replace_existing':False, 'save':True, 'options':options}.items():
    task.set_editor_property(name, value)
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
assets = []
for path in task.get_editor_property('imported_object_paths'):
    obj = unreal.load_asset(path)
    if obj:
        assets.append({'path':path, 'class':obj.get_class().get_name()})
classes = {a['class'] for a in assets}
result = {'kind':'UNREAL_IMPORT_INVENTORY_ONLY', 'engine_version':unreal.SystemLibrary.get_engine_version(),
          'fbx_sha256':digest, 'assets':assets,
          'import_produced_mesh_and_animation':{'SkeletalMesh','AnimSequence'}.issubset(classes),
          'pose_comparison_passed':False, 'morph_comparison_passed':False,
          'groom_material_tested':False, 'rendered_movie':None, 'production_approved':False}
with (package/'unreal_import.json').open('x') as handle:
    json.dump(result, handle, indent=2)
if not result['import_produced_mesh_and_animation']:
    raise RuntimeError('Unreal did not report both a skeletal mesh and an animation sequence.')
