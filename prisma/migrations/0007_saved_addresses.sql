-- Saved shipping addresses for account hub
CREATE TABLE IF NOT EXISTS SavedAddress (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  label TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  isDefault INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS SavedAddress_userId_idx ON SavedAddress(userId);
