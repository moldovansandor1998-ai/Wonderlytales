#!/usr/bin/env python3
"""
Wonderly Tales – Blender render worker (proxy pipeline, Blender 4.5 LTS).

Input JSON (SHOT_SCHEMA_V1) → validálás → asset resolution → scene setup →
character/prop placement → animáció → kamera → fény → render → result JSON.

Futtatás:
  blender --background --python blender_worker.py -- --input fixtures/shot_sh001.json --output out/
  python3 blender_worker.py --input fixtures/shot_sh001.json --output out/ --mock
"""
import argparse, json, math, os, sys, time

REQUIRED_TOP = ["schema_version","shot_id","episode_id","scene_id","shot_number","status","duration_sec","location","characters","props","dialogue","camera","lighting","render","qc"]

def validate_shot(shot: dict) -> list[str]:
    errors = []
    for k in REQUIRED_TOP:
        if k not in shot: errors.append(f"hiányzó mező: {k}")
    if shot.get("schema_version") != "SHOT_SCHEMA_V1": errors.append("ismeretlen schema_version")
    for ch in shot.get("characters", []):
        if not str(ch.get("asset_version","")).startswith("V"): errors.append(f"rossz asset_version: {ch.get('asset_id')}")
    return errors

# Proxy karakter színek – vizuálisan megkülönböztethetők
CHAR_COLORS = {"CHAR_MARK": (0.9,0.25,0.2,1), "CHAR_LILI": (0.95,0.5,0.1,1), "CHAR_MORZSI": (0.45,0.3,0.18,1),
               "CHAR_POTTY": (0.95,0.95,0.95,1), "CHAR_BOGYO": (0.75,0.6,0.4,1), "CHAR_ZIZI": (0.4,0.5,0.65,1)}
CHAR_SHAPES = {"CHAR_MARK": ("sphere", 1.0), "CHAR_LILI": ("cone", 0.9), "CHAR_MORZSI": ("sphere", 1.6),
               "CHAR_POTTY": ("cone", 0.6), "CHAR_BOGYO": ("cube", 0.7), "CHAR_ZIZI": ("sphere", 0.85)}

def _mat(color):
    import bpy
    m = bpy.data.materials.new("m"); m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = color
    m.diffuse_color = color  # workbench MATERIAL/DIFFUSE megjelenítéshez
    return m

