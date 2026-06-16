export function transactionId(competencia: string, descricao: string): string {
  const [year, month] = competencia.split("-");
  const slug = descricao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 32)
    .replace(/-$/, "");
  return `tx-${year}-${month}-${slug}`;
}
