import { Seo } from "@/lib/seo";

// Official FIFA YouTube playlist for World Cup 2026 highlights.
// oEmbed-friendly embeds — no API key required.
const FIFA_CHANNEL_UPLOADS = "https://www.youtube.com/embed/videoseries?list=UUpcTrCXblq78GZrTUTLWeBw";

const KNOWN_CLIPS = [
  { id: "9nOjxRxCbYE", title: "FIFA World Cup 26™ — Official Trailer" },
  { id: "8i2P4c8Zc6M", title: "Every host city — FIFA World Cup 26™" },
  { id: "IAQeGz1p8pQ", title: "The Official Match Ball Reveal" },
];

export default function Highlights() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Seo title="Highlights — Pitch26" description="Official FIFA World Cup 2026 highlight videos and match recaps." />
      <h1 className="display text-5xl">Highlights</h1>
      <p className="mt-2 text-muted-foreground">Official videos from the FIFA channel. New match highlights added as they're published.</p>

      <section className="mt-10">
        <h2 className="display text-2xl text-primary">Latest from FIFA</h2>
        <div className="mt-4 aspect-video overflow-hidden rounded-lg border border-border bg-black">
          <iframe
            src={FIFA_CHANNEL_UPLOADS}
            title="Latest FIFA uploads"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="display text-2xl text-primary">Featured clips</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {KNOWN_CLIPS.map((c) => (
            <article key={c.id} className="overflow-hidden rounded-lg border border-border bg-card/40">
              <div className="aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${c.id}`}
                  title={c.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              <p className="p-4 font-semibold">{c.title}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
