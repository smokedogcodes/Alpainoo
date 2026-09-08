-- Staff/Temp RBAC: expiry + role permission templates
ALTER TABLE User ADD COLUMN roleExpiresAt DATETIME;
ALTER TABLE SiteSettings ADD COLUMN adminRoleTemplates TEXT;
