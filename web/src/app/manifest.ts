import type { MetadataRoute } from "next";

// RNF-09 / RNF-10: PWA instalável (Android Chrome e iOS Safari)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fast Mídia Tools",
    short_name: "Fast Mídia",
    description: "App de campo e painel da supervisora — Fast Mídia / Vanguarda Martech",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6f7",
    theme_color: "#d03134",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
