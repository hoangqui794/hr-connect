// Theme for the auth-panel Remotion animation. Colors follow the auth design system (ui-ux-pro-max, 20/10).
import { Easing } from 'remotion';

export const motionTheme = {
  colors: {
    bg: '#0C4A6E',
    bgAlt: '#075985',
    primary: '#38BDF8', // hero: the HR Connect hub only
    candidate: '#A78BFA',
    affiliate: '#FBBF24',
    client: '#34D399',
    text: '#F0F9FF',
    textDim: '#BAE6FD',
    line: 'rgba(186, 230, 253, 0.35)',
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
  size: { width: 560, height: 400 },
  fps: 30,
  seconds: 10,
} as const;
