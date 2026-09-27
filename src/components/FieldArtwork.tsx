import { useMemo, useRef, useState } from "react";
import type { EffectId } from "../types";
import { geoDistance, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import world from "world-atlas/countries-110m.json";
import type { FeatureCollection } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

const effects = import.meta.glob("../assets/effects/*.{webp,png}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Transparent chrome renders derived from the FIELD material reference. */
export function FxArtwork({ effect }: { effect: EffectId }) {
  const asset =
    effect === "original" || effect === "echo"
      ? "clean"
      : effect === "resonator"
        ? "warm"
        : effect === "tapeStop"
          ? "tape"
          : effect;
  const extension =
    effect === "chorus" || effect === "flanger" ? "png" : "webp";
  return (
    <img
      className="effect-art"
      src={effects[`../assets/effects/${asset}.${extension}`]}
      alt=""
      width="320"
      height="320"
      decoding="async"
    />
  );
}

export interface GlobeMarker {
  id: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
}
export function FieldGlobe({
  markers = [],
  onMarker,
}: {
  markers?: GlobeMarker[];
  onMarker?: (marker: GlobeMarker) => void;
}) {
  const [rotation, setRotation] = useState<[number, number]>([-44, -35]);
  const drag = useRef<{
    x: number;
    y: number;
    rotation: [number, number];
  } | null>(null);
  const topology = world as unknown as Topology;
  const land = useMemo(
    () =>
      feature(
        topology,
        topology.objects.countries as GeometryCollection,
      ) as FeatureCollection,
    [topology],
  );
  const projection = useMemo(
    () =>
      geoOrthographic()
        .translate([180, 180])
        .scale(164)
        .clipAngle(90)
        .precision(0.3)
        .rotate([rotation[0], rotation[1], 0]),
    [rotation],
  );
  const path = geoPath(projection);
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x,
      dy = event.clientY - drag.current.y;
    setRotation([
      drag.current.rotation[0] + dx * 0.32,
      Math.max(-80, Math.min(80, drag.current.rotation[1] - dy * 0.32)),
    ]);
  };
  return (
    <svg
      className="world-planet interactive-globe"
      viewBox="0 0 360 360"
      role="img"
      aria-label="Interactive globe; drag to rotate"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, rotation };
      }}
      onPointerMove={move}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <defs>
        <radialGradient id="globeOcean" cx="30%" cy="22%" r="80%">
          <stop stopColor="#fff8fd" />
          <stop offset=".38" stopColor="#ffd1eb" />
          <stop offset=".78" stopColor="#fb79c4" />
          <stop offset="1" stopColor="#d82b94" />
        </radialGradient>
        <linearGradient id="globeLand" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffdff2" />
          <stop offset=".48" stopColor="#f76abd" />
          <stop offset="1" stopColor="#c91d82" />
        </linearGradient>
      </defs>
      <path
        d={path({ type: "Sphere" }) || ""}
        fill="url(#globeOcean)"
        stroke="#fff"
        strokeWidth="2"
      />
      <path
        d={path(land) || ""}
        fill="url(#globeLand)"
        stroke="#ffeaf6"
        strokeWidth=".55"
      />
      <path
        d={path({ type: "Sphere" }) || ""}
        fill="none"
        stroke="#fff"
        strokeOpacity=".72"
        strokeWidth="2"
      />
      {markers.map((marker) => {
        const visible =
          geoDistance([-rotation[0], -rotation[1]], [marker.lng, marker.lat]) <
          Math.PI / 2;
        const point = projection([marker.lng, marker.lat]);
        if (!visible || !point) return null;
        return (
          <g
            className="globe-marker"
            key={marker.id}
            transform={`translate(${point[0]} ${point[1]})`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onMarker?.(marker)}
            role="button"
            aria-label={`${marker.city}, ${marker.country}: ${marker.count} sounds`}
          >
            <circle r="10" />
            <text textAnchor="middle" dominantBaseline="central">
              {marker.count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
