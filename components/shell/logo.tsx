import { useId } from "react";
import { cn } from "@/lib/utils";

const FRONT =
  "M12.5 7.5H16.5A5 5 0 0 1 21.5 12.5V16.5A5 5 0 0 1 16.5 21.5H12.5A5 5 0 0 1 7.5 16.5V12.5A5 5 0 0 1 12.5 7.5Z";
const CHECK =
  "M10.551 15.216L12.701 17.316A1 1 0 0 0 14.103 17.311L18.453 13.011A1 1 0 0 0 17.047 11.589L13.396 15.198L11.949 13.785A1 1 0 0 0 10.551 15.216Z";

/** Brand lockup: two-square check mark plus the "hindbrain crosscheck" wordmark. */
export function Logo({
  size = 20,
  showProduct = true,
  className,
}: {
  size?: number;
  showProduct?: boolean;
  className?: string;
}) {
  const clipId = `cc-back-${useId().replace(/:/g, "")}`;
  return (
    <span className={cn("inline-flex items-center gap-[10px] text-text-primary", className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        aria-hidden="true"
      >
        <clipPath id={clipId} clipRule="evenodd">
          <path clipRule="evenodd" d={`M0 0H24V24H0Z${FRONT}`} />
        </clipPath>
        <rect
          x="2.5"
          y="2.5"
          width="14"
          height="14"
          rx="5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          clipPath={`url(#${clipId})`}
        />
        <path fillRule="evenodd" d={`${FRONT}${CHECK}`} />
      </svg>
      <span className="inline-flex items-baseline gap-[6px] text-[15px] leading-none">
        <span className="font-semibold tracking-tight">hindbrain</span>
        {showProduct && <span className="font-normal text-text-secondary">crosscheck</span>}
      </span>
    </span>
  );
}
