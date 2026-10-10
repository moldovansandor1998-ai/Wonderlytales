"""Compatibility entry point for the frozen V024 storage-only assembly.

Provider submit/poll operations have been retired for this existing review.
Use --watch-seconds (0..7200) and S3_* environment or --credentials. The same
exclusive lease and completed-movie reuse apply to every recovery entry point.
"""
import runpy
from pathlib import Path

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('resume-opening-from-storage.py')), run_name='__main__')
