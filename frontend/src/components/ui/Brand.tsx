import { Navigation } from "lucide-react";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true"><Navigation size={27} strokeWidth={2.5} /></span>
      <span><span className="brand-name">EVACU<span>ROSA</span></span><span className="brand-caption">SANTA ROSA, LAGUNA</span></span>
    </span>
  );
}
