// Helpers pra texto vindo do RichInlineText (que salva HTML no banco).
// Usados em Calendário/Acompanhamento e nos layouts de impressão.

export function stripHtml(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input);
  s = s.replace(/<\s*br\s*\/?\s*>/gi, " ");
  s = s.replace(/<\/(p|div|li|h[1-6])>/gi, " ");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
  return s.replace(/\s+/g, " ").trim();
}

export function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
