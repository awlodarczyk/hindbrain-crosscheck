import { getDb } from "@/lib/db/client";
import { migrate } from "@/lib/db/migrate";

const { applied } = migrate(getDb());
console.log(applied.length > 0 ? `applied: ${applied.join(", ")}` : "up to date");
