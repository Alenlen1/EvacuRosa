import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function HazardSymbol({ size = 24, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

export function FloodIcon(props: IconProps) {
  return (
    <HazardSymbol {...props}>
      <path d="M2 6c2-3 4-3 6 0s4 3 6 0 4-3 8 0M2 12c2-3 4-3 6 0s4 3 6 0 4-3 8 0M2 18c2-3 4-3 6 0s4 3 6 0 4-3 8 0" />
    </HazardSymbol>
  );
}

export function FireIcon(props: IconProps) {
  return (
    <HazardSymbol {...props}>
      <path d="M13 2c1 5-4 6-3 10-2-1-3-3-3-5-2 3-4 6-3 9a8 8 0 0 0 16 0c1-5-2-9-7-14Z" fill="currentColor" stroke="none" />
      <path d="M12 12c0 3-3 4-2 6a2.3 2.3 0 0 0 4 0c1-2-1-4-2-6Z" fill="white" stroke="none" />
    </HazardSymbol>
  );
}

export function EarthquakeIcon(props: IconProps) {
  return (
    <HazardSymbol {...props}>
      <path d="m4 10 8-7 8 7M6 9v11h12V9M12 8l-2 5h4l-2 7M2 11l-1 3 2 2-1 3M22 11l1 3-2 2 1 3" />
    </HazardSymbol>
  );
}
