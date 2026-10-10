"""A review video is never sufficient evidence for production release."""
def release_gate(registry,scene_qc,media_qc):
 reasons=[]
 if not registry.get('professional_quality_approved'):reasons.append('Master assets lack professional visual approval')
 for name,qc in scene_qc.items():
  if not qc.get('structural_qc_pass'):reasons.append(name+': native geometry or foot QC failed')
  if qc.get('engine')!='BLENDER_CYCLES_FINAL':reasons.append(name+': final native lighting was not rendered')
  if not qc.get('artist_approved'):reasons.append(name+': acting, speech and multicamera visual approval missing')
 if not scene_qc:reasons.append('No scene QC evidence')
 if not media_qc.get('decoded'):reasons.append('Complete decoding evidence missing')
 return {'approved':not reasons,'reasons':reasons}
