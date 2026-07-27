import { headers } from "next/headers";
import {
  LOCALE_REQUEST_HEADER,
  normalizeLocale,
  type Locale,
} from "@/i18n/config";
import { getMessages } from "@/i18n/messages";

export async function getLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  return normalizeLocale(requestHeaders.get(LOCALE_REQUEST_HEADER));
}

export async function getServerMessages() {
  return getMessages(await getLocale());
}
