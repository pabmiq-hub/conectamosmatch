import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().min(3).max(500),
  kind: z.enum(["empresa", "sponsor"]),
});

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

export const scrapeProfileFromUrl = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ data: ScrapedProfile; sourceUrl: string }> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY no configurada");

    const url = normalizeUrl(data.url);

    const schema = {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Nombre oficial de la empresa o marca" },
        tagline: { type: "string", description: "Eslogan corto o frase principal (máx 120 caracteres)" },
        description: { type: "string", description: "Descripción de qué hace la empresa, 2-3 frases en español" },
        sector: { type: "string", description: "Sector o industria principal (ej. Tech, Salud, Retail, Fintech)" },
        website: { type: "string", description: "URL principal del sitio web" },
        linkedin_url: { type: "string", description: "URL de LinkedIn si aparece" },
        twitter_url: { type: "string", description: "URL de Twitter/X si aparece" },
        instagram_url: { type: "string", description: "URL de Instagram si aparece" },
        location_city: { type: "string", description: "Ciudad principal si aparece" },
        logo_url: { type: "string", description: "URL absoluta al logo de la empresa si es detectable" },
      },
    };

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        formats: [
          "summary",
          { type: "json", schema, prompt: `Extrae datos del perfil de esta ${data.kind === "empresa" ? "empresa" : "solución/proveedor"}. Devuelve solo campos que aparezcan claramente; omite los demás.` },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Firecrawl ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json: any = await res.json();
    const doc = json?.data ?? json;
    const extracted = (doc?.json ?? {}) as ScrapedProfile;
    const summary: string | undefined = doc?.summary;

    const result: ScrapedProfile = { ...extracted, website: extracted.website || url };
    if (!result.description && summary) result.description = summary.slice(0, 500);

    return { data: result, sourceUrl: url };
  });
