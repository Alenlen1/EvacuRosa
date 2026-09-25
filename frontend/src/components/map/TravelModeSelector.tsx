import { Bike, Car, Footprints, Motorbike } from "lucide-react";
import { TRAVEL_MODES, type TravelMode } from "@/lib/travelTime";

const icons = { walking: Footprints, biking: Bike, motorcycle: Motorbike, car: Car };

export function TravelModeSelector({ value, onChange }: {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
}) {
  return (
    <fieldset className="travel-mode-selector">
      <legend>Travel mode</legend>
      <div className="travel-mode-options">
        {(Object.keys(TRAVEL_MODES) as TravelMode[]).map(mode => {
          const Icon = icons[mode];
          return <label key={mode}>
            <input type="radio" name="travel-mode" value={mode} checked={value === mode} onChange={() => onChange(mode)} />
            <span><Icon size={20} aria-hidden="true" />{TRAVEL_MODES[mode].label}</span>
          </label>;
        })}
      </div>
      <details className="travel-mode-help"><summary>Routing information</summary><p>Routes use mapped access and one-way rules. After changing mode, find a new route. Turn restrictions and live traffic are not included.</p></details>
    </fieldset>
  );
}
