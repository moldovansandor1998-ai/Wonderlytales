FROM pytorch/pytorch:2.6.0-cuda12.4-cudnn9-devel
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 \
    TORCH_CUDA_ARCH_LIST="8.0" MAX_JOBS=2 CUDA_HOME=/usr/local/cuda \
    OPENCV_IO_ENABLE_OPENEXR=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True \
    PYTHONPATH=/opt/trellis2 HF_HOME=/tmp/huggingface
RUN apt-get update && apt-get install -y --no-install-recommends \
    git build-essential cmake ninja-build libjpeg-dev libpng-dev libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN git clone --recursive https://github.com/microsoft/TRELLIS.2.git /opt/trellis2 \
    && cd /opt/trellis2 && git checkout 75fbf0183001ed9876c8dbb35de6b68552ee08bd \
    && git submodule update --init --recursive
RUN pip install --no-cache-dir imageio imageio-ffmpeg tqdm easydict opencv-python-headless \
    ninja trimesh transformers==4.57.1 gradio==6.0.1 tensorboard pandas lpips zstandard \
    pillow kornia timm runpod==1.7.13 boto3==1.35.99 \
    git+https://github.com/EasternJournalist/utils3d.git@9a4eb15e4021b67b12c460c7057d642626897ec8
RUN pip install flash-attn==2.7.3 --no-build-isolation
RUN git clone -b v0.4.0 https://github.com/NVlabs/nvdiffrast.git /opt/nvdiffrast \
    && pip install /opt/nvdiffrast --no-build-isolation
RUN git clone -b renderutils https://github.com/JeffreyXiang/nvdiffrec.git /opt/nvdiffrec \
    && pip install /opt/nvdiffrec --no-build-isolation
RUN git clone --recursive https://github.com/JeffreyXiang/CuMesh.git /opt/CuMesh \
    && pip install /opt/CuMesh --no-build-isolation
RUN git clone --recursive https://github.com/JeffreyXiang/FlexGEMM.git /opt/FlexGEMM \
    && pip install /opt/FlexGEMM --no-build-isolation \
    && pip install /opt/trellis2/o-voxel --no-build-isolation
WORKDIR /opt/wonderly
COPY worker/authoring/handler.py /opt/wonderly/handler.py
COPY production/references/V004/manifest.json /opt/wonderly/manifest.json
RUN python -m py_compile handler.py
# No token or model weights in the image. GPU work begins only on an explicit job.
CMD ["python", "-u", "/opt/wonderly/handler.py"]
