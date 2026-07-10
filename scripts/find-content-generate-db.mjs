import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const roots = ["/Users/admin/Downloads"];
const files = [];

function walk(dir, depth = 0) {
  if (depth > 3) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      walk(full, depth + 1);
    } else if (entry.isFile() && (entry.name === ".env" || entry.name === ".env.local")) {
      files.push(full);
    }
  }
}

for (const root of roots) walk(root);

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^DATABASE_URL=(.+)$/m);
  if (!match) continue;
  const url = match[1].trim().replace(/^"|"$/g, "");
  if (!url || url.includes("USER:PASSWORD") || url.includes("xxxx")) continue;

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const count = await prisma.generationJob.count();
    console.log("MATCH", file, "GenerationJob count:", count);
  } catch {
    // not the content-generate database
  } finally {
    await prisma.$disconnect();
  }
}
