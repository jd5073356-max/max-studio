import type { MetadataRoute } from "next";

/**
 * Web App Manifest — PWA MAX Studio.
 *
 * Next 16 file-convention: este archivo se sirve en /manifest.webmanifest.
 * Colores alineados con el design system (ver globals.css).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MAX Studio",
    short_name: "MAX",
    description:
      "Interfaz gráfica de MAX — tu asistente IA. Chat, tareas, sistema y más.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0B",
    theme_color: "#0A0A0B",
    lang: "es",
    dir: "ltr",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
