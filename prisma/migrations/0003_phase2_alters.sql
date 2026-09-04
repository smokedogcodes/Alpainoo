-- Phase 2 ALTER columns for existing tables.
-- SQLite does not support "ADD COLUMN IF NOT EXISTS".
-- Skip any statement whose column already exists (duplicate column name).
-- Prefer applying one statement at a time on remote D1.

-- Product (skip if present)
ALTER TABLE Product ADD COLUMN metaTitle TEXT;
ALTER TABLE Product ADD COLUMN metaDescription TEXT;
ALTER TABLE Product ADD COLUMN lowStockThreshold INTEGER NOT NULL DEFAULT 5;
ALTER TABLE Product ADD COLUMN categoryId TEXT;

-- User (avatarUrl often already exists from Auth schema — skip that ALTER)
ALTER TABLE User ADD COLUMN permissions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE User ADD COLUMN phone TEXT;

-- BlogPost
ALTER TABLE BlogPost ADD COLUMN scheduledAt DATETIME;
ALTER TABLE BlogPost ADD COLUMN metaTitle TEXT;
ALTER TABLE BlogPost ADD COLUMN metaDescription TEXT;
