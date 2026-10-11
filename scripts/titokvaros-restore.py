"""Restore immutable Titokvaros sources after scratch loss, with SHA verification.
Read-only against R2. No provider submission, billing, or old-series access.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

import boto3

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'native/S1E1/TITOKVAROS/V001/'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', required=True, help='Protected config outside Git')
    parser.add_argument('--out', default=str(ROOT / 'data/titokvaros/restored'))
    parser.add_argument('--all', action='store_true', help='Restore every registered original Titokvaros artifact')
    parser.add_argument('files', nargs='*', help='Exact filenames from ops/titokvaros-artifacts.json')
    args = parser.parse_args()
    if bool(args.all) == bool(args.files):
        parser.error('Choose exact filenames OR --all')
    records = json.loads((ROOT / 'ops/titokvaros-artifacts.json').read_text())
    known = {}
    for record in records:
        key = record['key']
        name = key.removeprefix(PREFIX)
        if not key.startswith(PREFIX) or '/' in name or '\\' in name or name in {'.', '..', ''}:
            raise ValueError('Unexpected artifact path; no download attempted')
        if record.get('readback_verified') is not True:
            raise ValueError('Registry includes an unverified artifact')
        known[name] = record
    names = sorted(known) if args.all else list(dict.fromkeys(args.files))
    if any(name not in known for name in names):
        raise ValueError('Unknown artifact name; inspect the Git registry')
    config = json.loads(Path(args.config).read_text())
    client = boto3.client('s3', endpoint_url=config['S3_ENDPOINT'],
        aws_access_key_id=config['S3_ACCESS_KEY_ID'],
        aws_secret_access_key=config['S3_SECRET_ACCESS_KEY'], region_name='auto')
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    report = []
    for name in names:
        item = known[name]
        dest = out / name
        if dest.exists():
            if dest.is_symlink() or dest.stat().st_size != item['bytes'] or digest(dest) != item['sha256']:
                raise ValueError('Refusing to overwrite different local content: ' + name)
        else:
            partial = out / (name + '.download')
            # Exclusive local creation also prevents following an existing symlink.
            with partial.open('xb') as stream:
                client.download_fileobj(config['S3_BUCKET'], item['key'], stream)
            if partial.stat().st_size != item['bytes'] or digest(partial) != item['sha256']:
                raise ValueError('Downloaded file failed verification; partial retained: ' + name)
            # Atomic no-clobber publication on the same filesystem.
            os.link(partial, dest)
            partial.unlink()
        report.append({'file': name, 'bytes': item['bytes'], 'sha256_verified': True})
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
