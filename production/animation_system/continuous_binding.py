"""Continuous anatomical binding, without inherited ear/tail label cutoffs.

Candidate authoring only. Does not change geometry, shape keys or rig controls.
Unlike mesh diffusion, the result is a smooth function of rest coordinates and
bone segments; adjacent points cannot retain different legacy protected masses.
"""
import numpy as np


def ease(value):
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


def segment_weights(points, segments, radius=0.025):
    distances = []
    for start, end in segments:
        start, end = np.asarray(start), np.asarray(end)
        axis = end - start
        along = np.clip((points - start) @ axis / max(float(axis @ axis), 1e-12), 0, 1)
        distances.append(np.linalg.norm(points - start - along[:, None] * axis, axis=1))
    values = (np.array(distances).T + radius) ** -4
    return values / values.sum(axis=1, keepdims=True)


def rebind_body(body, rig, code, head_floor, quadruped=False, profile='anatomical'):
    if profile not in ('segments', 'attachment', 'anatomical'):
        raise ValueError('Unknown binding profile')
    bones = [b for b in rig.data.bones if b.use_deform
             and b.name not in ('root', 'jaw', 'eye.L', 'eye.R')]
    names = [b.name for b in bones]
    points = np.array([v.co[:] for v in body.data.vertices])
    weights = segment_weights(points, [(b.head_local[:], b.tail_local[:]) for b in bones])
    # Appendages cannot pull the face or the opposite side of the trunk. These
    # rest-space attachment envelopes remain C1 continuous at their limits.
    for j, bone in enumerate(bones) if profile != 'segments' else []:
        if bone.name.startswith('tail'):
            base = rig.data.bones['tail_01'].head_local
            weights[:, j] *= ease((points[:, 1] - base.y + .04) / .10)
        elif bone.name.startswith('ear'):
            side=bone.name.rsplit('.',1)[-1]
            root=rig.data.bones.get('ear_base.'+side) or rig.data.bones.get('ear.'+side) or bone
            base = root.head_local
            weights[:, j] *= ease((points[:, 2] - base.z + .04) / .08)
    weights /= weights.sum(axis=1, keepdims=True)
    # Head replaces only the continuously computed trunk/limb influence. Ears
    # and tail keep their smooth anatomical envelopes, with no height cutoff.
    appendage = np.array([n.startswith(('ear', 'tail')) for n in names])
    mask = (ease((points[:, 2] - (head_floor - .065)) / .065)
            if profile != 'segments' else ease((points[:, 2] - head_floor) / .045))
    if quadruped and profile=='anatomical':
        start=rig.data.bones['neck'].head_local.z
        end=rig.data.bones['head'].head_local.z-.02
        mask=ease((points[:,2]-start)/max(.08,end-start))
    if quadruped:
        mask *= ease((.08 - points[:, 1]) / .06)
    mass = weights[:, ~appendage].sum(axis=1)
    weights[:, ~appendage] *= (1 - mask[:, None])
    weights[:, names.index('head')] += mass * mask
    if quadruped:
        for part in ('fore', 'hind'):
            for side in ('L', 'R'):
                upper, lower, paw = [names.index(part + p + '.' + side) for p in ('leg', 'shin', 'paw')]
                joint = rig.data.bones[names[lower]].head_local.z
                top = rig.data.bones[names[upper]].head_local.z
                ankle = rig.data.bones[names[paw]].head_local.z
                foot = 1 - ease((points[:, 2] - ankle) / max(.025, joint - ankle))
                thigh = ease((points[:, 2] - joint) / max(.025, (top - joint) * .7))
                leg = weights[:, [upper, lower, paw]].sum(axis=1)
                weights[:, upper] = leg * (1 - foot) * thigh
                weights[:, lower] = leg * (1 - foot) * (1 - thigh)
                weights[:, paw] = leg * foot
    if not np.isfinite(weights).all() or not np.allclose(weights.sum(axis=1), 1):
        raise ValueError('Invalid continuous binding')
    # Preserve all group identities and every existing shape key. Only deform
    # weights are replaced; non-deform groups remain available to other tools.
    deform = {b.name for b in rig.data.bones if b.use_deform}
    ids = list(range(len(points)))
    for group in body.vertex_groups:
        if group.name in deform:
            group.remove(ids)
    for j, name in enumerate(names):
        group = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
        for i, weight in enumerate(weights[:, j]):
            group.add([i], float(weight), 'REPLACE')
    return {'revision': 'V024_CONTINUOUS_SEGMENTS', 'profile': profile, 'vertices': len(points),
            'bones': names, 'geometry_changed': False, 'shape_keys_preserved': True,
            'legacy_appendage_mass_preserved': False, 'production_approved': False}
