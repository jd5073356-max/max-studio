import { ImageResponse } from "next/og";

// Favicon dinámico 32x32 — genera la "M" morada en fondo oscuro.
// Next 16 file-convention: se sirve como /icon y se inyecta en <head>.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0B",
          color: "#7C3AED",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.05em",
          borderRadius: 6,
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
