import type { ReactNode } from "react";

const Svg = ({ children, fill = "none" }: { children: ReactNode; fill?: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill={fill} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const p = (d: string) => () => (
  <Svg>
    <path d={d} />
  </Svg>
);

export const Icons = {
  menu: p("M4 6h16M4 12h16M4 18h16"),
  lock: p("M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z"),
  unlock: p("M7 11V7a5 5 0 0 1 9.9-1M5 11h14v10H5z"),
  hand: p("M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"),
  selection: p("M6 3l12 7-5 1.5L10.5 17z M13 11.5l5 5"),
  rectangle: p("M4 5h16v14H4z"),
  diamond: p("M12 3l9 9-9 9-9-9z"),
  ellipse: () => (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
    </Svg>
  ),
  arrow: p("M4 12h15M14 7l5 5-5 5"),
  line: p("M5 12h14"),
  freedraw: p("M17 3l4 4L8 20H4v-4zM14 6l4 4"),
  text: p("M5 20L12 4l7 16M8 14h8"),
  image: p("M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 8.5h.01"),
  eraser: p("M7 21h10M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8z"),
  undo: p("M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"),
  redo: p("M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"),
  plus: p("M12 5v14M5 12h14"),
  minus: p("M5 12h14"),
  help: p("M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"),
  trash: p("M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"),
  duplicate: p("M8 8h12v12H8zM4 16V4h12"),
  folder: p("M3 6h6l2 2h10v11H3z"),
  save: p("M12 4v11M7 10l5 5 5-5M5 20h14"),
  exportImage: p("M4 4h11M4 4v16h16v-9M4 16l5-5 4 4M17 3v6M14 6l3-3 3 3"),
  sun: p("M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"),
  moon: p("M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"),
  sliders: p("M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4"),
  sendToBack: p("M12 4v12M7 11l5 5 5-5M5 20h14"),
  sendBackward: p("M12 4v14M7 13l5 5 5-5"),
  bringForward: p("M12 20V6M7 11l5-5 5 5"),
  bringToFront: p("M12 20V8M7 13l5-5 5 5M5 4h14"),
  hachure: p("M5 5h14v14H5zM5 13l8-8M5 19L19 5M11 19l8-8"),
  crossHatch: p("M5 5h14v14H5zM5 12l7-7M5 19L19 5M12 19l7-7M5 12l7 7M5 5l14 14M12 5l7 7"),
  solid: () => (
    <Svg fill="currentColor">
      <path d="M5 5h14v14H5z" />
    </Svg>
  ),
  strokeThin: () => (
    <Svg>
      <path d="M4 12h16" strokeWidth="1" />
    </Svg>
  ),
  strokeBold: () => (
    <Svg>
      <path d="M4 12h16" strokeWidth="2.5" />
    </Svg>
  ),
  strokeExtra: () => (
    <Svg>
      <path d="M4 12h16" strokeWidth="4" />
    </Svg>
  ),
  solidLine: p("M4 12h16"),
  dashedLine: p("M4 12h4M10 12h4M16 12h4"),
  dottedLine: p("M4 12h.5M8 12h.5M12 12h.5M16 12h.5M20 12h.5"),
  architect: p("M3 15c3-4 6-6 9-4s5 1 9-3"),
  artist: p("M3 15c2-4 4-5 6-3s3 3 5 0 3-5 7-4"),
  cartoonist: p("M3 16c2-5 3-6 5-3 2 3 3-6 5-3 2 2 2-4 4-3 2 0 2 2 4 1"),
  sharp: p("M5 19V5h14"),
  round: p("M5 19v-8a6 6 0 0 1 6-6h8"),
};

export type IconName = keyof typeof Icons;
