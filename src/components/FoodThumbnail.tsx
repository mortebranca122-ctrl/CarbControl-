import React, {useState} from 'react';
import {
  Apple,
  Beef,
  Coffee,
  Cookie,
  Croissant,
  Flame,
  Leaf,
  Milk,
  Nut,
  Package,
  Sprout,
  Wheat,
} from 'lucide-react';
import type {FoodCategory} from '../types';

const CATEGORY_ICON_MAP: Record<FoodCategory, React.ComponentType<{className?: string}>> = {
  'Cereais e tubérculos': Wheat,
  Frutas: Apple,
  'Legumes e verduras': Leaf,
  Leguminosas: Sprout,
  'Carnes e proteínas': Beef,
  Laticínios: Milk,
  'Pães e massas': Croissant,
  Bebidas: Coffee,
  'Doces e biscoitos': Cookie,
  'Temperos, molhos e óleos': Flame,
  'Sementes, castanhas e farinhas': Nut,
  Outros: Package,
};

interface FoodThumbnailProps {
  name: string;
  category: FoodCategory;
  imageUrl?: string;
  sizeClass?: string;
}

export const FoodThumbnail: React.FC<FoodThumbnailProps> = ({
  name,
  category,
  imageUrl,
  sizeClass = 'w-14 h-14',
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const Icon = CATEGORY_ICON_MAP[category] ?? Package;

  if (imageUrl && !imgFailed) {
    return (
      <div
        className={`${sizeClass} shrink-0 overflow-hidden rounded-xl border border-[#650000]/60 bg-[#1A1013]`}
      >
        <img
          src={imageUrl}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} shrink-0 flex items-center justify-center rounded-xl border border-[#B00020]/40 bg-gradient-to-br from-[#231015] to-[#120B0D] text-[#FF243D]`}
      aria-hidden="true"
    >
      <Icon className="w-6 h-6" />
    </div>
  );
};
