import { useState, useEffect, useCallback } from 'react';

export interface TextSelection {
  text: string;
  range: Range | null;
  rect: DOMRect | null;
}

export function useTextSelection(containerRef?: React.RefObject<HTMLElement>) {
  const [selection, setSelection] = useState<TextSelection>({
    text: '',
    range: null,
    rect: null,
  });

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();

    if (!windowSelection || windowSelection.rangeCount === 0) {
      setSelection({ text: '', range: null, rect: null });
      return;
    }

    const selectedText = windowSelection.toString().trim();

    // If there's no selected text, clear selection
    if (!selectedText) {
      setSelection({ text: '', range: null, rect: null });
      return;
    }

    // If containerRef is provided, check if selection is within container
    if (containerRef?.current) {
      const range = windowSelection.getRangeAt(0);
      const isWithinContainer = containerRef.current.contains(range.commonAncestorContainer);

      if (!isWithinContainer) {
        setSelection({ text: '', range: null, rect: null });
        return;
      }
    }

    const range = windowSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelection({
      text: selectedText,
      range,
      rect,
    });
  }, [containerRef]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: '', range: null, rect: null });
  }, []);

  return { selection, clearSelection };
}
