import "server-only";
import { hash, hashSync, verify } from "@node-rs/argon2";
import { randomToken } from "@/lib/security/crypto";

const ARGON2ID = 2;
const PARAMS = { algorithm: ARGON2ID, memoryCost: 65536, timeCost: 3, parallelism: 1 };

/** Argon2id hash (64 MiB, 3 passes, 1 lane) in PHC string format. */
export const hashPassword = (p: string): Promise<string> => hash(p, PARAMS);

/** Synchronous variant for boot-time and CLI use. */
export const hashPasswordSync = (p: string): string => hashSync(p, PARAMS);

/** True only when `p` matches `hash`; a malformed hash yields false instead of throwing. */
export async function verifyPassword(hashed: string, p: string): Promise<boolean> {
  try {
    return await verify(hashed, p);
  } catch {
    return false;
  }
}

let dummy: string | undefined;

/** Hash of a random secret, used to spend equal time when no user matches. Computed once, lazily. */
export const getDummyHash = (): string => (dummy ??= hashPasswordSync(randomToken(16)));
