const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      accounts: { select: { provider: true, providerAccountId: true } },
    },
  });
  console.log(JSON.stringify(users, null, 2));
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
