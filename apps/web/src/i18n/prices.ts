export type Currency = "GBP" | "BRL";

export const prices: Record<Currency, { pro: string; team: string }> = {
  GBP: { pro: "£49", team: "£129" },
  BRL: { pro: "R$ 297", team: "R$ 747" },
};

export function detectCurrency(): Currency {
  if (typeof navigator === "undefined") return "GBP";
  const lang = navigator.language || "";
  if (lang.startsWith("pt")) return "BRL";
  return "GBP";
}
