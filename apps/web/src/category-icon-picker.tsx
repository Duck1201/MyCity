import { CategorySymbol, categorySymbols, iconChoices, type CategoryIcon } from './components/category-symbol';
import './category-icon-picker.css';
export function CategoryIconPicker({ value, change, disabled }: { disabled?: boolean; value: CategoryIcon; change: (icon: CategoryIcon) => void }) {
    return (
        <fieldset className="catalog-symbols" disabled={disabled}>
            <legend>Ícone da categoria</legend>
            <div>
                {iconChoices.map((choice) => (
                    <label key={choice} title={categorySymbols[choice].label}>
                        <input type="radio" name="category-symbol" aria-label={categorySymbols[choice].label} checked={value === choice} onChange={() => change(choice)} />
                        <CategorySymbol icon={choice} size={20} />
                    </label>
                ))}
            </div>
            <span>{categorySymbols[value].label}</span>
        </fieldset>
    );
}
