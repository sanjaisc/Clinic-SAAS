"use client";

import Image from "next/image";

/**
 * Standardised DoctA logo rendered from the uploaded PNG.
 *
 * The source image is 250×79 px (≈ 3.16 : 1 aspect ratio) with a
 * transparent background.  Pass `height` to control the rendered size;
 * the width is derived automatically to keep the ratio intact.
 *
 * @example
 *   <DoctALogo height={28} />   // navbar / small
 *   <DoctALogo height={40} />   // login page hero
 *   <DoctALogo height={20} />   // footer bottom bar
 */
export function DoctALogo({
  height = 28,
  className,
  priority = false,
}: {
  /** Rendered height in pixels. Default 28 (≈ h-7). */
  height?: number;
  className?: string;
  /** Set true when the logo is above the fold. */
  priority?: boolean;
}) {
  // Maintain the original 250:79 aspect ratio.
  const width = Math.round(height * (250 / 79));

  return (
    <Image
      src="/logo.png"
      alt="DoctA"
      width={width}
      height={height}
      priority={priority}
      className={`object-contain ${className ?? ""}`}
    />
  );
}