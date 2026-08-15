const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.user
  .upsert({
    where: { email: "elorakart1@gmail.com" },
    create: { email: "elorakart1@gmail.com", name: "Elorakart Admin", role: "ADMIN" },
    update: { role: "ADMIN", name: "Elorakart Admin" },
  })
  .then((u) => {
    console.log("admin", u.email, u.role);
    return p.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await p.$disconnect();
    process.exit(1);
  });
