import { getCaseDetailData } from "@/lib/cases";
import { normalizeLocale } from "@/i18n/config";
import { getPublicApiHeaders, toPublicDetailItem } from "../../_lib/public-case";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = normalizeLocale(new URL(request.url).searchParams.get("locale"));
  const headers = getPublicApiHeaders(locale);

  const item = await getCaseDetailData(slug, locale);

  if (!item) {
    return Response.json(
      { error: locale === "en" ? "Case not found." : "没有找到这个案例。" },
      { status: 404, headers }
    );
  }

  return Response.json(toPublicDetailItem(item, locale), {
    status: 200,
    headers,
  });
}
