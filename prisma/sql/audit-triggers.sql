-- Per-table transaction audit logs + shared DbAuditLog.
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION elorakart_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_row_id TEXT;
  v_old TEXT;
  v_new TEXT;
  v_parent TEXT;
  v_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := row_to_json(OLD)::text;
    v_new := NULL;
    v_row_id := COALESCE(row_to_json(OLD)->>'id', row_to_json(OLD)->>'orderId');
  ELSE
    v_new := row_to_json(NEW)::text;
    IF TG_OP = 'UPDATE' THEN
      v_old := row_to_json(OLD)::text;
    ELSE
      v_old := NULL;
    END IF;
    v_row_id := COALESCE(row_to_json(NEW)->>'id', row_to_json(NEW)->>'orderId');
  END IF;

  v_id := replace(gen_random_uuid()::text, '-', '');

  -- Shared trail
  INSERT INTO "DbAuditLog" (id, "createdAt", "tableName", operation, "rowId", "oldData", "newData")
  VALUES (v_id, NOW(), TG_TABLE_NAME, TG_OP, v_row_id, v_old, v_new);

  -- Dedicated per-table audit tables
  IF TG_TABLE_NAME = 'Order' THEN
    INSERT INTO "OrderAudit" (id, "createdAt", operation, "orderId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      v_old,
      v_new
    );
  ELSIF TG_TABLE_NAME = 'OrderItem' THEN
    INSERT INTO "OrderItemAudit" (id, "createdAt", operation, "orderItemId", "orderId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      CASE WHEN TG_OP = 'DELETE' THEN OLD."orderId" ELSE NEW."orderId" END,
      v_old,
      v_new
    );
  ELSIF TG_TABLE_NAME = 'Shipment' THEN
    INSERT INTO "ShipmentAudit" (id, "createdAt", operation, "shipmentId", "orderId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      CASE WHEN TG_OP = 'DELETE' THEN OLD."orderId" ELSE NEW."orderId" END,
      v_old,
      v_new
    );
  ELSIF TG_TABLE_NAME = 'Product' THEN
    INSERT INTO "ProductAudit" (id, "createdAt", operation, "productId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      v_old,
      v_new
    );
  ELSIF TG_TABLE_NAME = 'User' THEN
    INSERT INTO "UserAudit" (id, "createdAt", operation, "userId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      v_old,
      v_new
    );
  ELSIF TG_TABLE_NAME = 'SupportTicket' THEN
    INSERT INTO "SupportTicketAudit" (id, "createdAt", operation, "ticketId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      v_old,
      v_new
    );
  ELSIF TG_TABLE_NAME = 'StockLog' THEN
    -- StockLog is already an audit trail; also mirror into ProductAudit for stock-related visibility
    INSERT INTO "ProductAudit" (id, "createdAt", operation, "productId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      'STOCKLOG_' || TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN OLD."productId" ELSE NEW."productId" END,
      v_old,
      v_new
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_order ON "Order";
CREATE TRIGGER trg_audit_order
AFTER INSERT OR UPDATE OR DELETE ON "Order"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();

DROP TRIGGER IF EXISTS trg_audit_order_item ON "OrderItem";
CREATE TRIGGER trg_audit_order_item
AFTER INSERT OR UPDATE OR DELETE ON "OrderItem"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();

DROP TRIGGER IF EXISTS trg_audit_shipment ON "Shipment";
CREATE TRIGGER trg_audit_shipment
AFTER INSERT OR UPDATE OR DELETE ON "Shipment"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();

DROP TRIGGER IF EXISTS trg_audit_product ON "Product";
CREATE TRIGGER trg_audit_product
AFTER INSERT OR UPDATE OR DELETE ON "Product"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();

DROP TRIGGER IF EXISTS trg_audit_stock_log ON "StockLog";
CREATE TRIGGER trg_audit_stock_log
AFTER INSERT OR UPDATE OR DELETE ON "StockLog"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();

DROP TRIGGER IF EXISTS trg_audit_user ON "User";
CREATE TRIGGER trg_audit_user
AFTER INSERT OR UPDATE OR DELETE ON "User"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();

DROP TRIGGER IF EXISTS trg_audit_support_ticket ON "SupportTicket";
CREATE TRIGGER trg_audit_support_ticket
AFTER INSERT OR UPDATE OR DELETE ON "SupportTicket"
FOR EACH ROW EXECUTE FUNCTION elorakart_audit_row();
