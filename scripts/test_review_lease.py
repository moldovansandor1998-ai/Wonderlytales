import io
import json
import time
import unittest
from botocore.exceptions import ClientError
from review_lease import ReviewLease


class S3:
    def __init__(self):
        self.body = None
        self.rev = 0
        self.race = False

    def get_object(self, **args):
        if self.body is None:
            raise ClientError({'Error': {'Code': 'NoSuchKey'}}, 'GetObject')
        return {'Body': io.BytesIO(self.body), 'ETag': str(self.rev)}

    def put_object(self, **args):
        if self.race or (args.get('IfNoneMatch') == '*' and self.body is not None) or ('IfMatch' in args and args['IfMatch'] != str(self.rev)):
            raise ClientError({'Error': {'Code': 'PreconditionFailed'}}, 'PutObject')
        self.body = args['Body']
        self.rev += 1
        return {'ETag': str(self.rev)}


class LeaseTest(unittest.TestCase):
    def setUp(self):
        self.client = S3()
        self.first = ReviewLease(self.client, 'bucket', 'key')
        self.second = ReviewLease(self.client, 'bucket', 'key')

    def test_live_owner_excludes_second_watcher(self):
        self.first.renew()
        with self.assertRaises(RuntimeError):
            self.second.renew()

    def test_stale_writer_cannot_win_conditional_claim(self):
        self.client.race = True
        with self.assertRaises(ClientError):
            self.first.renew()
        self.assertIsNone(self.first.etag)

    def test_expired_lease_is_recoverable(self):
        self.first.renew()
        self.client.body = json.dumps({'owner': self.first.owner, 'expires_at': time.time()-1}).encode()
        self.second.renew()
        self.assertEqual(json.loads(self.client.body)['owner'], self.second.owner)

    def test_old_owner_cannot_release_successor(self):
        self.test_expired_lease_is_recoverable()
        self.first.release()
        self.assertEqual(json.loads(self.client.body)['owner'], self.second.owner)

    def test_clean_release_permits_immediate_resume(self):
        self.first.renew()
        self.first.release()
        self.second.renew()
        self.assertEqual(json.loads(self.client.body)['owner'], self.second.owner)


if __name__ == '__main__':
    unittest.main()
