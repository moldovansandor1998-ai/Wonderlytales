"""Reusable, deterministic blink and partner-response timing.

The scene contract owns who is looking at whom. Listener gestures only respond
to that partner's dialogue, with a delay; speech audio and viseme timings stay
unchanged. Native application is opt-in on a separate candidate source.
"""
import math
import random
from .spec import smooth


def blink_times(duration, seed, gaze=(), dialogue=(), fps=24):
    rng=random.Random(seed)
    candidates=[]
    t=rng.uniform(1.8,3.4)
    while t<duration:
        candidates.append(t);t+=rng.uniform(3.4,6.8)
    candidates += [g['start']+.12 for g in gaze if g['start']>.5]
    candidates += [line['end']+.18 for line in dialogue]
    peaks=[]
    for t in sorted(candidates):
        t=round(t*fps)/fps
        if .25<t<duration-.2 and (not peaks or t-peaks[-1]>1.35):peaks.append(t)
    return peaks


def blink_value(t, peaks, side='R'):
    # Both lids close completely; opening takes longer than closing.
    delay=.008 if side=='L' else 0.
    value=0.
    for peak in peaks:
        dt=t-peak-delay
        if -.075<=dt<=.04:value=max(value,smooth((dt+.075)/.075))
        elif .04<dt<.17:value=max(value,1-smooth((dt-.04)/.13))
    return value


def listener_response(script, code, t):
    actor=next(a for a in script['characters'] if a['code']==code)
    gaze=next((g for g in actor.get('gaze',[]) if g['start']<=t<g['end']),None)
    pose={'head_pitch':0.,'spine_pitch':0.,'brow_up':0.,'smile':0.}
    if not gaze or gaze['target']==code:return pose
    # Avoid automatic nodding while the listener is speaking.
    if any(l['speaker']==code and l['start']<=t<l['end'] for l in script.get('dialogue',[])):return pose
    for line in script.get('dialogue',[]):
        if line['speaker']!=gaze['target']:continue
        dt=t-line['end']-.22
        if 0<dt<.9:
            pulse=math.sin(math.pi*dt/.9)**2
            pose['head_pitch']+=.022*pulse
            pose['spine_pitch']+=.005*pulse
            pose['brow_up']=max(pose['brow_up'],.10*pulse)
            pose['smile']=max(pose['smile'],.05*pulse)
    return pose


def apply_performance(scene, script, rigs):
    """Layer on existing native animation; never rewrite support/feet or audio."""
    import bpy
    schedules={}
    for i,code in enumerate(sorted(rigs)):
        actor=next(a for a in script['characters'] if a['code']==code)
        schedules[code]=blink_times(script['duration'],script.get('seed',21021)+i,actor.get('gaze',[]),[l for l in script.get('dialogue',[]) if l['speaker']==code])
    for frame in range(scene.frame_start,scene.frame_end+1):
        scene.frame_set(frame);t=(frame-1)/scene.render.fps
        for code,rig in rigs.items():
            for side in ('R','L'):
                prop='blink.'+side;rig[prop]=blink_value(t,schedules[code],side)
                rig.keyframe_insert('["'+prop+'"]',frame=frame)
            response=listener_response(script,code,t)
            for prop in ('brow_up','smile'):
                rig[prop]=max(float(rig.get(prop,0)),response[prop])
                rig.keyframe_insert('["'+prop+'"]',frame=frame)
            for bone,prop in (('CTRL_head','head_pitch'),('CTRL_spine','spine_pitch')):
                if bone not in rig.pose.bones:continue
                p=rig.pose.bones[bone];p.rotation_euler.x+=response[prop]
                p.keyframe_insert('rotation_euler',index=0,frame=frame)
    scene.frame_set(scene.frame_start)
    return {'blink_peaks_seconds':schedules,'partner_response_delay_seconds':.22,'audio_and_visemes_preserved':True,'foot_curves_preserved':True,'production_approved':False}
