import { Injectable } from '@nestjs/common';

/**
 * In-process lock that prevents concurrent regenerate calls for the same
 * fileId from running the processor twice.
 *
 * Single-process only — if we ever run multiple backend instances, swap this
 * for a DB-backed lock on the File document. Ported from
 * backend/src/files/transformationLock.js.
 */
@Injectable()
export class TransformationLockService {
  private readonly inProgress = new Set<string>();

  tryAcquire(fileId: string | { toString(): string }): boolean {
    const key = String(fileId);
    if (this.inProgress.has(key)) return false;
    this.inProgress.add(key);
    return true;
  }

  release(fileId: string | { toString(): string }): void {
    this.inProgress.delete(String(fileId));
  }
}
