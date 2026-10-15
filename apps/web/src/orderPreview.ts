export const MAX_PREVIEW_QUANTITY = 1_000_000;

export function parsePreviewQuantity(rawQuantity: string): number | null {
  if (!rawQuantity.trim()) return null;
  const quantity = Number(rawQuantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > MAX_PREVIEW_QUANTITY) return null;
  return quantity;
}

export function calculateReferenceNotional(rawQuantity: string, unitPrice: number): number | null {
  const quantity = parsePreviewQuantity(rawQuantity);
  if (quantity === null || !Number.isFinite(unitPrice) || unitPrice <= 0) return null;
  const notional = quantity * unitPrice;
  return Number.isFinite(notional) ? notional : null;
}
