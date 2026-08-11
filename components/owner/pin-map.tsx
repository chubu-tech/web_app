"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvent } from "react-leaflet";
import type { Coords } from "@/lib/discover-logic";
import { monogramInitial, paletteFor } from "@/lib/monogram";

/**
 * The leaflet half of the salon's map pin — the second island in the project, obeying the
 * same boundary as the first: **this and `salon-map.tsx` are the only files that touch
 * leaflet, and both are loaded with `ssr: false`**, because `MapContainer` reads `window`
 * while constructing. `pin-picker.tsx` owns this one's dynamic import.
 *
 * Deliberately *not* a variant of `salon-map.tsx`. That answers "where are all the salons",
 * with a marker per business, a selection stamp and a pan keyed to it; this answers "where is
 * *this* salon", with one draggable marker and no selection at all. Parameterising the first
 * to cover both would mean props that contradict each other — `salons` beside `onMove` — and
 * everything genuinely shared already is: the greyscale tiles and the bubble come from
 * `app/globals.css`'s `.salon-map` / `.salon-bubble`, and the gradient from `lib/monogram.ts`,
 * so the pin an owner drags is the same circle their salon shows everywhere else.
 *
 * Two ways to place it, because they answer different moments: **drag** (fine placement, from
 * the shopfront you can see on the map) and **click the basemap** (a coarse first placement on
 * a salon that has never been pinned). "Use my location" needs no map and lives in the parent.
 */

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** OSM's usage policy requires visible credit — the full note is in `salon-map.tsx`. */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Closer than the discover map's 13: this is one address, not a town. */
const ZOOM = 16;
const BUBBLE = 48;

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The salon's own bubble, in the markup `.salon-bubble` expects — an HTML string, because
 * leaflet owns the DOM inside a marker. Always ringed in rausch: there is one pin here and it
 * is the thing being moved, which is exactly what the selected ring means on the other map.
 */
function bubbleIcon(name: string, coverUrl: string | null): L.DivIcon {
  const palette = paletteFor(name);
  const photo = coverUrl
    ? `<img src="${esc(coverUrl)}" alt="" ` +
      `style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`
    : "";
  return L.divIcon({
    // No default class: `leaflet-div-icon` paints a white box with a border.
    className: "",
    iconSize: [BUBBLE, BUBBLE],
    iconAnchor: [BUBBLE / 2, BUBBLE / 2],
    html:
      `<div class="salon-bubble" style="` +
      `width:${BUBBLE}px;height:${BUBBLE}px;border:3px solid var(--color-rausch);` +
      `background:linear-gradient(135deg,${palette.from},${palette.to});` +
      `font-size:${Math.round(BUBBLE * 0.34)}px">` +
      `<span>${esc(monogramInitial(name))}</span>${photo}</div>`,
  });
}

/** A click anywhere on the basemap moves the pin there. */
function ClickToPlace({ onMove }: { onMove: (coords: Coords) => void }) {
  useMapEvent("click", (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }));
  return null;
}

/**
 * Follow a move that came from outside the map — "Use my location", or the first pin on a
 * salon that had none. Keyed on `panKey` rather than the coordinates: dragging the marker also
 * changes them, and panning under the cursor mid-gesture fights the drag.
 */
function PanTo({ coords, panKey }: { coords: Coords; panKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (panKey === 0) return;
    map.setView([coords.lat, coords.lng], map.getZoom(), { animate: true });
    // `panKey` is the signal, and the coordinates deliberately are not dependencies: as
    // dependencies this would also fire on a drag, which is the one move it must not follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panKey, map]);
  return null;
}

export function PinMap({
  name,
  coverUrl,
  coords,
  panKey,
  onMove,
}: {
  name: string;
  coverUrl: string | null;
  coords: Coords;
  /** Incremented by the parent when the move came from outside the map. */
  panKey: number;
  onMove: (coords: Coords) => void;
}) {
  const icon = useMemo(() => bubbleIcon(name, coverUrl), [name, coverUrl]);
  // Mount-time value only — leaflet reads `center` once, and `PanTo` owns every move after
  // that. Same shape as `salon-map.tsx`'s.
  const initialCenter = useMemo<[number, number]>(
    () => [coords.lat, coords.lng],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <MapContainer
      center={initialCenter}
      zoom={ZOOM}
      zoomControl={false}
      attributionControl
      // `salon-map` is what greyscales the tile pane in `app/globals.css`.
      className="salon-map h-full w-full"
    >
      <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} />
      <ClickToPlace onMove={onMove} />
      <PanTo coords={coords} panKey={panKey} />
      <Marker
        position={[coords.lat, coords.lng]}
        icon={icon}
        draggable
        autoPan
        eventHandlers={{
          dragend: (e) => {
            const { lat, lng } = (e.target as L.Marker).getLatLng();
            onMove({ lat, lng });
          },
        }}
      />
    </MapContainer>
  );
}
