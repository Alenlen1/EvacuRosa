import { Bike, Car, Footprints, Motorbike } from "lucide-react";
import { TRAVEL_MODES, type TravelMode } from "@/lib/travelTime";

const icons = { walking: Footprints, biking: Bike, motorcycle: Motorbike, car: Car };

export function TravelModeSelector({ value, onChange }: {
  value: TravelMode;
  onChange: (mode: TravelMode) => void;
}) {
  return (
    <fieldset className="travel-mode-selector" aria-describedby="travel-mode-help">
      <legend>Travel time estimate</legend>
      <div className="travel-mode-options">
        {(Object.keys(TRAVEL_MODES) as TravelMode[]).map(mode => {
          const Icon = icons[mode];
          return <label key={mode}>
            <input type="radio" name="travel-mode" value={mode} checked={value === mode} onChange={() => onChange(mode)} />
            <span><Icon size={20} aria-hidden="true" />{TRAVEL_MODES[mode].label}</span>
          </label>;
        })}
      </div>
      <p id="travel-mode-help">Changes estimated time only. Route is not checked for vehicle access. No live traffic.</p>
    </fieldset>
  );
}
