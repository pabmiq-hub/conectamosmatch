// Server-only Firecrawl helper. Used by admin import to auto-enrich
// freshly created empresa/sponsor accounts with logo/website/etc.

export type ScrapedProfile = {
  company_name?: string;
  tagline?: string;
  description?: string;
  sector?: string;
  website?: string;
  linkedin_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  location_city?: string;
  logo_url?: string;
};

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com",
  "yahoo.com", "yahoo.es", "icloud.com", "me.com", "protonmail.com", "proton.me",
  "aol.com", "msn.com", "gmx.com", "gmx.es", "mail.com", "yandex.com",
]);

export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at < 0) return null;
  const d = email.slice(at + 1).trim().toLowerCase();
  if (!d || FREE_EMAIL_DOMAINS.has(d)) return null;
  return d;
}

export async function scrapeProfile(url: string, kind: "empresa" | "sponsor"): Promise<ScrapedProfile | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const finalUrl = normalizeUrl(url);
  const schema = {
    type: "object",
    properties: {
      company_name: { type: "string" },
      tagline: { type: "string" },
      description: { type: "string" },
      sector: { type: "string" },
      website: { type: "string" },
      linkedin_url: { type: "string" },
      twitter_url: { type: "string" },
      instagram_url: { type: "string" },
      location_city: { type: "string" },
      logo_url: { type: "string", description: "URL absoluta al logo de la empresa" },
    },
  };

  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        url: finalUrl,
        onlyMainContent: true,
        formats: [
          "summary",
          { type: "json", schema, prompt: `Extrae datos del perfil de esta ${kind === "empresa" ? "empresa" : "solución/proveedor"}. Devuelve solo campos claros, omite los demás.` },
        ],
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const doc = json?.data ?? json;
    const extracted = (doc?.json ?? {}) as ScrapedProfile;
    const summary: string | undefined = doc?.summary;
    const result: ScrapedProfile = { ...extracted, website: extracted.website || finalUrl };
    if (!result.description && summary) result.description = summary.slice(0, 500);
    return result;
  } catch {
    return null;
  }
}

/**
 * Best-effort enrichment of an account after creation.
 * Updates ONLY fields that are empty/null on the existing row.
 * Never throws — failure is silent so import flow isn't blocked.
 */
export async function enrichAccountFromDomain(opts: {
  supabaseAdmin: any;
  accountId: string;
  kind: "empresa" | "sponsor";
  hintUrl?: string | null;
  email?: string | null;
}): Promise<void> {
  const { supabaseAdmin, accountId, kind } = opts;
  const table = kind === "empresa" ? "empresa_profiles" : "sponsor_profiles";

  let url = opts.hintUrl?.trim() || null;
  if (!url) {
    const d = domainFromEmail(opts.email);
    if (d) url = `https://${d}`;
  }
  if (!url) return;

  const scraped = await scrapeProfile(url, kind);
  if (!scraped) return;

  const { data: row } = await supabaseAdmin.from(table).select("*").eq("id", accountId).maybeSingle();
  if (!row) return;

  const patch: Record<string, any> = {};
  const setIfEmpty = (k: string, v?: string) => {
    if (v && (row[k] == null || row[k] === "")) patch[k] = v;
  };
  setIfEmpty("logo_url", scraped.logo_url);
  setIfEmpty("website", scraped.website);
  setIfEmpty("tagline", scraped.tagline);
  setIfEmpty("description", scraped.description);
  setIfEmpty("sector", scraped.sector);
  setIfEmpty("linkedin_url", scraped.linkedin_url);
  if (kind === "empresa") {
    setIfEmpty("twitter_url", scraped.twitter_url);
    setIfEmpty("instagram_url", scraped.instagram_url);
    setIfEmpty("location_city", scraped.location_city);
  } else {
    setIfEmpty("twitter_url", scraped.twitter_url);
    setIfEmpty("location_city", scraped.location_city);
  }
  if (Object.keys(patch).length === 0) return;
  await supabaseAdmin.from(table).update(patch).eq("id", accountId);
}
