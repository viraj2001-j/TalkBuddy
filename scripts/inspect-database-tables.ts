import prisma from "../lib/db";

async function inspectDatabase() {
  console.log("=================================================");
  console.log("        POSTGRESQL DATABASE INTROSPECTION        ");
  console.log("=================================================\n");

  const tables: any[] = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC;
  `;

  console.log(`Found ${tables.length} tables in PostgreSQL database:`);

  const tableStats = [];

  for (const t of tables) {
    const tableName = t.table_name;
    const countResult: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM "${tableName}";`
    );
    const count = countResult[0]?.count ?? 0;
    tableStats.push({ tableName, count });
    console.log(`  📁 ${tableName.padEnd(25)} -> ${count} rows`);
  }

  console.log("\nTotal tables:", tableStats.length);
}

inspectDatabase()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
