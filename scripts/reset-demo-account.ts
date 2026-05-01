import { db } from "../src/db/index.js";
import { usuarios } from "../src/db/schema.js";
import {
  uuid,
  DEMO_PROVIDER_ID,
  DEMO_NAME,
  DEMO_EMAIL,
  cleanupDemoData,
  seedDemoData,
} from "./helpers/demo-utils.js";

async function main() {
  console.log("Resetting demo account...");
  await db.transaction(async (tx) => {
    const user = await cleanupDemoData(tx);
    if (!user) {
      const [inserted] = await tx
        .insert(usuarios)
        .values({
          id: uuid("demo-user"),
          idProvedor: DEMO_PROVIDER_ID,
          nome: DEMO_NAME,
          email: DEMO_EMAIL,
        })
        .returning();
      await seedDemoData(tx, inserted.id);
    } else {
      await seedDemoData(tx, user.id);
    }
  });
  console.log("Demo reset complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
