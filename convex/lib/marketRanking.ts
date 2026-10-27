/** Unknown freight is not zero. Comparable offers share exact material and declared grade/specification. */
export interface ComparableOffer {
  material: { code: string };
  specification?: { grade: string; specification: string };
  askPaisePerKg: number;
  freightPaisePerKg?: number;
  distanceKm?: number;
  deliveryAvailableAt?: number;
  createdAt: number;
  id: string;
}
export function deliveredPrice(offer: {
  askPaisePerKg: number;
  freightPaisePerKg?: number;
}) {
  if (offer.freightPaisePerKg === undefined) return null;
  const total = offer.askPaisePerKg + offer.freightPaisePerKg;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}
function compareKnown(
  a: number | undefined | null,
  b: number | undefined | null,
) {
  return (a ?? Infinity) - (b ?? Infinity) || 0;
}
function compatibility(offer: ComparableOffer) {
  const grade = offer.specification?.grade.trim().toUpperCase(),
    specification = offer.specification?.specification.trim();
  return grade && specification
    ? `${offer.material.code}:0:${grade}:${specification}`
    : `${offer.material.code}:1:${offer.id}`;
}
export function compareEligibleOffers(a: ComparableOffer, b: ComparableOffer) {
  return (
    compatibility(a).localeCompare(compatibility(b)) ||
    compareKnown(deliveredPrice(a), deliveredPrice(b)) ||
    compareKnown(a.distanceKm, b.distanceKm) ||
    compareKnown(a.deliveryAvailableAt, b.deliveryAvailableAt) ||
    b.createdAt - a.createdAt ||
    a.id.localeCompare(b.id)
  );
}
