import { memo } from 'react';

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1',
];

interface ColorPickerProps {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}

const ColorPicker = memo(function ColorPicker({ currentColor, onSelect, onClose }: ColorPickerProps) {
  return (
    <div
      className="nodrag absolute left-0 top-full z-20 mt-1 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
      data-testid="color-picker"
    >
      {PALETTE.map((color) => (
        <button
          key={color}
          className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: color,
            borderColor: color === currentColor ? 'white' : 'transparent',
          }}
          onClick={() => { onSelect(color); onClose(); }}
          data-testid={`color-option-${color}`}
        />
      ))}
    </div>
  );
});

export default ColorPicker;
