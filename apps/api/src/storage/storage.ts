import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

/** Storage abstraction – swap LocalStorage for an S3/GCS driver without touching callers. */
export interface StorageDriver {
  write(relPath: string, data: Buffer): Promise<void>;
  remove(relPath: string): Promise<void>;
  publicUrl(relPath: string): string;
}

class LocalStorage implements StorageDriver {
  constructor(private root: string) {}

  /** Resolve a relative path and make sure it cannot escape the upload root. */
  private resolve(relPath: string) {
    const abs = path.resolve(this.root, relPath);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) throw new Error('Invalid storage path');
    return abs;
  }

  async write(relPath: string, data: Buffer) {
    const abs = this.resolve(relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, data);
  }

  async remove(relPath: string) {
    await fs.rm(this.resolve(relPath), { force: true });
  }

  publicUrl(relPath: string) {
    return `/uploads/${relPath.split(path.sep).join('/')}`;
  }
}

export const storage: StorageDriver = new LocalStorage(env.uploadDir);
