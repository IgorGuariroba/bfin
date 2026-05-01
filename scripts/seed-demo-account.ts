import { db } from "../src/db/index.js";
import { usuarios } from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import {
  uuid,
  DEMO_PROVIDER_ID,
  DEMO_NAME,
  DEMO_EMAIL,
  seedDemoData,
  cleanupDemoData,
} from "./helpers/demo-utils.js";

async function ensureUser() {
  let user = await db.query.usuarios.findFirst({
    where: eq(usuarios.idProvedor, DEMO_PROVIDER_ID),
  });

  if (!user) {
    const [inserted] = await db
      .insert(usuarios)
      .values({
        id: uuid("demo-user"),
        idProvedor: DEMO_PROVIDER_ID,
        nome: DEMO_NAME,
        email: DEMO_EMAIL,
      })
      .returning();
    user = inserted;
    console.log("Created demo user:", user.id);
  } else {
    console.log("Demo user exists:", user.id);
  }
  return user;
}

async function main() {
  console.log("Seeding demo account...");
  const user = await ensureUser();
  await db.transaction(async (tx) => {
    await cleanupDemoData(tx);
    await seedDemoData(tx, user.id);
  });
  console.log("Demo seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
