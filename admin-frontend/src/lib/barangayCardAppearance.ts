// Interface colors are tied to names so sorting never changes a barangay's color.
const barangayThemes: Record<string, readonly [string, string]> = {
  aplaya: ["#dceaf2", "#355e76"],
  balibago: ["#edd3d9", "#844d5a"],
  caingin: ["#e4e9d6", "#596635"],
  dila: ["#ded0ec", "#6e4c80"],
  dita: ["#f5e4cf", "#885e2e"],
  "don jose": ["#d9ebe5", "#35695b"],
  ibaba: ["#f1dfe8", "#854f6b"],
  kanluran: ["#dee3f1", "#4e5d87"],
  labas: ["#eee7d2", "#75602f"],
  macabling: ["#dce8db", "#476c43"],
  malitlit: ["#e0cbd3", "#785565"],
  malusak: ["#eaded3", "#7b5843"],
  "market area (poblacion)": ["#d7e9eb", "#336b72"],
  pooc: ["#d7d0df", "#635381"],
  "pulong santa cruz": ["#edc6ae", "#8a5038"],
  "santo domingo": ["#e8ebd5", "#646d36"],
  sinalhan: ["#c5d3e3", "#48667b"],
  tagapo: ["#eee0d0", "#80603d"],
};

export function barangayCardAppearance(name: string) {
  const normalized = name.trim().toLowerCase();
  const key = ["market area", "poblacion"].includes(normalized)
    ? "market area (poblacion)"
    : normalized;
  const [background, accent] = barangayThemes[key] ?? ["#e7e2dc", "#746257"];
  const initials = name
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  return { background, accent, initials };
}
