"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvent } from "react-leaflet";
import type { Coords } from "@/lib/discover-logic";
import { monogramInitial, paletteFor } from "@/lib/monogram";
import { hasLocation, type Business } from "@/lib/types/salon";

/**
 * The leaflet half of the map, ported from `SalonMap` in
 * `tho/app/lib/customer/map_view.dart`: greyscale OSM tiles, a circular photo bubble
 * per salon, and a "you are here" dot.
 *
 * **This is the only file in the project that touches leaflet, and it is loaded with
 * `ssr: false`.** `MapContainer` reads `window` while constructing, so rendering it on
 * the server throws; `map-view.tsx` owns the dynamic import. Keeping the boundary here
 * also means the search field, the rail and the preview card all render server-side
 * and stay interactive while ~150 KB of map arrives.
 *
 * **Leaflet owns the DOM inside a marker**, so a bubble cannot be a React component —
 * it is an HTML string handed to `L.divIcon`. That is why `paletteFor` lives in
 * `lib/monogram.ts`: the bubble and the salon card have to agree about which gradient
 * is Norzin, and two implementations would drift.
 */

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/**
 * **Attribution is rendered, and the app does not render it.** A deliberate addition
 * rather than a port: OSM's tile usage policy requires visible credit, and a public
 * website is exactly the case it is written for. If this ever carries real traffic it
 * needs a paid tile host, not a bigger cache — the policy also rules out bulk use.
 */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** `initialZoom: 13` in `map_view.dart:128`. */
const ZOOM = 13;

const BUBBLE = 44;
const BUBBLE_SELECTED = 56;

/** Escape a value going into an HTML string. Only the initial and a URL do. */
function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * A salon bubble: the seeded gradient and its initial as the base layer, the cover
 * photo over it.
 *
 * The photo is a plain `<img alt="">` on top rather than a `background-image`, and that
 * ordering is the fallback: a background would hide the initial whenever it loaded,
 * while a failed `<img>` with an empty alt renders nothing at all and simply reveals
 * the gradient underneath. Same outcome as `CoverImage`'s `onError`, with no
 * JavaScript in an injected string.
 */
function bubbleIcon(business: Business, selected: boolean): L.DivIcon {
  const size = selected ? BUBBLE_SELECTED : BUBBLE;
  const palette = paletteFor(business.name);
  const ring = selected ? "var(--color-rausch)" : "var(--color-canvas)";
  const photo = business.coverUrl
    ? `<img src="${esc(business.coverUrl)}" alt="" ` +
      `style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`
    : "";

  return L.divIcon({
    // No default class: `leaflet-div-icon` paints a white box with a border.
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<div class="salon-bubble" style="` +
      `width:${size}px;height:${size}px;border:3px solid ${ring};` +
      `background:linear-gradient(135deg,${palette.from},${palette.to});` +
      `font-size:${Math.round(size * 0.34)}px">` +
      `<span>${esc(monogramInitial(business.name))}</span>${photo}</div>`,
  });
}

/** The "you are here" dot: blue core, white ring, soft halo (`_UserDot`). */
const USER_DOT = L.divIcon({
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: '<div class="salon-user-dot"><span></span></div>',
});

/**
 * Pan to the selected salon when the selection changes, keeping the current zoom —
 * `didUpdateWidget`'s `_map.move(focus, _map.camera.zoom)`.
 *
 * An effect is right here: it is a call into an imperative library keyed off a prop,
 * not state being reset. The stringified key means panning happens once per *place*,
 * so re-rendering for an unrelated reason does not yank the viewport back.
 */
function PanTo({ focus }: { focus: Coords | null }) {
  const map = useMap();
  const key = focus ? `${focus.lat},${focus.lng}` : null;
  useEffect(() => {
    if (!key) return;
    const [lat, lng] = key.split(",").map(Number) as [number, number];
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [key, map]);
  return null;
}

/** Tapping the basemap clears the selection, as `MapOptions.onTap` does. */
function ClearOnMapTap({ onClear }: { onClear: () => void }) {
  useMapEvent("click", onClear);
  return null;
}

export type SalonMapProps = {
  /** Located salons only — the caller has already filtered and searched. */
  salons: Business[];
  /** The viewer's resolved fix. Also where the dot goes. */
  center: Coords;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
};

export function SalonMap({ salons, center, selectedId, onSelect, onClear }: SalonMapProps) {
  const selected = salons.find((b) => b.id === selectedId) ?? null;
  const focus =
    selected && hasLocation(selected) ? { lat: selected.lat, lng: selected.lng } : null;

  // The map is mounted once with an initial centre; everything after that is a
  // `setView` from `PanTo`. Recomputing `initialCenter` on every render is harmless
  // (leaflet reads it once) but memoising documents that it is not a live prop.
  const initialCenter = useMemo<[number, number]>(
    () => [focus?.lat ?? center.lat, focus?.lng ?? center.lng],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-time value only
    [],
  );

  return (
    <MapContainer
      center={initialCenter}
      zoom={ZOOM}
      zoomControl={false}
      className="salon-map h-full w-full"
      // Leaflet renders its own focus outline on the container; the salons are
      // reachable through the rail and the preview card, which are real links.
      keyboard={false}
    >
      <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
      <PanTo focus={focus} />
      <ClearOnMapTap onClear={onClear} />

      <Marker position={[center.lat, center.lng]} icon={USER_DOT} interactive={false} />

      {salons.map((b) =>
        hasLocation(b) ? (
          <Marker
            key={b.id}
            position={[b.lat, b.lng]}
            icon={bubbleIcon(b, b.id === selectedId)}
            // Selected sits above its neighbours: two live salons are 6 m apart, so
            // without this the one you just picked can be hidden by the other.
            zIndexOffset={b.id === selectedId ? 1000 : 0}
            eventHandlers={{ click: () => onSelect(b.id) }}
            alt={b.name}
          />
        ) : null,
      )}
    </MapContainer>
  );
}
