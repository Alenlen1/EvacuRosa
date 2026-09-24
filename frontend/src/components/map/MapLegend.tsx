export function MapLegend() {
  return (
    <details className="map-legend">
      <summary>Map legend</summary>
      <ul>
        <li><span className="legend-dot location" />Your location</li>
        <li><span className="legend-dot destination" />Selected destination</li>
        <li><span className="legend-line route" />Recommended route</li>
        <li><span className="legend-line blocked" />Blocked flood road</li>
        <li><span className="legend-line flood" />Flood-affected road</li>
        <li><span className="legend-dot shelter" />Evacuation center — see status</li>
        <li><span className="legend-dot fire" />Fire incident</li>
        <li><span className="legend-dot earthquake" />Earthquake — see verified impacts</li>
      </ul>
    </details>
  );
}
