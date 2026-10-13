import { env } from "@/lib/env";
import { getRequestDb } from "@/lib/http/deps";
import { errors } from "@/lib/http/errors";
import { defineRoute } from "@/lib/http/route";
import { getUser } from "@/lib/repos/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = defineRoute({ auth: "required", op: "read" }, ({ ctx }) => {
  const user = getUser(getRequestDb(), ctx.userId);
  if (!user) throw errors.unauthorized();
  return { userId: user.id, email: user.email, mode: env.APP_MODE };
});
