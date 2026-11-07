// Packaging feedstock. Textile outputs and unwashed scrap use the general market.
export function isRecycledPetFeedstock(code: string) {
  return [
    "RECYCLED-PET-FLAKE",
    "RECYCLED-PET-COLD-FLAKE",
    "RECYCLED-PET-HOT-FLAKE",
    "RECYCLED-PET-PELLET",
  ].includes(code);
}
