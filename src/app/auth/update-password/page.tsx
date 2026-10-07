import { redirect } from "next/navigation";
import { authEnabled, createServerSupabase } from "@/lib/auth";
import PasswordForm from "./password-form";

export default async function UpdatePasswordPage() {
  if (!authEnabled()) redirect("/login");
  const { data: { user }, error } = await createServerSupabase().auth.getUser();
  if (error || !user) redirect("/login?next=/auth/update-password");
  return <PasswordForm />;
}
