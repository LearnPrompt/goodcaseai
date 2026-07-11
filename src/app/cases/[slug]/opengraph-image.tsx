import { ImageResponse } from "next/og";
import { getCaseDetailData } from "@/lib/cases";
import { loadChineseFont } from "@/lib/og-font";

export const revalidate = 300;

export const alt = "GoodCase.ai 案例";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const CATEGORY_LABELS: Record<string, string> = {
  image: "AI 图像",
  video: "AI 视频",
  web: "AI 编程(UI)",
  copy: "AI 文案",
};

const CATEGORY_LABELS_EN: Record<string, string> = {
  image: "AI IMAGE",
  video: "AI VIDEO",
  web: "AI CODING (UI)",
  copy: "AI COPY",
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getCaseDetailData(slug);

  const title = item?.title || "GoodCase.ai 案例";
  const categoryKey = item?.category || "image";

  const fontData = await loadChineseFont(
    `${title}${CATEGORY_LABELS[categoryKey]}案例`
  );

  const displayTitle = fontData ? title : slug.replace(/-/g, " ");
  const displayCategory = fontData
    ? CATEGORY_LABELS[categoryKey]
    : CATEGORY_LABELS_EN[categoryKey];

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
          padding: "64px 80px",
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
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "18px",
                height: "18px",
                backgroundColor: "#ff5733",
              }}
            />
            <div
              style={{
                fontSize: "30px",
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
              display: "flex",
              border: "2px solid #ff5733",
              color: "#ff5733",
              fontSize: "22px",
              padding: "8px 20px",
              letterSpacing: "0.08em",
            }}
          >
            {displayCategory}
          </div>
        </div>

        <div
          style={{
            fontSize: displayTitle.length > 18 ? "60px" : "76px",
            fontWeight: 500,
            lineHeight: 1.15,
            color: "#fafaf7",
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          {displayTitle}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #333330",
            paddingTop: "28px",
          }}
        >
          <div style={{ fontSize: "24px", color: "#a3a39e", display: "flex" }}>
            {fontData ? "点赞解锁完整 Prompt" : "Unlock the full prompt"}
          </div>
          <div style={{ fontSize: "24px", color: "#6b6b66" }}>goodcase.ai</div>
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
