import { memo, useRef, useEffect } from 'react';

interface NotesPopoverProps {
  notes: string;
  onChange: (notes: string) => void;
  onClose: () => void;
}

const NotesPopover = memo(function NotesPopover({ notes, onChange, onClose }: NotesPopoverProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div
      className="nodrag absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
      data-testid="notes-popover"
    >
      <textarea
        ref={textareaRef}
        className="nowheel h-24 w-full resize-none rounded border border-gray-300 p-1.5 text-xs text-gray-700 outline-none focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Add notes..."
        data-testid="notes-textarea"
      />
      <div className="mt-1 flex justify-end">
        <button
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onClose}
          data-testid="notes-close-btn"
        >
          Close
        </button>
      </div>
    </div>
  );
});

export default NotesPopover;
