import { env, type Env } from "./env";

export const isHosted = (e: Pick<Env, "APP_MODE"> = env) => e.APP_MODE === "hosted";
export const isLocal = (e: Pick<Env, "APP_MODE"> = env) => e.APP_MODE === "local";
