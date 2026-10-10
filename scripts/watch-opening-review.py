"""Compatibility entry point for the storage-only, leased review recovery.

Use --watch-seconds (0..7200); S3_* environment or --credentials supplies storage
access. Existing GPU jobs are never resubmitted and no provider API is called.
"""
import runpy
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('resume-opening-from-storage.py')), run_name='__main__')
