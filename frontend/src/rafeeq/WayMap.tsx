import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Point } from "./places";
import r from "./rafeeq.module.css";

/**
 * The map on "Find my way": where the pilgrim is (blue), where they are going
 * (green, named), and the holy sites around (grey). Loaded only when this
 * screen opens. Tiles are OpenStreetMap's: free for a pilot; a real season
 * needs a paid tile service or our own, as OpenStreetMap asks of busy apps.
 */
export default function WayMap({
  me,
  to,
  toName,
  meName,
  sites,
}: {
  me: Point | null;
  to: Point;
  toName: string;
  meName: string;
  sites: (Point & { name: string })[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marks = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const m = L.map(box.current!, { zoomControl: true, attributionControl: true });
    /* the demo build runs where outside images are blocked: the places and the line, on a plain ground */
    if (import.meta.env.VITE_MAP_TILES !== "off")
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
    marks.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const layer = marks.current;
    if (!m || !layer) return;
    layer.clearLayers();
    for (const s of sites)
      L.circleMarker([s.lat, s.lon], { radius: 6, color: "#55625d", weight: 2, fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip(s.name)
        .addTo(layer);
    L.circleMarker([to.lat, to.lon], { radius: 13, color: "#fff", weight: 3, fillColor: "#2e7d4f", fillOpacity: 1 })
      .bindTooltip(toName, { permanent: true, direction: "top", offset: [0, -12] })
      .addTo(layer);
    if (me) {
      L.polyline(
        [
          [me.lat, me.lon],
          [to.lat, to.lon],
        ],
        { color: "#1565c0", weight: 4, dashArray: "8 8" },
      ).addTo(layer);
      L.circleMarker([me.lat, me.lon], { radius: 10, color: "#fff", weight: 3, fillColor: "#1565c0", fillOpacity: 1 })
        .bindTooltip(meName, { permanent: true, direction: "bottom", offset: [0, 10] })
        .addTo(layer);
      m.fitBounds(
        L.latLngBounds([
          [me.lat, me.lon],
          [to.lat, to.lon],
        ]),
        { padding: [48, 48], maxZoom: 17 },
      );
    } else {
      m.setView([to.lat, to.lon], 16);
    }
  }, [me, to, toName, meName, sites]);

  return <div ref={box} className={r.map} />;
}
