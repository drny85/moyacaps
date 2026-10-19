import { serializeJsonLd } from "@/lib/seo/jsonLd";

/** Server-rendered structured data; Google reads it from the initial HTML. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
