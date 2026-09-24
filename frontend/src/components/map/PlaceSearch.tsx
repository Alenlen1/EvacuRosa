"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import type { EvacuationCenter } from "@/services/api";
import { searchPlaces, withinSearchBounds, type PlaceResult } from "@/lib/placeSearch";

export function PlaceSearch({ centers, online, onSelect }: {
  centers: EvacuationCenter[];
  online: boolean;
  onSelect: (place: PlaceResult) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<{ query: string; results: PlaceResult[]; error?: string } | null>(null);
  const term = query.trim();
  const eligible = term.length >= 2;
  const local: PlaceResult[] = eligible ? centers.filter(center =>
    withinSearchBounds(center.latitude, center.longitude) && term.toLowerCase().split(/\s+/).every(word =>
      `${center.name} ${center.address} ${center.barangayName ?? ""}`.toLowerCase().includes(word)
    )).slice(0, 5).map(center => ({
      id: `center-${center.id}`, latitude: center.latitude, longitude: center.longitude,
      label: { title: center.name, subtitle: center.address, source: "center" },
    })) : [];
  const external = online && remote?.query === term ? remote.results : [];
  const results = [...local, ...external.filter(place => !local.some(center =>
    center.label.title.toLowerCase() === place.label.title.toLowerCase()
  ))];
  const busy = online && eligible && remote?.query !== term;

  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);

  useEffect(() => {
    if (!open || !eligible || !online) return;
    const controller = new AbortController();
    // Search only after typing pauses; GPS updates never trigger a search.
    const timer = setTimeout(() => {
      searchPlaces(term, controller.signal).then(results => {
        if (!controller.signal.aborted) { setRemote({ query: term, results }); setActive(-1); }
      }).catch(() => {
        if (!controller.signal.aborted) setRemote({ query: term, results: [], error: "Place search unavailable. Try again or tap the map." });
      });
    }, 700);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, eligible, online, open]);

  function select(place: PlaceResult) {
    onSelect(place);
    setQuery(place.label.title);
    setOpen(false);
    setActive(-1);
    input.current?.blur();
  }

  return (
    <div className="place-search" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <div className="place-search-field">
        <Search size={19} aria-hidden="true" />
        <input ref={input} role="combobox" aria-label="Search places in Santa Rosa" aria-autocomplete="list"
          aria-expanded={open && eligible} aria-controls={`${id}-results`}
          aria-activedescendant={open && active >= 0 && results[active] ? `${id}-${active}` : undefined}
          autoComplete="off" placeholder="Search a place in Santa Rosa…" value={query} maxLength={160}
          onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
          onKeyDown={event => {
            if (event.key === "Escape") { setOpen(false); setActive(-1); }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); setOpen(true);
              if (results.length) setActive(index => event.key === "ArrowDown" ? (index + 1) % results.length : (index <= 0 ? results.length - 1 : index - 1));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (open && results[active >= 0 ? active : 0]) select(results[active >= 0 ? active : 0]);
              else setOpen(true);
            }
          }} />
        {query && <button type="button" aria-label="Clear search text" onClick={() => { setQuery(""); setActive(-1); setOpen(false); input.current?.focus(); }}><X size={18} /></button>}
      </div>
      {open && eligible && <div className="place-search-dropdown">
        <ul id={`${id}-results`} role="listbox" aria-label="Place suggestions">
          {results.map((place, index) => <li key={place.id} id={`${id}-${index}`} role="option" aria-selected={active === index}
            onMouseDown={event => event.preventDefault()} onClick={() => select(place)}>
            <MapPin size={18} aria-hidden="true" /><span><strong>{place.label.title}</strong><small>{place.label.source === "center" ? "Evacuation center · " : ""}{place.label.subtitle}</small></span>
          </li>)}
        </ul>
        <p role="status">{!online ? "Offline: searching loaded evacuation centers only." : busy ? "Searching Santa Rosa…" : remote?.query === term && remote.error ? remote.error : results.length === 0 ? "No matches in the map area. Try a street, landmark or barangay." : "Select a place to set your destination."}</p>
        <small className="search-attribution">Place search: <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">Photon</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a></small>
      </div>}
    </div>
  );
}
