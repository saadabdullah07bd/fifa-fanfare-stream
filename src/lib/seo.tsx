import { Helmet } from "react-helmet-async";

type JsonLd = Record<string, unknown>;

function withSiteOrigin(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin =
    import.meta.env.VITE_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "https://fifa-fanfare-stream.lovable.app");

  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * SEO component that injects meta tags into the document head using react-helmet-async.
 * Handles canonical URLs, OpenGraph tags, Twitter cards, and JSON-LD schemas.
 * 
 * @param title - The page title.
 * @param description - The meta description.
 * @param path - The URL path for canonical and OG tags.
 * @param image - The preview image URL.
 * @param jsonLd - JSON-LD schema objects for structured data.
 */
export function Seo({
  title,
  description,
  path,
  image,
  jsonLd,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  jsonLd?: JsonLd | JsonLd[];
}) {
  const relPath = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const url = withSiteOrigin(relPath);
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
}
