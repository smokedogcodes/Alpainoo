const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  for (const email of ["elorakart1@gmail.com", "elolrakart1@gmail.com"]) {
    const u = await p.user.upsert({
      where: { email },
      create: { email, name: "Elorakart Admin", role: "ADMIN" },
      update: { role: "ADMIN" },
    });
    console.log("ok", u.email, u.role, u.id);
  }
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
