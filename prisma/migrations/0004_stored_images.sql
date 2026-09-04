-- Binary product images in D1 (no R2). Max practical size ~500KB per row (D1 row cap 2MB).
CREATE TABLE IF NOT EXISTS StoredImage (
  id TEXT PRIMARY KEY NOT NULL,
  mimeType TEXT NOT NULL,
  bytes BLOB NOT NULL,
  byteSize INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS StoredImage_createdAt_idx ON StoredImage(createdAt);
