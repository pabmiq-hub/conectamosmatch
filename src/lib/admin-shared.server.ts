import { supabaseAdmin } from "@/integrations/supabase/client.server";

// El super admin "raíz" — solo este puede crear nuevas cuentas y otros super admins.
export const BOOTSTRAP_ADMIN_EMAIL = "miquel@conectamos.club";

export async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "super_admin") {
    throw new Response("Forbidden: super admin only", { status: 403 });
  }
}

export async function assertBootstrapAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role, email")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || data.role !== "super_admin" || (data.email ?? "").toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL) {
    throw new Response("Forbidden: bootstrap admin only", { status: 403 });
  }
}
