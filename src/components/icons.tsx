import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const IconDashboard = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="4.5" rx="2" />
    <rect x="13.5" y="10" width="7.5" height="11" rx="2" />
    <rect x="3" y="13" width="7.5" height="8" rx="2" />
  </svg>
);

export const IconUsers = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20c.6-3.4 3.1-5.3 6.2-5.3s5.6 1.9 6.2 5.3" />
    <path d="M16.5 5.6a3 3 0 0 1 0 5.6M18 14.9c2 .6 3.3 2.2 3.7 4.6" />
  </svg>
);

export const IconChat = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.43L4 21l1.4-4A6.9 6.9 0 0 1 3.5 12.4C3.5 8.4 7.3 5.2 12 5.2s8.5 3.2 8.5 7.2Z" />
    <path d="M8.6 12.4h.01M12 12.4h.01M15.4 12.4h.01" strokeWidth="2.2" />
  </svg>
);

export const IconPhone = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.4 3.5h3l1.5 3.8-2 1.3a11.3 11.3 0 0 0 5.5 5.5l1.3-2 3.8 1.5v3c0 1-.8 1.8-1.8 1.7C10.4 18 6 13.6 4.7 5.3 4.6 4.3 5.4 3.5 6.4 3.5Z" />
  </svg>
);

export const IconRobot = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="8" width="16" height="11" rx="3.2" />
    <path d="M12 4.4V8M8.5 13h.01M15.5 13h.01M9.5 16.2h5" />
    <path d="M2.6 12v3M21.4 12v3" />
  </svg>
);

export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.4" />
    <circle cx="12" cy="12" r="4.6" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" />
  </svg>
);

export const IconSend = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M21 3 10.4 13.6M21 3l-6.8 18-3.8-7.4L3 9.8 21 3Z" />
  </svg>
);

export const IconFlow = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="3.5" width="7" height="5.5" rx="1.8" />
    <rect x="14" y="15" width="7" height="5.5" rx="1.8" />
    <path d="M6.5 9v4.2c0 1.5 1.2 2.8 2.8 2.8h4.7" />
    <path d="M12.2 12.6 14.6 15l-2.4 2.4" />
  </svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const IconBell = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15L18 15.5Z" />
    <path d="M10 21h4" />
  </svg>
);

export const IconChart = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 4.6 4.6L19.5 6.8" />
  </svg>
);

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconClose = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h13.5M13 6.5 18.5 12 13 17.5" />
  </svg>
);

export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconFilter = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 6h17M6.5 12h11M10 18h4" />
  </svg>
);

export const IconMic = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="10" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
  </svg>
);

export const IconPause = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);

export const IconPlay = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4.8 19 12 7 19.2V4.8Z" />
  </svg>
);

export const IconPhoneOff = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.4 3.5h3l1.5 3.8-2 1.3a11.3 11.3 0 0 0 5.5 5.5l1.3-2 3.8 1.5v3c0 1-.8 1.8-1.8 1.7C10.4 18 6 13.6 4.7 5.3 4.6 4.3 5.4 3.5 6.4 3.5Z" />
    <path d="M3 21 21 3" />
  </svg>
);

export const IconMail = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2.6" />
    <path d="m4 7 8 5.6L20 7" />
  </svg>
);

export const IconSparkle = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 3.5v3M20 5h-3" />
  </svg>
);

export const IconBuilding = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4" y="3.5" width="10" height="17" rx="1.8" />
    <path d="M14 9h6v11.5h-6M7 7.5h1.5M7 11h1.5M7 14.5h1.5M17 12.5h1M17 16h1" />
  </svg>
);

export const IconTag = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12.6 12.6 20a1.9 1.9 0 0 1-2.7 0L4 14.1V4h10.1l5.9 5.9a1.9 1.9 0 0 1 0 2.7Z" />
    <path d="M8 8h.01" strokeWidth="2.4" />
  </svg>
);

export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v10M7.5 9.8 12 14.3l4.5-4.5M4.5 19.5h15" />
  </svg>
);

export const IconRefresh = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 0 0-13.7-5.3L4 8" />
    <path d="M4 4v4.4h4.4" />
    <path d="M4 13a8 8 0 0 0 13.7 5.3L20 16" />
    <path d="M20 20v-4.4h-4.4" />
  </svg>
);

export const IconShield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.2 5 6v5.5c0 4.2 2.9 7.9 7 9.3 4.1-1.4 7-5.1 7-9.3V6l-7-2.8Z" />
    <path d="m9.2 12 2 2 3.6-3.8" />
  </svg>
);

export const IconMenu = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconGlobe = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.6 9.5h16.8M3.6 14.5h16.8" />
    <path d="M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5S14.4 18.2 12 20.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z" />
  </svg>
);
