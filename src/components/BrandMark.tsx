import React from 'react';

export const BloodDropEmblem: React.FC<{className?: string; size?: number}> = ({
  className = '',
  size = 28,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M20 4C20 4 8 18.2 8 25.8C8 32.5379 13.3726 38 20 38C26.6274 38 32 32.5379 32 25.8C32 18.2 20 4 20 4Z"
      fill="url(#dropGrad)"
      stroke="#FF243D"
      strokeWidth="1.8"
    />
    <path
      d="M20 11.5C20 11.5 13.2 19.6 13.2 24.8C13.2 28.666 16.2445 31.8 20 31.8C23.7555 31.8 26.8 28.666 26.8 24.8C26.8 19.6 20 11.5 20 11.5Z"
      fill="#0D0D0D"
      fillOpacity="0.5"
    />
    <path
      d="M15.6 22C14.6 24.2 14.8 26.8 16.4 28.5"
      stroke="#FF243D"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
    <defs>
      <linearGradient id="dropGrad" x1="20" y1="4" x2="20" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF243D" />
        <stop offset="1" stopColor="#650000" />
      </linearGradient>
    </defs>
  </svg>
);

export const BrandLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}> = ({size = 'md', showTagline = false}) => {
  const iconSize = size === 'lg' ? 40 : size === 'sm' ? 24 : 30;
  const textClass =
    size === 'lg'
      ? 'text-3xl font-extrabold tracking-tight'
      : size === 'sm'
      ? 'text-lg font-bold tracking-tight'
      : 'text-xl font-bold tracking-tight';

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 whitespace-nowrap">
        <BloodDropEmblem size={iconSize} />
        <span className={textClass}>
          <span className="text-zinc-900 dark:text-white">Carb</span>
          <span className="text-[#FF243D]">Control</span>
        </span>
      </div>
      {showTagline && (
        <p className="text-[11px] leading-snug text-zinc-600 dark:text-[#B5B5B5] mt-1">
          Conheça seus alimentos. Registre seus carboidratos.
        </p>
      )}
    </div>
  );
};

export const SukunaCursedFlourish: React.FC<{className?: string}> = ({className = ''}) => (
  <svg
    viewBox="0 0 180 60"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M12 45C36 45 48 16 78 24C98 29 102 10 124 14C144 18 152 38 172 34"
      stroke="#B00020"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeOpacity="0.45"
    />
    <path
      d="M28 52C52 52 70 30 98 36C120 41 134 24 164 26"
      stroke="#FF243D"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeOpacity="0.3"
    />
  </svg>
);
