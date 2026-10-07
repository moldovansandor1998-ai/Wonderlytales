import { requireConfiguration, rejectProductionMock } from "../config";
/** StorageProvider: teljes S3/R2 adapter (put/get/exists/delete/signedUrl/metadata) + local filesystem */
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

export interface StorageObjectMeta { key: string; mime: string; size: number; sha256: string; metadata: Record<string, string>; }
export interface StorageProvider {
  put(key: string, data: Buffer | string, mime?: string, metadata?: Record<string, string>): Promise<StorageObjectMeta>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresSec?: number): Promise<string>;
  url(key: string): string;
}

function metaOf(key: string, data: Buffer, mime = "application/octet-stream", metadata: Record<string, string> = {}): StorageObjectMeta {
  return { key, mime, size: data.length, sha256: createHash("sha256").update(data).digest("hex"), metadata };
}

export class LocalStorageProvider implements StorageProvider {
  private root = path.join(process.cwd(), "data", "storage");
  async put(key: string, data: Buffer | string, mime?: string, metadata?: Record<string, string>): Promise<StorageObjectMeta> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const p = path.join(this.root, key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, buf);
    return metaOf(key, buf, mime, metadata);
  }
  async get(key: string): Promise<Buffer> { return fs.readFile(path.join(this.root, key)); }
  async exists(key: string): Promise<boolean> { try { await fs.access(path.join(this.root, key)); return true; } catch { return false; } }
  async delete(key: string): Promise<void> { await fs.rm(path.join(this.root, key), { force: true }); }
  async signedUrl(key: string): Promise<string> { return `/files/${encodeURIComponent(key)}`; }
  url(key: string): string { return `/files/${key}`; }
}

/** Cloudflare R2 / S3-compatible production adapter – teljes implementáció AWS SDK-val */
export class S3StorageProvider implements StorageProvider {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client> | null = null;
  constructor(private endpoint: string, private bucket: string, private ak: string, private sk: string, private region = "auto") {}
  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => new S3Client({
        endpoint: this.endpoint, region: this.region, credentials: { accessKeyId: this.ak, secretAccessKey: this.sk }, forcePathStyle: true,
      }));
    }
    return this.clientPromise;
  }
  async put(key: string, data: Buffer | string, mime = "application/octet-stream", metadata: Record<string, string> = {}): Promise<StorageObjectMeta> {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buf, ContentType: mime, Metadata: metadata }));
    return metaOf(key, buf, mime, metadata);
  }
  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await (await this.client()).send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    try { await (await this.client()).send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })); return true; }
    catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return false;
      throw error;
    }
  }
  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    await (await this.client()).send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  /** Public read strategy: R2 public bucket URL; privát bucketnél presign plugin nélkül egyszerű URL */
  async signedUrl(key: string, expiresSec = 3600): Promise<string> {
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    return getSignedUrl(await this.client(), new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresSec });
  }
  url(key: string): string { return `${this.endpoint}/${this.bucket}/${key}`; }
}

export function shotPath(project: string, series: string, season: number, ep: number, scene: string, shot: string, revision: number, kind: "preview"|"final"|"qc"): string {
  return `projects/${project}/series/${series}/episodes/S${String(season).padStart(2,"0")}/E${String(ep).padStart(2,"0")}/scenes/${scene}/shots/${shot}/r${revision}/${kind}`;
}
export function getStorage(): StorageProvider {
  const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  if (process.env.STORAGE_PROVIDER === "s3") {
    requireConfiguration("R2/S3", ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]);
    return new S3StorageProvider(S3_ENDPOINT!, S3_BUCKET!, S3_ACCESS_KEY_ID!, S3_SECRET_ACCESS_KEY!);
  }
  rejectProductionMock("Storage");
  return new LocalStorageProvider();
}
