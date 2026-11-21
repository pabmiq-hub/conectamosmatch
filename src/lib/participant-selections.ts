export type SelectionTarget = {
  account_id: string;
  company_name: string;
  kind: "empresa" | "sponsor";
  responsables: string[];
  created_at: string | null;
};

export type SelectionAccount = {
  account_id: string;
  company_name: string;
  kind: "empresa" | "sponsor";
  logo_url?: string | null;
  targets: SelectionTarget[];
};

export type SelectionDetail = SelectionTarget & { logo_url: string | null; mutual: boolean };
export type ParticipantSelections = { outgoing: SelectionDetail[]; incoming: SelectionDetail[]; matches: number };

/** Reuse the event-scoped selections read; count partner IDs, never people or names. */
export function getParticipantSelections(accounts: SelectionAccount[], accountIds: readonly string[]): ParticipantSelections {
  const selected = new Set(accountIds);
  const refs = new Map(accounts.map((account) => [account.account_id, account]));
  const outgoing = new Map<string, SelectionDetail>();
  const incoming = new Map<string, SelectionDetail>();
  const add = (map: Map<string, SelectionDetail>, target: SelectionTarget) => {
    const previous = map.get(target.account_id);
    map.set(target.account_id, {
      ...target,
      logo_url: refs.get(target.account_id)?.logo_url ?? null,
      responsables: [...new Set([...(previous?.responsables ?? []), ...target.responsables])].sort((a, b) => a.localeCompare(b, "es")),
      created_at: previous?.created_at && (!target.created_at || previous.created_at > target.created_at) ? previous.created_at : target.created_at,
      mutual: false,
    });
  };
  for (const account of accounts) {
    for (const target of account.targets) {
      if (selected.has(account.account_id) && !selected.has(target.account_id)) add(outgoing, target);
      if (selected.has(target.account_id) && !selected.has(account.account_id)) {
        add(incoming, { ...target, account_id: account.account_id, company_name: account.company_name, kind: account.kind });
      }
    }
  }
  const sort = (map: Map<string, SelectionDetail>) => [...map.values()].sort((a, b) => a.company_name.localeCompare(b.company_name, "es", { sensitivity: "base" }));
  for (const [id, detail] of outgoing) detail.mutual = incoming.has(id);
  for (const [id, detail] of incoming) detail.mutual = outgoing.has(id);
  return { outgoing: sort(outgoing), incoming: sort(incoming), matches: [...outgoing.values()].filter((detail) => detail.mutual).length };
}