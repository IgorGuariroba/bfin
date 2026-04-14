// Base schema file — prepared for future entities
import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow(),
});
