# Household photo requests

The household web flow can request pickup or drop-off with photos, a location/address,
a time and a name. It does not require guessed materials, weights or prices. Real
phone authentication remains required before any upload or booking.

## Client contract

- Keep selected photos local before authentication. Upload at most five JPEG, PNG
  or WebP images, sequentially, with `householdPhotos.upload({ name, bytes })`.
  Each prepared image must be at most 2 MiB. Server byte signatures determine its
  accepted content type; the filename and browser MIME value are not authorities.
- Retain each returned photo ID when retrying, so successful uploads are not repeated.
- Find shops with `households.shops({ items: [], near })`. An absent estimate means
  it is unknown. Do not display zero money or an inferred weight.
- Submit `households.book` with `items: []`, `photoIds`, and the existing shop, mode,
  date/window, address/location and name arguments. One to five owned, unclaimed
  photos are required. The server validates phone identity, shop, date and address.
- An exact retry by the same household with the same photos and request arguments
  returns the original token. Reusing claimed photos for a different request fails.
  Item-based internal bookings remain supported with their real estimates.

Photo requests store an empty item list and no estimate. Dispatch can move a request
to another eligible shop without inventing an offer. The shop records actual
materials, integer grams and payment at collection through the existing ledger flow.

## Private storage and lifecycle

Photos use Convex storage, consistent with the existing application-file path.
The current optional R2 integration remains scoped to quality attachments. This
feature needs no new account or bucket. It does require deployment of the new
`householdPhotos` table and functions.

The upload action stores bytes itself. Clients cannot attach arbitrary storage IDs.
An atomic reservation limits each signed-in phone profile to 20 uploads per hour.
Booking attachment checks current ownership and claims the photos in the same
transaction as the booking. Reservations/uploads, booking attachment and abandoned
photo deletion are audited. A scheduled cleanup removes unclaimed photos after
24 hours; attached booking evidence is retained.

`householdPhotos.list({ bookingId })` returns private metadata, and
`householdPhotos.read({ photoId })` returns bounded image bytes. Access requires the
uploading household, the currently assigned shop with read permission, or an
authenticated administrator with the required second factor. A public tracking token
never grants access. Reassignment revokes the previous shop's read authority.
Clients create temporary object URLs and revoke them when leaving the view.

Byte signature checks are not malware or complete image-decoder certification.
Mocked tests do not prove live SMS delivery, browser upload acceptance or deployment.
