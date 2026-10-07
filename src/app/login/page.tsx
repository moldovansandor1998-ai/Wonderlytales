import React from "react";
import { redirect } from "next/navigation";
import { authEnabled, createServerSupabase } from "@/lib/auth";
import { safeAuthNext } from "@/lib/auth-navigation";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  if (authEnabled()) {
    const { data: { user }, error } = await createServerSupabase().auth.getUser();
    if (!error && user) redirect(safeAuthNext(searchParams.next ?? null));
  }
  return <LoginForm />;
}
