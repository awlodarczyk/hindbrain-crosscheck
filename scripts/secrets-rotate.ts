import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { old: { type: "string" }, new: { type: "string" } } });
if (!values.old || !values.new) {
  console.error("usage: pnpm secrets:rotate --old <secret> --new <secret>");
  process.exit(2);
}
// env parsing requires APP_SECRET; scripts are an allowed process.env writer.
process.env.APP_SECRET = values.old;

try {
  const { openDb } = await import("@/lib/db/client");
  const { migrate } = await import("@/lib/db/migrate");
  const { env } = await import("@/lib/env");
  const { rotateSecrets } = await import("@/lib/security/rotate");
  const db = openDb(join(env.DATA_DIR, "crosscheck.db"));
  migrate(db);
  console.log(`rotated ${rotateSecrets(db, values.old, values.new)} secret(s)`);
  console.log("Now set APP_SECRET to the new value; sessions and browser ids are re-signed.");
} catch (e) {
  console.error(`rotation failed, no rows changed: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
