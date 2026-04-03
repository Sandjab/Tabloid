import { useState, useCallback } from 'react';

export function useInlineEdit(onSubmit: (value: string) => void) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed) onSubmit(trimmed);
      setIsEditing(false);
    },
    [onSubmit],
  );

  const startEditing = useCallback(() => setIsEditing(true), []);
  const cancelEditing = useCallback(() => setIsEditing(false), []);

  return { isEditing, handleSubmit, startEditing, cancelEditing };
}
