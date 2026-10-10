"""Bound expensive dependency-graph work while baking rig-only controls."""
from contextlib import contextmanager

@contextmanager
def rig_only_evaluation(scene):
    """Temporarily skip mesh evaluation; restore every original visibility flag."""
    import bpy
    saved=[(obj,obj.hide_viewport) for obj in scene.objects if obj.type=='MESH']
    try:
        for obj,_ in saved:obj.hide_viewport=True
        bpy.context.view_layer.update()
        yield
    finally:
        for obj,hidden in saved:obj.hide_viewport=hidden
        bpy.context.view_layer.update()
