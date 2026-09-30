"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibre, Marker, Popup, NavigationControl, type StyleSpecification, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";

export interface Marcador {
  id: string;
  lat: number;
  lng: number;
  cor?: string;
  rotulo?: string;
  raioM?: number; // desenha geofence
}

interface Props {
  centro?: { lat: number; lng: number };
  zoom?: number;
  marcadores?: Marcador[];
  /** Ponto editável (arrastável); onMover recebe a nova posição. */
  editavel?: { lat: number; lng: number; raioM: number } | null;
  onMover?: (lat: number, lng: number) => void;
  altura?: string;
}

const ESTILO_OSM: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function circulo(lat: number, lng: number, raioM: number): Feature<Polygon> {
  const pontos = 48;
  const coords: [number, number][] = [];
  const kmLat = 110.574;
  const kmLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i <= pontos; i++) {
    const a = (i / pontos) * 2 * Math.PI;
    coords.push([lng + ((raioM / 1000) * Math.cos(a)) / kmLng, lat + ((raioM / 1000) * Math.sin(a)) / kmLat]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

// Centro padrão: Manaus/AM
const MANAUS = { lat: -3.119, lng: -60.0217 };

export function Mapa({ centro, zoom = 13, marcadores = [], editavel, onMover, altura = "320px" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapLibre | null>(null);
  const marcadorEditavel = useRef<Marker | null>(null);
  const marcadoresRef = useRef<Marker[]>([]);
  const propsRef = useRef({ marcadores, editavel, onMover });
  useEffect(() => {
    propsRef.current = { marcadores, editavel, onMover };
  });

  function atualizar() {
    const m = mapa.current;
    if (!m || !m.isStyleLoaded()) return;
    const { marcadores: mks, editavel: ed, onMover: mover } = propsRef.current;
    marcadoresRef.current.forEach((mk) => mk.remove());
    marcadoresRef.current = [];
    const features: Feature<Polygon>[] = [];

    for (const mk of mks) {
      const el = document.createElement("div");
      el.style.cssText = `width:18px;height:18px;border-radius:50%;background:${mk.cor ?? "#6d28d9"};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
      const marker = new Marker({ element: el }).setLngLat([mk.lng, mk.lat]);
      if (mk.rotulo) marker.setPopup(new Popup({ offset: 12 }).setText(mk.rotulo));
      marker.addTo(m);
      marcadoresRef.current.push(marker);
      if (mk.raioM) features.push(circulo(mk.lat, mk.lng, mk.raioM));
    }

    if (ed) {
      if (!marcadorEditavel.current) {
        marcadorEditavel.current = new Marker({ color: "#9f1239", draggable: Boolean(mover) }).setLngLat([ed.lng, ed.lat]).addTo(m);
        marcadorEditavel.current.on("dragend", () => {
          const p = marcadorEditavel.current!.getLngLat();
          propsRef.current.onMover?.(p.lat, p.lng);
        });
      } else {
        marcadorEditavel.current.setLngLat([ed.lng, ed.lat]);
      }
      features.push(circulo(ed.lat, ed.lng, ed.raioM));
    } else if (marcadorEditavel.current) {
      marcadorEditavel.current.remove();
      marcadorEditavel.current = null;
    }

    const src = m.getSource("geofences") as GeoJSONSource | undefined;
    const fc: FeatureCollection<Polygon> = { type: "FeatureCollection", features };
    src?.setData(fc);
  }

  useEffect(() => {
    if (!ref.current || mapa.current) return;
    const { marcadores: mks, editavel: ed } = propsRef.current;
    const c = centro ?? (ed ? { lat: ed.lat, lng: ed.lng } : mks[0] ? { lat: mks[0].lat, lng: mks[0].lng } : MANAUS);
    const m = new MapLibre({ container: ref.current, style: ESTILO_OSM, center: [c.lng, c.lat], zoom, attributionControl: { compact: true } });
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("geofences", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({ id: "geofences-fill", type: "fill", source: "geofences", paint: { "fill-color": "#6d28d9", "fill-opacity": 0.12 } });
      m.addLayer({ id: "geofences-line", type: "line", source: "geofences", paint: { "line-color": "#6d28d9", "line-width": 2 } });
      atualizar();
    });
    m.on("click", (e: MapMouseEvent) => propsRef.current.onMover?.(e.lngLat.lat, e.lngLat.lng));
    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    atualizar();
  }, [marcadores, editavel]);

  useEffect(() => {
    if (centro && mapa.current) mapa.current.easeTo({ center: [centro.lng, centro.lat] });
  }, [centro]);

  return <div ref={ref} style={{ height: altura }} className="w-full overflow-hidden rounded-2xl border border-border" />;
}
