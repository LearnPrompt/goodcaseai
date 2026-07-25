import Image from "next/image";

export function CaseMedia({
  mediaType,
  mediaUrl,
  posterUrl,
  title,
}: {
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl?: string;
  title: string;
}) {
  return (
    <article className="overflow-hidden border border-[var(--hair)] bg-[var(--ink)] xl:sticky xl:top-24">
      <div className="relative aspect-[4/3] min-h-[240px] overflow-hidden bg-[#e9e1d5] sm:min-h-[320px] lg:aspect-[16/10] xl:aspect-[4/5] xl:min-h-[520px]">
        {mediaType === "image" ? (
          <Image
            src={mediaUrl}
            alt={title}
            fill
            sizes="(min-width: 1280px) 38vw, 100vw"
            className="object-cover"
          />
        ) : (
          <video
            muted
            playsInline
            preload="metadata"
            poster={posterUrl}
            controls
            className="h-full w-full object-cover"
          >
            <source src={mediaUrl} type="video/mp4" />
          </video>
        )}
      </div>
    </article>
  );
}
