import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 78px",
          color: "#111111",
          background: "#f4f4ef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 62, letterSpacing: "-5px" }}>아니근데</strong>
          <span style={{ padding: "12px 22px", border: "3px solid #111", borderRadius: 999, fontSize: 22 }}>
            7일 토론
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>친구야,</span>
          <strong style={{ marginTop: 8, fontSize: 82, lineHeight: 1.05, letterSpacing: "-6px" }}>
            너는 어떻게 생각해?
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24 }}>
          <span>주제를 읽고 · 내 생각을 고르고 · 의견을 나누는 곳</span>
          <b>anigeunde.bukae.co.kr</b>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
