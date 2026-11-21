const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const sym = "!@#$%&*";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len - 1; i++) out += chars[buf[i] % chars.length];
  out += sym[buf[len - 1] % sym.length];
  return out;
}

export function credentialsEmailHtml(p: { name: string; email: string; password: string; eventTitle?: string | null; loginUrl: string }) {
  const ev = p.eventTitle ? `<p style="margin:0 0 16px">Ya tienes acceso a la plataforma de <strong>${esc(p.eventTitle)}</strong>.</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:32px 24px">
<h1 style="font-size:22px;margin:0 0 16px;letter-spacing:.5px">CONECTAMOS</h1>
<p style="margin:0 0 16px">Hola ${esc(p.name || "")},</p>
${ev}
<p style="margin:0 0 8px">Estos son tus datos de acceso:</p>
<table style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:100%;margin:0 0 20px"><tr><td>
<p style="margin:0 0 8px"><strong>Email:</strong> ${esc(p.email)}</p>
<p style="margin:0"><strong>Contraseña:</strong> <span style="font-family:monospace;font-size:16px">${esc(p.password)}</span></p>
</td></tr></table>
<a href="${esc(p.loginUrl)}" style="display:inline-block;background:#5b21ff;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold">Entrar en la plataforma</a>
<p style="margin:24px 0 0;font-size:13px;color:#6b7280">Por seguridad, te recomendamos guardar este correo y no compartir tu contraseña.</p>
</div></body></html>`;
}

export async function sendEmail(to: string, subject: string, html: string, idempotencyKey?: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY no configurada");
  if (!resendKey) throw new Error("Resend no está conectado");
  const from = process.env.CREDENTIALS_FROM_EMAIL || "Conectamos <miquel@conectamos.club>";
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey, ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend failed [${res.status}]: ${body}`);
    let msg = body;
    try { msg = JSON.parse(body).message ?? body; } catch {}
    throw new Error(`Resend [${res.status}]: ${msg}`);
  }
}
