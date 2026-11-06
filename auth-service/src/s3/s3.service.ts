import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  // internal client talks to floci inside the compose network,
  // public client signs URLs the app can reach from outside (the host is part of the signature)
  private readonly internalClient: S3Client;
  private readonly publicClient: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    const region = config.getOrThrow<string>('S3_REGION');

    this.internalClient = new S3Client({
      region,
      endpoint: config.getOrThrow<string>('S3_ENDPOINT'),
      forcePathStyle: true,
    });
    this.publicClient = new S3Client({
      region,
      endpoint: config.getOrThrow<string>('S3_PUBLIC_ENDPOINT'),
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  createUploadUrl(key: string, contentType: string, expiresIn: number): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn, signableHeaders: new Set(['content-type']) },
    );
  }

  async headObject(key: string): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.internalClient.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // only the first bytes, enough to recognise the file type without downloading the photo
  async readFirstBytes(key: string, count: number): Promise<Uint8Array> {
    const object = await this.internalClient.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${count - 1}` }),
    );
    return object.Body.transformToByteArray();
  }

  async deleteObject(key: string): Promise<void> {
    await this.internalClient.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
