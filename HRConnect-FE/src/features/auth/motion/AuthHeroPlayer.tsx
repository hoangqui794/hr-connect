import React, { useEffect, useState } from 'react';
import { Player } from '@remotion/player';
import { AuthNetworkComposition } from './AuthNetworkComposition';
import { motionTheme as t } from './theme';

/** Plays the auth network animation in a loop; with reduced motion it shows one still frame. */
const AuthHeroPlayer: React.FC = () => {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      role="img"
      aria-label="Minh họa: Headhunter giới thiệu ứng viên, AI chấm điểm phù hợp, doanh nghiệp tuyển dụng qua HR Connect"
      className="overflow-hidden rounded-2xl ring-1 ring-white/15"
    >
      <Player
        component={AuthNetworkComposition}
        durationInFrames={t.fps * t.seconds}
        fps={t.fps}
        compositionWidth={t.size.width}
        compositionHeight={t.size.height}
        style={{ width: '100%', aspectRatio: `${t.size.width} / ${t.size.height}` }}
        autoPlay={!reduced}
        loop
        controls={false}
        clickToPlay={false}
        initialFrame={reduced ? t.fps * 6 : 0}
        acknowledgeRemotionLicense
      />
    </div>
  );
};

export default AuthHeroPlayer;
