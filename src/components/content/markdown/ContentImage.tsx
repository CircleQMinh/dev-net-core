import type { ImgHTMLAttributes } from "react";
import { mergeClassNames } from "./markdownUtils";

export type ContentImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  caption?: string;
};

export function ContentImage({
  alt,
  caption,
  className,
  ...props
}: ContentImageProps) {
  return (
    <figure className="group space-y-4">
      <div className="relative">
        <div className="absolute -inset-1 rounded-xl bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-primary-container)_20%,transparent),color-mix(in_srgb,var(--color-secondary)_20%,transparent))] opacity-25 blur transition-opacity duration-700 group-hover:opacity-50" />
        <div className="relative overflow-hidden rounded-xl border bg-[var(--color-surface-container-low)]">
          <img
            alt={alt}
            className={mergeClassNames(
              "h-auto max-h-[560px] w-full object-cover opacity-90 transition-opacity duration-500 group-hover:opacity-100",
              className
            )}
            decoding="async"
            loading="lazy"
            {...props}
          />
        </div>
      </div>

      {caption ? (
        <figcaption className="gleeple-heading text-center text-[11px] font-semibold uppercase italic tracking-[0.18em] theme-subtle">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
