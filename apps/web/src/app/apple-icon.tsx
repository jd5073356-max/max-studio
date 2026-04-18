import { ImageResponse } from "next/og";

// Apple touch icon 180x180 — iOS home screen.
// Next 16 file-convention: se sirve como /apple-icon.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7C3AED",
          color: "#FAFAFA",
          fontSize: 112,
          fontWeight: 700,
          letterSpacing: "-0.05em",
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
