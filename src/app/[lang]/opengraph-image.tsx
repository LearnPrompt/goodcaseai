import { ImageResponse } from "next/og";
import { loadChineseFont } from "@/lib/og-font";
import { SITE_HOST } from "@/lib/site";
import { normalizeLocale } from "@/i18n/config";

export const revalidate = 300;

export const alt = "GoodCase.ai AI case evidence library";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const TAGLINE_ZH = "从真实作品，回到作者与方法";
const TAGLINE_EN = "Evidence-first AI case library";

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const locale = normalizeLocale((await params).lang);
  const isEnglish = locale === "en";
  const fontData = isEnglish ? null : await loadChineseFont(TAGLINE_ZH);
  const tagline = isEnglish ? TAGLINE_EN : fontData ? TAGLINE_ZH : TAGLINE_EN;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          padding: "72px 80px",
          fontFamily: fontData ? "Noto Sans SC" : "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                backgroundColor: "#c2410c",
              }}
            />
            <div
              style={{
                fontSize: "34px",
                fontWeight: 600,
                color: "#fafaf7",
                letterSpacing: "-0.01em",
              }}
            >
              GoodCase.ai
            </div>
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#6b6b66",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
            }}
          >
            Case / Creator / Evidence
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          <div
            style={{
              fontSize: "84px",
              fontWeight: 500,
              lineHeight: 1.05,
              color: "#fafaf7",
              letterSpacing: "-0.03em",
            }}
          >
            {tagline}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "3px",
                backgroundColor: "#c2410c",
              }}
            />
            <div style={{ fontSize: "26px", color: "#a3a39e" }}>{SITE_HOST}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [
            {
              name: "Noto Sans SC",
              data: fontData,
              style: "normal",
              weight: 500,
            },
          ]
        : undefined,
    }
  );
}
