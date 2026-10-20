import { serializeJsonLd } from "@/lib/seo/jsonLd";

/** Server-rendered structured data; Google reads it from the initial HTML. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  if (Array.isArray(data)) {
    return (
      <>
        {data.map((item, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(item) }}
          />
        ))}
      </>
    );
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
