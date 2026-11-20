import { Accessibility, Bike, BusFront, Construction, Droplets, Footprints, Lightbulb, Road, Shovel, Signpost, Trash2, Trees, Waves, Zap } from 'lucide-react';

export const categorySymbols = {
    road: { label: 'Vias', Icon: Road },
    lighting: { label: 'Iluminação', Icon: Lightbulb },
    waste: { label: 'Resíduos', Icon: Trash2 },
    water: { label: 'Água', Icon: Droplets },
    debris: { label: 'Entulho', Icon: Shovel },
    trees: { label: 'Árvores', Icon: Trees },
    access: { label: 'Acessibilidade', Icon: Accessibility },
    cycling: { label: 'Ciclovia', Icon: Bike },
    transit: { label: 'Transporte', Icon: BusFront },
    works: { label: 'Obras', Icon: Construction },
    walkway: { label: 'Calçada', Icon: Footprints },
    signs: { label: 'Sinalização', Icon: Signpost },
    drainage: { label: 'Drenagem', Icon: Waves },
    energy: { label: 'Energia', Icon: Zap },
};
export type CategoryIcon = keyof typeof categorySymbols;
export const iconChoices = Object.keys(categorySymbols) as CategoryIcon[];

export function CategorySymbol({ icon, size = 18 }: { icon: CategoryIcon; size?: number }) {
    const { Icon } = categorySymbols[icon];
    return <Icon className="category-symbol" data-icon={icon} size={size} strokeWidth={1.7} aria-hidden="true" />;
}
