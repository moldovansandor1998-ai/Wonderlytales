import bpy,sys,time
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();out=root/'episode-v016';frames=out/'intro_frames';frames.mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(out/'S1E1_NATIVE_ANIMATED_INTRO_V016.blend'))
s=bpy.context.scene;s.render.use_compositing=True;s.use_nodes=True;n=s.node_tree.nodes;n.clear();r=n.new('CompositorNodeRLayers');g=n.new('CompositorNodeGlare');g.glare_type='FOG_GLOW';g.quality='HIGH';g.threshold=1.;g.size=7;o=n.new('CompositorNodeComposite');s.node_tree.links.new(r.outputs['Image'],g.inputs['Image']);s.node_tree.links.new(g.outputs['Image'],o.inputs['Image'])
s.render.use_persistent_data=True
bpy.ops.wm.save_as_mainfile(filepath=str(out/'S1E1_NATIVE_ANIMATED_INTRO_V016.blend'),compress=True)
for i,f in enumerate(range(1,361,2)):
 dest=frames/f'{i+1:04}.png'
 if dest.exists():continue
 s.frame_set(f);s.render.filepath=str(dest);t=time.time();bpy.ops.render.render(write_still=True);print('NATIVE_FRAME',i+1,f,round(time.time()-t,2),flush=True)