def build_scene_blender(shot: dict, out_dir: str) -> tuple[str, int]:
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    r = shot["render"]
    sc.render.resolution_x = min(r["width"], 960)   # proxy preview felbontás
    sc.render.resolution_y = min(r["height"], 540)
    sc.render.fps = r["fps"]
    try: sc.render.image_settings.color_depth = "8"
    except Exception: pass
    sc.render.resolution_percentage = 60
    # Workbench preview: gyors, színes anyagokkal (EEVEE production/finalhez; CPU sandboxban lassú)
    sc.render.engine = "BLENDER_WORKBENCH"
    try:
        sc.display.shading.light = "STUDIO"
        sc.display.shading.color_type = "DIFFUSE" if hasattr(sc.display.shading, "color_type") else "MATERIAL"
        sc.display.shading.show_shadows = True
    except Exception: pass
    except Exception: sc.render.engine = "BLENDER_EEVEE"

    # talaj + erdő-hangulat proxy
    bpy.ops.mesh.primitive_plane_add(size=30)
    ground = bpy.context.object; ground.name = "GROUND"; ground.data.materials.append(_mat((0.12,0.22,0.1,1)))
    for i in range(5):  # proxy fák
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.8, depth=3, location=(-4 + i*2.2, 3 + (i%2), 1.5))
        bpy.context.object.name = f"TREE_{i}"; bpy.context.object.data.materials.append(_mat((0.1,0.35,0.12,1)))

    frames = max(2, int(shot["duration_sec"] * r["fps"]))
    # karakterek – shot JSON pozíció + egyszerű animáció (walk = X mozgás, idle = lélegzés-skalázás)
    for ch in shot.get("characters", []):
        aid = ch.get("asset_id","")
        base = aid.split("_V")[0]
        shape, scale = CHAR_SHAPES.get(base, ("sphere", 1.0))
        pos = ch.get("position", [0,0,0])
        loc = (pos[0], pos[2], pos[1] + scale)  # JSON [x,y,z] → Blender (x, z, y+magasság)
        if shape == "cone": bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.5*scale, depth=1.4*scale, location=loc)
        elif shape == "cube": bpy.ops.mesh.primitive_cube_add(size=0.8*scale, location=loc)
        else: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5*scale, location=loc)
        obj = bpy.context.object; obj.name = aid
        obj.data.materials.append(_mat(CHAR_COLORS.get(base, (0.7,0.7,0.7,1))))
        anim = ch.get("animation_code") or "idle_breathe"
        obj.keyframe_insert("location", frame=1)
        if anim.startswith("walk") or anim.startswith("run"):
            obj.location.x += 0.8 if anim.startswith("walk") else 1.6
            obj.keyframe_insert("location", frame=frames)
        elif anim.startswith("idle"):
            obj.scale = (1,1,1); obj.keyframe_insert("scale", frame=1)
            obj.scale = (1.04,1.04,0.97); obj.keyframe_insert("scale", frame=frames//2)
            obj.scale = (1,1,1); obj.keyframe_insert("scale", frame=frames)
    for pr in shot.get("props", []):
        ppos = pr.get("position", [0,0,0.2])
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.25, location=(ppos[0], ppos[2], ppos[1]+0.25))
        obj = bpy.context.object; obj.name = pr.get("asset_id","PROP")
        glowing = pr.get("state") in ("GLOWING","ACTIVE")
        obj.data.materials.append(_mat((1.0,0.9,0.3,1) if glowing else (0.5,0.5,0.6,1)))
        if glowing:
            ld = bpy.data.lights.new("PROP_GLOW","POINT"); ld.energy = 60; ld.color=(1,0.85,0.4)
            lo = bpy.data.objects.new("PROP_GLOW", ld); sc.collection.objects.link(lo); lo.location = obj.location

    # kamera: shot JSON lens + shot type alapú távolság
    dist_map = {"EXTREME_WIDE": 14, "WIDE": 8, "MEDIUM_WIDE": 5.5, "MEDIUM": 4, "MEDIUM_CLOSE": 3, "CLOSE_UP": 2, "EXTREME_CLOSE_UP": 1.2, "OVER_SHOULDER": 2.8, "POV": 2.5, "AERIAL": 12}
    dist = dist_map.get(shot["camera"].get("shot_type","MEDIUM"), 4)
    cam_data = bpy.data.cameras.new("ShotCam"); cam_data.lens = shot["camera"].get("lens_mm", 35)
    cam = bpy.data.objects.new("ShotCam", cam_data); sc.collection.objects.link(cam)
    cam.location = (0, -dist, 1.8 if shot["camera"].get("shot_type") != "AERIAL" else 8)
    cam.rotation_euler = (math.radians(78), 0, 0); sc.camera = cam

    # fény preset
    preset = shot["lighting"]["preset"]
    sun = bpy.data.lights.new("Sun","SUN")
    sun.energy = {"DAY":3.0,"SUNSET":1.8,"NIGHT":0.25,"RAIN":1.0,"WINTER":2.2,"INTERIOR":1.5,"MAGICAL":2.5}.get(preset, 3.0)
    sun.color = {"DAY":(1,0.98,0.9),"SUNSET":(1,0.6,0.35),"NIGHT":(0.4,0.5,1),"MAGICAL":(0.7,0.6,1)}.get(preset,(1,1,1))
    so = bpy.data.objects.new("Sun", sun); sc.collection.objects.link(so); so.rotation_euler=(0.8,0.2,0.4)
    world = bpy.data.worlds.new("W"); sc.world = world
    world.color = (0.05,0.08,0.15) if preset == "NIGHT" else (0.35,0.5,0.7)

    sc.frame_start, sc.frame_end = 1, frames
    q = r.get("quality","PREVIEW")
    if q == "PREVIEW":
        out = os.path.join(out_dir, f"{shot['shot_id']}_r{shot.get('revision',1)}.mp4")
        sc.render.filepath = out; sc.render.image_settings.file_format = "FFMPEG"; sc.render.ffmpeg.format = "MPEG4"
        bpy.ops.render.render(animation=True)
    else:
        out = os.path.join(out_dir, f"{shot['shot_id']}_r{shot.get('revision',1)}_####.png")
        sc.render.filepath = out; sc.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(animation=True)
    return out, frames

def build_scene_mock(shot: dict, out_dir: str) -> tuple[str, int]:
    """CI fallback Blender nélkül: szöveges render-leírás (a valódi render a bpy ág)."""
    time.sleep(0.1)
    frames = int(shot["duration_sec"] * shot["render"]["fps"])
    out = os.path.join(out_dir, f"{shot['shot_id']}_r{shot.get('revision',1)}_mock.txt")
    with open(out, "w") as f:
        f.write(f"MOCK RENDER shot={shot['shot_id']} frames={frames} camera={shot['camera']['shot_type']} light={shot['lighting']['preset']}\n")
        for ch in shot.get("characters", []): f.write(f"char {ch['asset_id']}@{ch['asset_version']} pos={ch['position']} anim={ch.get('animation_code')}\n")
    return out, frames

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True); ap.add_argument("--output", required=True)
    ap.add_argument("--mock", action="store_true")
    args = ap.parse_args()
    with open(args.input) as f: shot = json.load(f)
    os.makedirs(args.output, exist_ok=True)
    errors = validate_shot(shot)
    if errors:
        print(json.dumps({"status":"FAILED","output":None,"frames":0,"duration_sec":shot.get("duration_sec",0),"render_sec":0,"renderer":"none","error":"; ".join(errors)})); sys.exit(2)
    use_mock = args.mock
    if not use_mock:
        try: import bpy  # noqa
        except ImportError: use_mock = True
    t0 = time.time()
    out, frames = build_scene_mock(shot, args.output) if use_mock else build_scene_blender(shot, args.output)
    print(json.dumps({"status":"SUCCEEDED","output":out,"frames":frames,"duration_sec":shot["duration_sec"],"render_sec":round(time.time()-t0,2),"renderer":"mock" if use_mock else "blender","error":None}))

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    sys.argv = [sys.argv[0]] + argv
    main()
