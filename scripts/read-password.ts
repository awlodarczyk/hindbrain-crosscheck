import { createInterface } from "node:readline/promises";

/** Password from the PASSWORD env var, else prompted twice on stdin (echoed; set PASSWORD to avoid that). */
export async function readNewPassword(): Promise<string> {
  const fromEnv = process.env.PASSWORD;
  if (fromEnv) return fromEnv;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const first = await rl.question("Password: ");
    const second = await rl.question("Repeat password: ");
    if (first !== second) throw new Error("passwords do not match");
    return first;
  } finally {
    rl.close();
  }
}

export function requirePasswordStrength(p: string): void {
  if (p.length < 12) throw new Error("password must be at least 12 characters");
}
