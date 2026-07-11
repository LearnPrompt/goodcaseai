/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- satori/ImageResponse JSX：next/image 与 alt 在离屏渲染中不可用 */
import { ImageResponse } from "next/og";
import { renderSVG } from "uqr";
import { getCaseDetailData } from "@/lib/cases";
import { loadChineseFont } from "@/lib/og-font";

export const revalidate = 3600;

const WIDTH = 1080;
const HEIGHT = 1440;

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

const COST_BAND_LABELS: Record<string, string> = {
  low: "成本低",
  medium: "成本中",
  high: "成本高",
};

function truncate(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

// 预取案例主图并转成 dataURL：satori 里外链 <img> 拉取失败会直接抛错，
// 这里自己 fetch 一遍，失败就降级为纯排版版面。
async function loadHeroImage(
  src: string | undefined,
  origin: string
): Promise<string | null> {
  if (!src) {
    return null;
  }

  try {
    const url = src.startsWith("/") ? `${origin}${src}` : src;
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    // satori 只稳定支持 png / jpeg / gif / svg，其他格式（如 webp）直接降级。
    if (!/image\/(png|jpe?g|gif|svg)/i.test(contentType)) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    // 超过 ~5MB 的图不内联，避免海报渲染超时。
    if (buffer.byteLength > 5 * 1024 * 1024) {
      return null;
    }

    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const item = await getCaseDetailData(slug);

  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const caseUrl = `https://goodcase.ai/cases/${slug}`;

  const categoryKey = item.category;
  const summary = truncate(item.summary, 40);
  const models = item.recommendedModels.slice(0, 2);
  const costLabel = COST_BAND_LABELS[item.costBand] || "成本中";

  // 视频案例用封面图，图片案例直接用主图。
  const heroSrc = item.mediaType === "video" ? item.posterUrl : item.mediaUrl;
  const [fontData, heroImage] = await Promise.all([
    loadChineseFont(
      `${item.title}${summary}${CATEGORY_LABELS[categoryKey]}${models.join(
        ""
      )}${costLabel}好案例点赞解锁完整Prompt扫码看案例·`
    ),
    loadHeroImage(heroSrc, origin),
  ]);

  const zh = Boolean(fontData);
  const displayTitle = zh ? item.title : slug.replace(/-/g, " ");
  const displayCategory = zh
    ? CATEGORY_LABELS[categoryKey]
    : CATEGORY_LABELS_EN[categoryKey];

  const qrSvg = renderSVG(caseUrl, { ecc: "M", border: 1 });
  const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString(
    "base64"
  )}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fafaf7",
          color: "#111110",
          fontFamily: zh ? "Noto Sans SC" : "sans-serif",
        }}
      >
        {/* 上部：案例主图，加载失败降级为纯排版分类块 */}
        {heroImage ? (
          <img
            src={heroImage}
            width={WIDTH}
            height={640}
            style={{
              width: "1080px",
              height: "640px",
              objectFit: "cover",
              borderBottom: "1px solid #111110",
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "1080px",
              height: "640px",
              padding: "56px 64px",
              borderBottom: "1px solid #111110",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#ff5733",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: "120px",
                fontWeight: 500,
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              {displayCategory}
            </div>
          </div>
        )}

        {/* 中部：分类标签 + 标题 + 摘要 + 模型/成本小标签 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            padding: "48px 64px 40px",
            gap: "28px",
          }}
        >
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                border: "1px solid #ff5733",
                color: "#ff5733",
                fontSize: "22px",
                padding: "6px 16px",
                letterSpacing: "0.1em",
              }}
            >
              {displayCategory}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: displayTitle.length > 16 ? "56px" : "68px",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {truncate(displayTitle, 32)}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "28px",
              color: "#55554f",
              lineHeight: 1.4,
            }}
          >
            {zh ? summary : "A curated AI case from GoodCase.ai"}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            {models.map((model) => (
              <div
                key={model}
                style={{
                  display: "flex",
                  border: "1px solid #d9d9d2",
                  backgroundColor: "#ffffff",
                  color: "#111110",
                  fontSize: "22px",
                  padding: "8px 18px",
                }}
              >
                {model}
              </div>
            ))}
            <div
              style={{
                display: "flex",
                border: "1px solid #d9d9d2",
                backgroundColor: "#ffffff",
                color: "#55554f",
                fontSize: "22px",
                padding: "8px 18px",
              }}
            >
              {zh ? costLabel : item.costBand.toUpperCase()}
            </div>
          </div>
        </div>

        {/* 底部：品牌区 + 解锁提示 + 二维码铭牌 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid #111110",
            padding: "40px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
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
                  width: "20px",
                  height: "20px",
                  backgroundColor: "#ff5733",
                }}
              />
              <div
                style={{
                  display: "flex",
                  fontSize: "34px",
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {zh ? "goodcase.ai · 好案例" : "goodcase.ai"}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                color: "#ff5733",
              }}
            >
              {zh ? "点赞解锁完整 Prompt" : "Unlock the full prompt"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              border: "1px solid #111110",
              backgroundColor: "#ffffff",
              padding: "16px",
            }}
          >
            <img src={qrDataUrl} width={200} height={200} />
            <div
              style={{
                display: "flex",
                fontSize: "18px",
                color: "#55554f",
                letterSpacing: "0.06em",
              }}
            >
              {zh ? "扫码看案例" : "SCAN TO VIEW"}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
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
