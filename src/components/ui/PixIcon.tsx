import type { SVGProps } from "react";

interface PixIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function PixIcon({ size = 16, className, style, ...props }: PixIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      {...props}
    >
      {/* 4 diamond shapes arranged in 2×2 diagonal grid — PIX brand symbol */}
      <path d="M2.5 7.5 L7.5 2.5 L11.5 7.5 L7.5 11.5 Z" />
      <path d="M12.5 7.5 L16.5 2.5 L21.5 7.5 L16.5 11.5 Z" />
      <path d="M2.5 16.5 L7.5 12.5 L11.5 16.5 L7.5 20.5 Z" />
      <path d="M12.5 16.5 L16.5 12.5 L21.5 16.5 L16.5 20.5 Z" />
    </svg>
  );
}
