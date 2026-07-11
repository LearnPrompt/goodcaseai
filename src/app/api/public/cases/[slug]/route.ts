import { getCaseDetailData } from "@/lib/cases";
import { PUBLIC_API_HEADERS, toPublicDetailItem } from "../../_lib/public-case";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const item = await getCaseDetailData(slug);

  if (!item) {
    return Response.json(
      { error: "case not found" },
      { status: 404, headers: PUBLIC_API_HEADERS }
    );
  }

  return Response.json(toPublicDetailItem(item), {
    status: 200,
    headers: PUBLIC_API_HEADERS,
  });
}
