/**
 * Looping Remotion composition for the login/register brand panel:
 * Ứng viên, Headhunter and Doanh nghiệp connect to the HR Connect hub; data pulses travel the links
 * while a caption walks through the three steps of the flow.
 */
import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { motionTheme as t } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

type NodeKey = 'candidate' | 'affiliate' | 'client';

const NODES: { key: NodeKey; label: string; x: number; y: number; color: string; icon: React.ReactNode }[] = [
  {
    key: 'candidate',
    label: 'Ứng viên',
    x: 100,
    y: 92,
    color: t.colors.candidate,
    icon: (
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    ),
  },
  {
    key: 'affiliate',
    label: 'Headhunter',
    x: 460,
    y: 92,
    color: t.colors.affiliate,
    icon: (
      <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5L3 8Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    ),
  },
  {
    key: 'client',
    label: 'Doanh nghiệp',
    x: 280,
    y: 268,
    color: t.colors.client,
    icon: (
      <path d="M4 21V5l8-3v19M12 9h8v12M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2M2 21h20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    ),
  },
];
const HUB = { x: 280, y: 160 };

const STEPS = ['Headhunter giới thiệu ứng viên', 'AI chấm điểm phù hợp', 'Doanh nghiệp tuyển & bảo hành'];

/** Layer 1: drifting mesh background (never flat). */
const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const a = (frame / durationInFrames) * Math.PI * 2;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + Math.sin(a) * 8}% ${25 + Math.cos(a) * 6}%, ${t.colors.bgAlt} 0%, transparent 55%),
          radial-gradient(circle at ${75 + Math.cos(a) * 6}% ${80 + Math.sin(a) * 6}%, rgba(56,189,248,0.25) 0%, transparent 50%), ${t.colors.bg}`,
      }}
    />
  );
};

/** Layers 4–5: grade, grain and vignette on top. */
const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(12,74,110,0) 60%, rgba(8,47,73,0.55) 100%)' }} />
      <AbsoluteFill style={{ opacity: 0.08, mixBlendMode: 'overlay' }}>
        <svg width="100%" height="100%">
          <filter id="auth-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 8} />
          </filter>
          <rect width="100%" height="100%" filter="url(#auth-grain)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ boxShadow: 'inset 0 0 90px rgba(3,20,35,0.6)' }} />
    </>
  );
};

const Link: React.FC<{ from: { x: number; y: number }; color: string; delay: number }> = ({ from, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const length = Math.hypot(HUB.x - from.x, HUB.y - from.y);
  const draw = interpolate(frame, [delay, delay + fps * 0.8], [length, 0], { ...clamp, easing: t.ease.out });
  const exit = interpolate(frame, [durationInFrames - fps * 0.35, durationInFrames], [1, 0], { ...clamp, easing: t.ease.in });
  // Pulse travels node → hub once per second after the link is drawn.
  const cycle = fps * 1.6;
  const local = frame - delay - fps;
  const p = local > 0 ? interpolate(local % cycle, [0, cycle], [0, 1], { ...clamp, easing: t.ease.inOut }) : -1;
  return (
    <g opacity={exit}>
      <line x1={from.x} y1={from.y} x2={HUB.x} y2={HUB.y} stroke={t.colors.line} strokeWidth={2} strokeDasharray={`${length} ${length}`} strokeDashoffset={draw} />
      {p >= 0 && (
        <circle cx={from.x + (HUB.x - from.x) * p} cy={from.y + (HUB.y - from.y) * p} r={4 + Math.sin(p * Math.PI) * 2} fill={color} opacity={Math.sin(p * Math.PI)} />
      )}
    </g>
  );
};

const NodeBadge: React.FC<{ node: (typeof NODES)[number]; delay: number }> = ({ node, delay }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: t.spring.bouncy });
  const exit = interpolate(frame, [durationInFrames - fps * 0.35, durationInFrames], [1, 0], { ...clamp, easing: t.ease.in });
  const breathe = Math.sin((frame / fps) * 2 + delay) * 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: node.x - 60,
        top: node.y - 34 + breathe,
        width: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: enter * exit,
        transform: `translateY(${(1 - enter) * 18}px) scale(${0.7 + enter * 0.3})`,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: node.color,
          color: '#0C4A6E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 8px 24px ${node.color}55`,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24">{node.icon}</svg>
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, color: t.colors.text, whiteSpace: 'nowrap' }}>{node.label}</span>
    </div>
  );
};

const Hub: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame, fps, config: t.spring.smooth });
  const exit = interpolate(frame, [durationInFrames - fps * 0.35, durationInFrames], [1, 0], { ...clamp, easing: t.ease.in });
  const ring = ((frame / fps) % 2) / 2;
  const match = Math.round(interpolate(frame, [fps * 3.3, fps * 5.3], [0, 92], { ...clamp, easing: t.ease.out }));
  return (
    <div style={{ position: 'absolute', left: HUB.x - 46, top: HUB.y - 46, width: 92, height: 92, opacity: enter * exit, transform: `scale(${0.6 + enter * 0.4})` }}>
      <div
        style={{
          position: 'absolute',
          inset: -18 * ring,
          borderRadius: '50%',
          border: `2px solid ${t.colors.primary}`,
          opacity: 1 - ring,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 0 6px rgba(56,189,248,0.25), 0 12px 32px rgba(3,20,35,0.45)`,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 900, color: '#0369A1', lineHeight: 1 }}>H</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#0369A1', marginTop: 4 }}>{match > 0 ? `${match}% fit` : 'HR Connect'}</span>
      </div>
    </div>
  );
};

const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stepLen = fps * 3;
  const start = fps * 0.9;
  const idx = Math.min(STEPS.length - 1, Math.max(0, Math.floor((frame - start) / stepLen)));
  const local = frame - start - idx * stepLen;
  const words = STEPS[idx].split(' ');
  const out = idx < STEPS.length - 1 ? interpolate(local, [stepLen - fps * 0.33, stepLen], [1, 0], { ...clamp, easing: t.ease.in }) : 1;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, display: 'flex', justifyContent: 'center' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 999,
          background: 'rgba(8,47,73,0.7)',
          border: '1px solid rgba(186,230,253,0.25)',
          opacity: frame < start ? 0 : out,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 800, color: t.colors.primary }}>{`0${idx + 1}`}</span>
        <span style={{ display: 'flex', gap: 5 }}>
          {words.map((w, i) => {
            const s = spring({ frame: local - i * 3, fps, config: t.spring.snappy });
            return (
              <span key={`${idx}-${i}`} style={{ fontSize: 14, fontWeight: 600, color: t.colors.text, opacity: s, transform: `translateY(${(1 - s) * 8}px)`, display: 'inline-block' }}>
                {w}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
};

export const AuthNetworkComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ fontFamily: 'inherit', overflow: 'hidden' }}>
      <BgMesh />
      <svg width={t.size.width} height={t.size.height} style={{ position: 'absolute', inset: 0 }}>
        {NODES.map((n, i) => (
          <Link key={n.key} from={n} color={n.color} delay={Math.round(fps * 0.5) + i * 5} />
        ))}
      </svg>
      <Hub />
      {NODES.map((n, i) => (
        <NodeBadge key={n.key} node={n} delay={Math.round(fps * 0.2) + i * 5} />
      ))}
      <Caption />
      <Finish />
    </AbsoluteFill>
  );
};
