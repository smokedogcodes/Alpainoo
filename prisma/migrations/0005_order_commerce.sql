-- Order commerce fields: coupon + shipping breakdown
ALTER TABLE "Order" ADD COLUMN couponCode TEXT;
ALTER TABLE "Order" ADD COLUMN discountAmount REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN shippingAmount REAL NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN subtotalAmount REAL;
