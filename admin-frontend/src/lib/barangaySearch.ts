export function normalizeBarangaySearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:barangay|brgy)\b\.?/g, "")
    .replace(/\bsto\b\.?/g, "santo")
    .replace(/\bsta\b\.?/g, "santa")
    .replace(/[()\s.,-]+/g, " ")
    .trim();
}

export function searchBarangays<T extends { name: string }>(
  barangays: T[],
  query: string,
) {
  const tokens = normalizeBarangaySearch(query).split(" ").filter(Boolean);
  return barangays.filter((barangay) => {
    const name = normalizeBarangaySearch(barangay.name);
    return tokens.every((token) => name.includes(token));
  });
}
