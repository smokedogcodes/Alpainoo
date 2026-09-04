const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");
const fs = require("fs");

function esc(s) {
  if (s == null) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

async function main() {
  process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
  const prisma = new PrismaClient();
  const products = await prisma.product.findMany();
  const blogs = await prisma.blogPost.findMany();
  const faqs = await prisma.knowledgeArticle.findMany();
  console.log({ products: products.length, blogs: blogs.length, faqs: faqs.length });

  const stmts = [];
  for (const p of products) {
    stmts.push(
      `INSERT OR REPLACE INTO Product (id,title,slug,description,brand,volume,mrp,sellingPrice,discount,sku,stock,category,benefits,ingredients,usage,images,rating,reviewCount,isHidden,createdAt,updatedAt) VALUES (${esc(p.id)},${esc(p.title)},${esc(p.slug)},${esc(p.description)},${esc(p.brand)},${esc(p.volume)},${p.mrp},${p.sellingPrice},${p.discount},${esc(p.sku)},${p.stock},${esc(p.category)},${esc(p.benefits)},${esc(p.ingredients)},${esc(p.usage)},${esc(p.images)},${p.rating},${p.reviewCount},${p.isHidden ? 1 : 0},${esc(p.createdAt.toISOString())},${esc(p.updatedAt.toISOString())});`
    );
  }
  for (const b of blogs) {
    stmts.push(
      `INSERT OR REPLACE INTO BlogPost (id,title,slug,excerpt,content,coverImage,tags,published,createdAt,updatedAt) VALUES (${esc(b.id)},${esc(b.title)},${esc(b.slug)},${esc(b.excerpt)},${esc(b.content)},${esc(b.coverImage)},${esc(b.tags)},${b.published ? 1 : 0},${esc(b.createdAt.toISOString())},${esc(b.updatedAt.toISOString())});`
    );
  }
  for (const f of faqs) {
    stmts.push(
      `INSERT OR REPLACE INTO KnowledgeArticle (id,slug,title,question,answer,keywords,category,active,createdAt,updatedAt) VALUES (${esc(f.id)},${esc(f.slug)},${esc(f.title)},${esc(f.question)},${esc(f.answer)},${esc(f.keywords)},${esc(f.category)},${f.active ? 1 : 0},${esc(f.createdAt.toISOString())},${esc(f.updatedAt.toISOString())});`
    );
  }

  const file = "prisma/migrations/seed-d1.sql";
  fs.writeFileSync(file, stmts.join("\n"), "utf8");
  console.log("Wrote", file, "statements", stmts.length);
  await prisma.$disconnect();

  execSync(`npx wrangler d1 execute alpainoo-db --remote --file=${file}`, {
    stdio: "inherit",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
