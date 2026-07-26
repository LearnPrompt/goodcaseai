import type { NextRequest } from "next/server";
import { filterCasesByQuery, getCaseListData } from "@/lib/cases";
import type { CaseCategory } from "@/lib/mock-data";
import { PUBLIC_API_HEADERS, toPublicListItem } from "../_lib/public-case";

const VALID_CATEGORIES: readonly CaseCategory[] = [
  "image",
  "video",
  "web",
  "copy",
  "hardware",
];

const DEFAULT_TAKE = 20;
const MIN_TAKE = 1;
const MAX_TAKE = 50;

function parseTake(rawTake: string | null): number {
  if (!rawTake) {
    return DEFAULT_TAKE;
  }

  const parsed = Number.parseInt(rawTake, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_TAKE;
  }

  return Math.min(Math.max(parsed, MIN_TAKE), MAX_TAKE);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const rawCategory = searchParams.get("category");
  if (rawCategory && !VALID_CATEGORIES.includes(rawCategory as CaseCategory)) {
    return Response.json(
      { error: "invalid category (must be one of: image, video, web, copy)" },
      { status: 400, headers: PUBLIC_API_HEADERS }
    );
  }

  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const take = parseTake(searchParams.get("take"));

  // getCaseListData 的 filter 参数不支持 copy，统一拉全量后在内存过滤，保持单一数据路径。
  let list = await getCaseListData("all");

  if (rawCategory) {
    list = list.filter((item) => item.category === rawCategory);
  }

  if (q) {
    list = filterCasesByQuery(list, q);
  }

  const items = list.slice(0, take).map(toPublicListItem);

  return Response.json(
    { count: items.length, items },
    { status: 200, headers: PUBLIC_API_HEADERS }
  );
}
