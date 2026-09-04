-- Phase 2 feature tables for remote D1 (safe to re-run with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS Category (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS Category_slug_key ON Category(slug);

CREATE TABLE IF NOT EXISTS Collection (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  coverImage TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS Collection_slug_key ON Collection(slug);

CREATE TABLE IF NOT EXISTS CollectionProduct (
  id TEXT PRIMARY KEY NOT NULL,
  collectionId TEXT NOT NULL,
  productId TEXT NOT NULL,
  UNIQUE(collectionId, productId)
);

CREATE TABLE IF NOT EXISTS ProductVariant (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  scent TEXT,
  size TEXT,
  mrp REAL,
  sellingPrice REAL,
  stock INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS ProductVariant_sku_key ON ProductVariant(sku);

CREATE TABLE IF NOT EXISTS Coupon (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  percentOff REAL,
  amountOff REAL,
  minOrder REAL NOT NULL DEFAULT 0,
  maxUses INTEGER,
  usedCount INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  startsAt DATETIME,
  endsAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS Coupon_code_key ON Coupon(code);

CREATE TABLE IF NOT EXISTS Review (
  id TEXT PRIMARY KEY NOT NULL,
  productId TEXT NOT NULL,
  userId TEXT,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS WishlistItem (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  productId TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, productId)
);

CREATE TABLE IF NOT EXISTS ReturnRequest (
  id TEXT PRIMARY KEY NOT NULL,
  orderId TEXT NOT NULL,
  userId TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  adminNote TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS NewsletterSubscriber (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS NewsletterSubscriber_email_key ON NewsletterSubscriber(email);

CREATE TABLE IF NOT EXISTS EmailCampaign (
  id TEXT PRIMARY KEY NOT NULL,
  subject TEXT NOT NULL,
  bodyHtml TEXT NOT NULL,
  sentAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SiteSettings (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'default',
  gstin TEXT,
  businessName TEXT,
  businessAddress TEXT,
  invoicePrefix TEXT NOT NULL DEFAULT 'ALP',
  lowStockDefault INTEGER NOT NULL DEFAULT 5,
  metaPixelId TEXT,
  gaMeasurementId TEXT
);

CREATE TABLE IF NOT EXISTS AbandonedCart (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  payload TEXT NOT NULL,
  remindedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL
);

-- Column adds for existing Product/User/BlogPost (SQLite: fail if already present — run once)
-- Prefer also applying prisma/migrations/0003_phase2_alters.sql separately.
