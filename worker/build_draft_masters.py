"""Bake immutable, draft-only character assets into the worker image."""
import os, sys
import bpy
sys.path.insert(0,os.path.dirname(__file__))
from storybook_scene import character,PALETTE
folder=os.path.join(os.path.dirname(__file__),'assets');os.makedirs(folder,exist_ok=True)
for code in ['CHAR_MARK','CHAR_LILI']:
    bpy.ops.wm.read_factory_settings(use_empty=True);PALETTE.clear()
    character(code,(0,0,0))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(folder,code+'_DRAFT_V002.blend'))
