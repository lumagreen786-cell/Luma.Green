/** A destination must be supplied; never route a booking to a made-up number. */
export function whatsappBookingUrl(
  number: string | undefined,
  message: string,
): string | null {
  return !number || !/^[1-9]\d{6,14}$/.test(number)
    ? null
    : `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
