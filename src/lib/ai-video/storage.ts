import { createHash } from 'crypto';
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireConfiguration } from '../config';
import { WaveSpeedError } from '../providers/wavespeed';
import type { VideoJob } from './shared';

export interface VersionedJob { job: VideoJob; etag: string; }
export interface VideoStore {
  read(id: string): Promise<VersionedJob | null>;
  claim(job: VideoJob): Promise<boolean>;
  save(job: VideoJob, etag: string): Promise<boolean>;
}
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
export function imageMetadata(b: Buffer): { width: number; height: number; mime: string } {
  let width = 0, height = 0, mime = '';
  if (b.length >= 33 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString('ascii',12,16) === 'IHDR') {
    width = b.readUInt32BE(16); height = b.readUInt32BE(20); mime = 'image/png';
  } else if (b.length >= 4 && b[0] === 255 && b[1] === 216) {
    let p = 2;
    while (p + 4 <= b.length) {
      if (b[p++] !== 255) break;
      while (b[p] === 255) p++;
      const marker = b[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (p + 2 > b.length) break;
      const length = b.readUInt16BE(p);
      if (length < 2 || p + length > b.length) break;
      if ([0xc0,0xc1,0xc2].includes(marker) && length >= 8) {
        height = b.readUInt16BE(p + 3); width = b.readUInt16BE(p + 5); mime = 'image/jpeg'; break;
      }
      p += length;
    }
  }
  if (!mime || width < 300 || height < 300 || width > 16000 || height > 16000 || width / height < 0.4 || width / height > 2.5)
    throw new WaveSpeedError('INVALID_IMAGE', 400);
  return { width, height, mime };
}
const status = (e: unknown) => (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
export class R2VideoStore implements VideoStore {
  private client: S3Client;
  private bucket: string;
  private prefix: string;
  constructor(owner: string) {
    if (!/^[A-Za-z0-9-]{1,80}$/.test(owner)) throw new WaveSpeedError('FORBIDDEN', 403);
    requireConfiguration('AI video R2', ['S3_ENDPOINT','S3_BUCKET','S3_ACCESS_KEY_ID','S3_SECRET_ACCESS_KEY']);
    this.client = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: 'auto', forcePathStyle: true,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } });
    this.bucket = process.env.S3_BUCKET!;
    this.prefix = `ai-video/wavespeed/v1/${owner}/`;
  }
  private jobKey(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new WaveSpeedError('INVALID_JOB', 400);
    return `${this.prefix}jobs/${id}.json`;
  }
  private imageKey(sha: string) {
    if (!/^[a-f0-9]{64}$/.test(sha)) throw new WaveSpeedError('INVALID_IMAGE', 400);
    return `${this.prefix}images/${sha}`;
  }
  async read(id: string): Promise<VersionedJob | null> {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.jobKey(id) }));
      return { job: JSON.parse(await r.Body!.transformToString()), etag: r.ETag! };
    } catch (e) { if (status(e) === 404) return null; throw e; }
  }
  async claim(job: VideoJob) {
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.jobKey(job.id),
        Body: JSON.stringify(job), ContentType: 'application/json', IfNoneMatch: '*' }));
      return true;
    } catch (e) { if (status(e) === 412 || status(e) === 409) return false; throw e; }
  }
  async save(job: VideoJob, etag: string) {
    try {
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.jobKey(job.id),
        Body: JSON.stringify(job), ContentType: 'application/json', IfMatch: etag }));
      return true;
    } catch (e) { if (status(e) === 412 || status(e) === 409) return false; throw e; }
  }
  async list(): Promise<VideoJob[]> {
    // Permanent job records are kept; history is bounded to avoid unbounded API work.
    const r = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: `${this.prefix}jobs/`, MaxKeys: 500 }));
    const keys = (r.Contents ?? []).sort((a,b) => +(b.LastModified ?? 0) - +(a.LastModified ?? 0)).slice(0,30);
    const rows = await Promise.all(keys.map(x => this.read(x.Key!.split('/').pop()!.replace('.json',''))));
    return rows.flatMap(r => r ? [r.job] : []).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  async putChunk(sha: string, index: number, bytes: Buffer) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: `${this.imageKey(sha)}.part-${index}`, Body: bytes }));
  }
  async completeImage(sha: string, size: number) {
    const chunks = await Promise.all(Array.from({ length: Math.ceil(size / UPLOAD_CHUNK_BYTES) }, async (_,i) => {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: `${this.imageKey(sha)}.part-${i}` }));
      const bytes = Buffer.from(await r.Body!.transformToByteArray());
      if (bytes.length !== Math.min(UPLOAD_CHUNK_BYTES, size - i * UPLOAD_CHUNK_BYTES)) throw new WaveSpeedError('INVALID_IMAGE',400);
      return bytes;
    }));
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== size || digest(bytes) !== sha) throw new WaveSpeedError('IMAGE_CHECKSUM_MISMATCH',400);
    const meta = imageMetadata(bytes);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: this.imageKey(sha), Body: bytes,
      ContentType: meta.mime, Metadata: { sha256: sha, width: String(meta.width), height: String(meta.height) } }));
    return { sha256: sha, ...meta };
  }
  async getImage(sha: string) {
    const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.imageKey(sha) }));
    return { bytes: Buffer.from(await r.Body!.transformToByteArray()), mime: r.ContentType! };
  }
  async imageUrl(sha: string) {
    // Confirm ownership + existence and validate the actual source before giving it to the provider.
    const image = await this.getImage(sha);
    if (digest(image.bytes) !== sha) throw new WaveSpeedError('IMAGE_CHECKSUM_MISMATCH',400);
    imageMetadata(image.bytes);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: this.imageKey(sha) }), { expiresIn: 86400 });
  }
  private dialogueKey(id:string,extension:string) {
    if(!/^[a-f0-9]{64}$/.test(id))throw new WaveSpeedError('INVALID_INPUT',400);
    return `${this.prefix}dialogue/${id}.${extension}`;
  }
  async readDialogue<T>(id:string):Promise<T|null> {
    try {const r=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:this.dialogueKey(id,'json')}));return JSON.parse(await r.Body!.transformToString());}
    catch(e){if(status(e)===404)return null;throw e;}
  }
  async claimDialogue(id:string,value:unknown) {
    try {await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:this.dialogueKey(id,'json'),Body:JSON.stringify(value),ContentType:'application/json',IfNoneMatch:'*'}));return true;}
    catch(e){if(status(e)===409||status(e)===412)return false;throw e;}
  }
  async saveDialogue(id:string,value:unknown) {
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:this.dialogueKey(id,'json'),Body:JSON.stringify(value),ContentType:'application/json'}));
  }
  async putDialogueAudio(id:string,bytes:Buffer) {
    await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:this.dialogueKey(id,'mp3'),Body:bytes,ContentType:'audio/mpeg',Metadata:{sha256:digest(bytes)}}));
  }
  async dialogueAudio(id:string) {
    const r=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:this.dialogueKey(id,'mp3')}));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
}
