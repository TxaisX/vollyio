import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Sideout — record a rep, get a frame-by-frame breakdown of every volleyball skill.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const font = await readFile(
    join(process.cwd(), "assets/SpaceGrotesk-Bold.otf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(160deg, #16303f, #0f212c)",
          color: "#f2efe6",
          fontFamily: "Space Grotesk",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 34,
            letterSpacing: 3,
            color: "#e8b93b",
          }}
        >
          SIDEOUT
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 36 }}>
            <div style={{ display: "flex", fontSize: 320, lineHeight: 0.8, color: "#e8b93b" }}>
              6
            </div>
            <div style={{ display: "flex", flexDirection: "column", paddingBottom: 44 }}>
              <div style={{ display: "flex", fontSize: 42, color: "#f2efe6" }}>
                skills scored
              </div>
              <div style={{ display: "flex", fontSize: 42, color: "#b9c4c9" }}>
                0–100, frame by frame
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 46,
              marginTop: 28,
              maxWidth: 920,
              color: "#f2efe6",
            }}
          >
            Fix the one thing holding your game back.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Space Grotesk", data: font, weight: 700, style: "normal" },
      ],
    },
  );
}
