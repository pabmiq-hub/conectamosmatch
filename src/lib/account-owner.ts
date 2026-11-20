// Who acts as "responsable" for an empresa/solución account.
// Prefers the account's own user_id when that profile exists; otherwise the
// first active owner, then any active member, then any member.
export type MemberLite = { id: string; account_id: string | null; account_role?: string | null; is_active?: boolean | null };

export function resolveAccountOwner(account: { id: string; user_id: string | null }, members: MemberLite[]): string | null {
  const mine = members.filter((m) => m.account_id === account.id);
  if (account.user_id && mine.some((m) => m.id === account.user_id && m.is_active !== false)) return account.user_id;
  const active = mine.filter((m) => m.is_active !== false);
  return (
    active.find((m) => m.account_role === "owner")?.id ??
    active[0]?.id ??
    mine[0]?.id ??
    null
  );
}

export type LinkIssue = "sin_responsable" | "responsable_roto" | "sin_miembros";

/** Problems that prevent an account from receiving/sending "Me interesa". */
export function accountLinkIssues(account: { id: string; user_id: string | null }, members: MemberLite[]): LinkIssue[] {
  const mine = members.filter((m) => m.account_id === account.id);
  const out: LinkIssue[] = [];
  if (!account.user_id) out.push("sin_responsable");
  else if (!mine.some((m) => m.id === account.user_id && m.is_active !== false)) out.push("responsable_roto");
  if (mine.length === 0) out.push("sin_miembros");
  return out;
}
