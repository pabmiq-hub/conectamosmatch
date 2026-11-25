import { resolveAccountOwner, type MemberLite } from "./account-owner";

type Account = { id: string; user_id: string | null; company_name: string };
type Member = MemberLite & { full_name: string | null; email: string | null };

/** Accounts stay visible even when their legacy user_id is missing or stale. */
export function buildMeetingParticipants(accounts: Account[], members: Member[], accountIds?: ReadonlySet<string>) {
  return accounts.filter((account) => !accountIds || accountIds.has(account.id)).map((account) => {
    const active = members.filter((member) => member.account_id === account.id && member.is_active !== false);
    return {
      account_id: account.id,
      user_id: resolveAccountOwner(account, active),
      name: account.company_name,
      responsables: active.slice().sort((a, b) => Number(b.account_role === "owner") - Number(a.account_role === "owner") || (a.full_name ?? "").localeCompare(b.full_name ?? "", "es")).map((member) => ({
        profile_id: member.id,
        full_name: member.full_name ?? "(sin nombre)",
        role: member.account_role ?? "",
        email: member.email ?? "",
      })),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export type MeetingParticipant = ReturnType<typeof buildMeetingParticipants>[number];