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
        for obj,hidden in saved:
            # A rig bake may replace temporary proxy meshes. Deleted RNA
            # handles have no visibility to restore; retain all surviving ones.
            try:obj.hide_viewport=hidden
            except ReferenceError:pass
        bpy.context.view_layer.update()
