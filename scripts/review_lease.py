"""Conditional R2 ownership for the existing bounded storage-only review watcher."""
import atexit
import json
import time
import uuid
from botocore.exceptions import ClientError


class ReviewLease:
    def __init__(self, client, bucket, key, ttl=600):
        self.client, self.bucket, self.key = client, bucket, key
        self.ttl, self.owner, self.etag = ttl, str(uuid.uuid4()), None

    def renew(self):
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=self.key)
            doc = json.loads(response['Body'].read())
            etag = response['ETag']
        except ClientError as exc:
            if exc.response['Error']['Code'] not in ('NoSuchKey', '404'):
                raise
            doc, etag = None, None
        if doc and doc['owner'] != self.owner and doc['expires_at'] > time.time():
            raise RuntimeError('Another storage review watcher is active; no assembly started')
        args = {'IfMatch': etag} if etag else {'IfNoneMatch': '*'}
        data = {'owner': self.owner, 'expires_at': time.time() + self.ttl}
        self.etag = self.client.put_object(Bucket=self.bucket, Key=self.key,
            Body=json.dumps(data).encode(), ContentType='application/json', **args)['ETag']

    def release(self):
        if self.etag:
            try:
                self.client.put_object(Bucket=self.bucket, Key=self.key,
                    Body=json.dumps({'owner': self.owner, 'expires_at': 0}).encode(),
                    ContentType='application/json', IfMatch=self.etag)
            except ClientError:
                pass  # A successor or an outage must never cause a blind overwrite.
            self.etag = None

    def acquire(self):
        self.renew()
        atexit.register(self.release)
        return self
