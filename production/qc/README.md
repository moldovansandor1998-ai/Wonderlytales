# Native character review

`build_gltf_body_rig.py` creates an explicitly unapproved body-skin prototype from the real V005 GLBs. It preserves the input texture/geometry identity and validates normalized skin weights and nonzero pose deformation. `native_body_profiles.py` contains approximate body joints, not approved production anatomy. Facial rigging, retopology and eye controls remain absent.

`render_native_mesh_review.py` renders actual textured surfaces via Mesa EGL. The tested local environment uses trimesh 5.1.1, pyrender 0.1.45 and PyOpenGL 3.1.10. Pyrender declares PyOpenGL 3.1.0, whose texture upload fails on the Python 3.12 environment; the tested override must be installed separately.

Binary character outputs remain outside Git. No output from these scripts may automatically become LOCKED or production approved.
