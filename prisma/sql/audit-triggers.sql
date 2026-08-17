-- Append-only DB audit trail for transactional tables (Neon / PostgreSQL).
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION elorakart_audit_row()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_row_id TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := row_to_json(OLD)::text;
    v_new := NULL;
    BEGIN
      v_row_id := (row_to_json(OLD)->>'id');
    EXCEPTION WHEN OTHERS THEN
      v_row_id := NULL;
    END;
    IF v_row_id IS NULL THEN
      BEGIN
        v_row_id := (row_to_json(OLD)->>'orderId');
      EXCEPTION WHEN OTHERS THEN
        v_row_id := NULL;
      END;
    END IF;
    INSERT INTO "DbAuditLog" (id, "createdAt", "tableName", operation, "rowId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_TABLE_NAME,
      TG_OP,
      v_row_id,
      v_old,
      v_new
    );
    RETURN OLD;
  ELSE
    v_new := row_to_json(NEW)::text;
    IF TG_OP = 'UPDATE' THEN
      v_old := row_to_json(OLD)::text;
    ELSE
      v_old := NULL;
    END IF;
    BEGIN
      v_row_id := (row_to_json(NEW)->>'id');
    EXCEPTION WHEN OTHERS THEN
      v_row_id := NULL;
    END;
    IF v_row_id IS NULL THEN
      BEGIN
        v_row_id := (row_to_json(NEW)->>'orderId');
      EXCEPTION WHEN OTHERS THEN
        v_row_id := NULL;
      END;
    END IF;
    INSERT INTO "DbAuditLog" (id, "createdAt", "tableName", operation, "rowId", "oldData", "newData")
    VALUES (
      replace(gen_random_uuid()::text, '-', ''),
      NOW(),
      TG_TABLE_NAME,
      TG_OP,
      v_row_id,
      v_old,
      v_new
    );
    RETURN NEW;
  END IF;
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
