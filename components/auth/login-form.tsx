"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GENERIC_ERROR = "Email or password is incorrect.";
const NETWORK_ERROR = "Could not sign in. Try again.";

/** Accepts only same-site relative paths; anything else falls back to "/". */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/";
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
        return;
      }
      setError(res.status === 429 ? "Too many attempts. Try again shortly." : GENERIC_ERROR);
    } catch {
      setError(NETWORK_ERROR);
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">
        Email
        <Input name="email" type="email" autoComplete="username" required disabled={pending} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text-primary">
        Password
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={pending}
        />
      </label>
      {error ? (
        <p role="alert" className="text-[13px] text-status-disputed">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}
