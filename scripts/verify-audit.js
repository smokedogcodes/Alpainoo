const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const r = await p.systemLog.create({
    data: {
      level: "ERROR",
      category: "admin",
      action: "AUDIT_BOOTSTRAP",
      message: "Audit logging enabled",
    },
  });
  console.log("systemLog", r.id);
  // Touch a product update to fire trigger if any products exist
  const prod = await p.product.findFirst();
  if (prod) {
    await p.product.update({
      where: { id: prod.id },
      data: { updatedAt: new Date() },
    });
  }
  const c = await p.dbAuditLog.count();
  console.log("dbAuditLog count", c);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
