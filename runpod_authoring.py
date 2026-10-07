"""Root-level RunPod entry point for the native character authoring container."""
import runpod
from handler import handler

if __name__ == '__main__':
    runpod.serverless.start({'handler': handler})
