"""Render the actual textured GLB files for visual review; never alter identity."""
import os
os.environ.setdefault('PYOPENGL_PLATFORM','egl')
from pathlib import Path
import json, argparse, math
import numpy as np
import trimesh, pyrender
from PIL import Image, ImageDraw

def camera_pose(eye, target):
    z=eye-target; z=z/np.linalg.norm(z)
    x=np.cross([0,1,0],z); x=x/np.linalg.norm(x); y=np.cross(z,x)
    pose=np.eye(4); pose[:3,:3]=np.column_stack((x,y,z)); pose[:3,3]=eye; return pose

def review(source, out):
    asset=trimesh.load(source,force='scene',process=False)
    bbox=asset.bounds; center=bbox.mean(axis=0); radius=float(np.max(bbox[1]-bbox[0])); target=center
    metadata={'filename':source.name,'bounds':bbox.tolist(),'geometries':[],'status':'VISUAL_REVIEW_REQUIRED','rig_ready':False}
    for name,geo in asset.geometry.items():
        metadata['geometries'].append({'name':name,'vertices':len(geo.vertices),'triangles':len(geo.faces),'watertight':bool(geo.is_watertight),'texture_kind':geo.visual.kind})
    sheet=Image.new('RGB',(512*4,560),(24,29,38));draw=ImageDraw.Draw(sheet)
    renderer=pyrender.OffscreenRenderer(512,512)
    try:
        for index,(label,degrees) in enumerate([('FRONT',0),('THREE-QUARTER',45),('SIDE',90),('BACK',180)]):
            scene=pyrender.Scene(bg_color=[.08,.1,.14,1],ambient_light=[.65,.65,.65])
            for node in asset.graph.nodes_geometry:
                transform,geometry=asset.graph[node]
                scene.add(pyrender.Mesh.from_trimesh(asset.geometry[geometry],smooth=False),pose=transform)
            angle=math.radians(degrees);eye=center+np.array([math.sin(angle)*radius*2, radius*.10, math.cos(angle)*radius*2])
            pose=camera_pose(eye,target)
            scene.add(pyrender.OrthographicCamera(xmag=radius*.62,ymag=radius*.62,znear=.01,zfar=100),pose=pose)
            scene.add(pyrender.DirectionalLight(color=[1,1,1],intensity=2.2),pose=pose)
            color,_=renderer.render(scene)
            sheet.paste(Image.fromarray(color[:,:,:3]),(index*512,36))
            draw.text((index*512+16,12),f'{source.stem} | {label}',fill='white')
        sheet.save(out/(source.stem+'_review.png'))
        (out/(source.stem+'_geometry.json')).write_text(json.dumps(metadata,indent=2))
    finally: renderer.delete()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory');args=parser.parse_args();out=Path(args.directory)
    for source in sorted(out.glob('*.glb')): review(source,out);print('Rendered',source.name,flush=True)
