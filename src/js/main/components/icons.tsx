import React from "react";

type IconProps = { size?: number };

const Svg: React.FC<React.PropsWithChildren<IconProps>> = ({ size = 14, children }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

export const SettingsIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M2 4h6M11 4h1M2 10h1M6 10h6" />
    <circle cx="9.5" cy="4" r="1.5" />
    <circle cx="4.5" cy="10" r="1.5" />
  </Svg>
);

export const ZoomInIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="6" cy="6" r="4" />
    <path d="M9 9l3 3M4.2 6h3.6M6 4.2v3.6" />
  </Svg>
);

export const ZoomOutIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="6" cy="6" r="4" />
    <path d="M9 9l3 3M4.2 6h3.6" />
  </Svg>
);

export const FitIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <path d="M2 5V2h3M9 2h3v3M12 9v3H9M5 12H2V9" />
  </Svg>
);

export const TargetIcon: React.FC<IconProps> = (props) => (
  <Svg {...props}>
    <circle cx="7" cy="7" r="3.5" />
    <path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13" />
  </Svg>
);

export const ChevronIcon: React.FC<IconProps> = ({ size = 8 }) => (
  <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 8 8">
    <path d="M2.5 1.5L5.5 4L2.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
