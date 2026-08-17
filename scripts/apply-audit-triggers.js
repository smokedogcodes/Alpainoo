const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/** Split SQL into runnable chunks (function body kept together). */
function splitSql(sql) {
  const chunks = [];
  let buf = "";
  let inDollar = false;
  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !inDollar) continue;
    if (trimmed.includes("$$")) {
      inDollar = !inDollar;
    }
    buf += line + "\n";
    if (!inDollar && trimmed.endsWith(";")) {
      const chunk = buf.trim();
      if (chunk) chunks.push(chunk);
      buf = "";
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

async function main() {
  const sqlPath = path.join(__dirname, "..", "prisma", "sql", "audit-triggers.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const chunks = splitSql(sql);
  for (const chunk of chunks) {
    await prisma.$executeRawUnsafe(chunk);
  }
  console.log(`Audit triggers applied (${chunks.length} statements).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
