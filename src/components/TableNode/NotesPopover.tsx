import { memo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';

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
    <div data-testid="notes-popover">
      <textarea
        ref={textareaRef}
        className="nowheel h-24 w-full resize-none rounded-md border border-input bg-transparent p-1.5 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Add notes..."
        data-testid="notes-textarea"
      />
      <div className="mt-1 flex justify-end">
        <Button
          variant="ghost"
          size="xs"
          onClick={onClose}
          data-testid="notes-close-btn"
        >
          Close
        </Button>
      </div>
    </div>
  );
});

export default NotesPopover;
