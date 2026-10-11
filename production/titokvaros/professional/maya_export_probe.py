"""DRAFT adapter for mayapy; not runtime-tested until licensed Maya is available.

Uses Maya's FBX exporter, not a custom animation engine. An authored, skinned
character with a TV_EXPORT objectSet is required. Never overwrites the .ma/.mb.
Only skeleton/morph transport is attempted; materials/groom need separate tests.
"""
import argparse
import hashlib
import json
from pathlib import Path

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--scene', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--start', type=int, default=1001)
    p.add_argument('--end', type=int, default=1072)
    a = p.parse_args()
    if not a.scene.is_file() or a.scene.suffix.lower() not in ('.ma', '.mb'):
        p.error('An actual authored Maya scene is required.')
    if a.end < a.start or a.end-a.start+1 > 720:
        p.error('Probe must contain 1–720 frames.')
    if a.output.exists():
        p.error('Use a new output directory; existing evidence is immutable.')
    import maya.standalone
    maya.standalone.initialize(name='python')
    from maya import cmds, mel
    try:
        cmds.loadPlugin('fbxmaya', quiet=True)
        cmds.file(str(a.scene.resolve()), open=True, force=True, executeScriptNodes=False)
        if cmds.currentUnit(query=True, linear=True) != 'cm' or cmds.currentUnit(query=True, time=True) != 'film':
            raise ValueError('Authoring scene must explicitly use centimetres and 24fps; no silent conversion.')
        members = cmds.sets('TV_EXPORT', query=True) or []
        joints = cmds.ls(members, dag=True, type='joint', long=True) or []
        meshes = cmds.ls(members, dag=True, type='mesh', long=True, noIntermediate=True) or []
        roots = [j for j in joints if not cmds.listRelatives(j, parent=True, type='joint')]
        if not meshes or len(roots) != 1:
            raise ValueError('TV_EXPORT must contain meshes and exactly one skeleton root.')
        history = {m: cmds.listHistory(m, pruneDagObjects=True) or [] for m in meshes}
        if any(not cmds.ls(nodes, type='skinCluster') for nodes in history.values()):
            raise ValueError('Each exported mesh requires an authored skinCluster.')
        if any(not cmds.polyEvaluate(m, uvcoord=True) for m in meshes):
            raise ValueError('Missing UV set.')
        blends = sorted(set(cmds.ls([n for nodes in history.values() for n in nodes], type='blendShape') or []))
        if not blends:
            raise ValueError('Facial blend shapes are required for this compatibility probe.')
        a.output.mkdir(parents=True)
        fbx = (a.output / 'FELIX_exchange.fbx').resolve()
        cmds.bakeResults(joints+blends, time=(a.start,a.end), sampleBy=1,
                         simulation=True, sparseAnimCurveBake=False, preserveOutsideKeys=True)
        mel.eval('FBXResetExport;')
        for command in ['FBXExportSkins -v true;', 'FBXExportShapes -v true;',
                        'FBXExportConstraints -v false;', 'FBXExportCameras -v false;',
                        'FBXExportLights -v false;', 'FBXExportEmbeddedTextures -v false;',
                        'FBXExportBakeComplexAnimation -v true;',
                        f'FBXExportBakeComplexStart -v {a.start};',
                        f'FBXExportBakeComplexEnd -v {a.end};', 'FBXExportBakeComplexStep -v 1;']:
            mel.eval(command)
        cmds.select(members, replace=True)
        mel.eval('FBXExport -f '+json.dumps(fbx.as_posix())+' -s;')
        if not fbx.is_file() or fbx.stat().st_size == 0:
            raise RuntimeError('Maya did not produce an FBX file.')
        report = {'kind':'MAYA_FBX_EXPORT_ONLY', 'maya_version':cmds.about(version=True),
                  'fbx_plugin_version':cmds.pluginInfo('fbxmaya',query=True,version=True),
                  'source_sha256':hashlib.sha256(a.scene.read_bytes()).hexdigest(),
                  'fbx_sha256':hashlib.sha256(fbx.read_bytes()).hexdigest(),
                  'fps':24, 'start':a.start, 'end':a.end, 'joints':joints, 'roots':roots,
                  'meshes':meshes, 'blendshape_aliases':{b:cmds.aliasAttr(b,query=True) or [] for b in blends},
                  'unreal_import_tested':False, 'groom_material_tested':False,
                  'production_approved':False}
        (a.output/'maya_export.json').write_text(json.dumps(report,indent=2)+'\n')
    finally:
        maya.standalone.uninitialize()

if __name__ == '__main__':
    main()
