-- Coupon type: PERCENT | FIXED | PERCENT_CAPPED | FREE_SHIPPING
ALTER TABLE Coupon ADD COLUMN kind TEXT;

-- Backfill: both percent + amount meant "percent up to amount", not stacked discounts
UPDATE Coupon
SET kind = 'PERCENT_CAPPED'
WHERE percentOff IS NOT NULL AND percentOff > 0
  AND amountOff IS NOT NULL AND amountOff > 0
  AND (kind IS NULL OR kind = '');

UPDATE Coupon
SET kind = 'PERCENT'
WHERE percentOff IS NOT NULL AND percentOff > 0
  AND (amountOff IS NULL OR amountOff = 0)
  AND (kind IS NULL OR kind = '');

UPDATE Coupon
SET kind = 'FIXED'
WHERE (percentOff IS NULL OR percentOff = 0)
  AND amountOff IS NOT NULL AND amountOff > 0
  AND (kind IS NULL OR kind = '');
