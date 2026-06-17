function slugify(text: string, maxLen = 32): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, maxLen)
    .replace(/-$/, "");
}

export function accountId(nome: string): string {
  return `acc-${slugify(nome)}-${Date.now().toString(36)}`;
}

export function templateId(nome: string): string {
  return `tpl-${slugify(nome)}-${Date.now().toString(36)}`;
}

export function transactionId(competencia: string, descricao: string): string {
  const [year, month] = competencia.split("-");
  return `tx-${year}-${month}-${slugify(descricao)}`;
}
