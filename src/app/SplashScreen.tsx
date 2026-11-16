import React from 'react';
import {motion} from 'motion/react';
import {BloodDropEmblem} from '../components/BrandMark';

interface SplashScreenProps {
  dbReady?: boolean;
  onSkip: () => void;
}

const SPLASH_EMBERS = [
  {left: '16%', bottom: '18%', size: 6, duration: '4.8s', delay: '0s'},
  {left: '28%', bottom: '12%', size: 4, duration: '5.6s', delay: '0.7s'},
  {left: '44%', bottom: '20%', size: 5, duration: '4.4s', delay: '1.2s'},
  {left: '62%', bottom: '14%', size: 7, duration: '5.8s', delay: '0.4s'},
  {left: '74%', bottom: '22%', size: 4, duration: '4.9s', delay: '1.5s'},
  {left: '84%', bottom: '16%', size: 5, duration: '5.4s', delay: '0.9s'},
];

export const SplashScreen: React.FC<SplashScreenProps> = ({dbReady = true, onSkip}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[#0D0D0D] text-white overflow-hidden px-6 py-10"
      data-testid="splash-screen"
    >
      {/* Background Sukuna-inspired dark crimson artwork */}
      <div className="pointer-events-none absolute inset-0 flex justify-center">
        <motion.div
          initial={{opacity: 0, scale: 1.06}}
          animate={{opacity: 1, scale: 1}}
          transition={{duration: 0.7, ease: [0.16, 1, 0.3, 1]}}
          className="relative w-full max-w-md h-[62%]"
        >
          <div className="sukuna-aura-breath absolute inset-x-10 top-8 h-48 rounded-full bg-[#B00020]/30 blur-3xl" />
          <img
            src="./src/assets/images/sukuna_cursed_hero_1794849858421.jpg"
            alt="Arte temática CarbControl Sukuna Edition"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-top opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-[#0D0D0D]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-transparent to-[#0D0D0D]" />
        </motion.div>
      </div>

      {/* Subtle cursed crimson embers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {SPLASH_EMBERS.map((ember, idx) => (
          <span
            key={idx}
            className="sukuna-ember"
            style={
              {
                left: ember.left,
                bottom: ember.bottom,
                width: `${ember.size}px`,
                height: `${ember.size}px`,
                '--ember-duration': ember.duration,
                '--ember-delay': ember.delay,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Top subtle edition tag */}
      <motion.div
        initial={{opacity: 0, y: -8}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.4, ease: [0.16, 1, 0.3, 1]}}
        className="relative z-10 text-xs tracking-[0.22em] uppercase text-[#FF243D]/90 font-semibold"
      >
        Sukuna Edition
      </motion.div>

      {/* Center Brand + Slogan + Loader */}
      <motion.div
        initial={{opacity: 0, y: 14}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
        className="relative z-10 flex flex-col items-center text-center mt-24 sm:mt-32"
      >
        <div className="mb-3 sukuna-drop-pulse">
          <BloodDropEmblem size={58} />
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          <span className="text-white">Carb</span>
          <span className="text-[#FF243D]">Control</span>
        </h1>
        <p className="mt-3 max-w-xs text-sm sm:text-base text-[#E5E5E5] leading-relaxed">
          Conheça seus alimentos.
          <br />
          Registre seus carboidratos.
        </p>

        {/* Crimson ring loader */}
        <div className="mt-7 flex flex-col items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-full border-2 border-[#650000] border-t-[#FF243D] animate-spin shadow-[0_0_16px_rgba(255,36,61,0.35)]"
            aria-hidden="true"
          />
          <span className="text-xs text-[#B5B5B5]">
            {dbReady ? 'Carregando...' : 'Preparando base local...'}
          </span>
        </div>
      </motion.div>

      {/* Bottom quote + quick skip */}
      <motion.div
        initial={{opacity: 0, y: 8}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.45, delay: 0.16, ease: [0.16, 1, 0.3, 1]}}
        className="relative z-10 flex flex-col items-center gap-3 text-center"
      >
        <blockquote className="text-xs sm:text-sm italic text-[#B5B5B5]">
          “Controle hoje, mais liberdade amanhã.”
          <span className="block not-italic text-[#FF243D] mt-1 font-medium">— CarbControl</span>
        </blockquote>
        <button
          type="button"
          onClick={onSkip}
          disabled={!dbReady}
          className="text-xs text-[#B5B5B5] hover:text-white underline underline-offset-4 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Entrar agora
        </button>
      </motion.div>
    </div>
  );
};
