import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
