import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/shell/logo";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { readAuthSession } from "@/lib/auth/session";
import { getRequestDb } from "@/lib/http/deps";
import { isHosted } from "@/lib/mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!isHosted()) redirect("/");
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (readAuthSession(getRequestDb(), token)) redirect("/");
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-6 rounded-dialog border border-border-default bg-bg-card p-8">
      <Logo size={64} showProduct />
      <h1 className="text-[20px] font-semibold text-text-primary">Sign in</h1>
      <LoginForm />
    </div>
  );
}
