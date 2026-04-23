// backend/src/files/transformationLock.js
// Prevents concurrent regenerate requests for the same fileId from running the
// processor twice. Single-process only — if you ever run multiple backend
// instances, swap this for a DB-based lock on the File model.

'use strict';

const inProgress = new Set();

function tryAcquire(fileId) {
    const key = String(fileId);
    if (inProgress.has(key)) return false;
    inProgress.add(key);
    return true;
}

function release(fileId) {
    inProgress.delete(String(fileId));
}

module.exports = { tryAcquire, release };