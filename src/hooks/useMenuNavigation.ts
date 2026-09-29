// src/hooks/useMenuNavigation.ts
import { useEffect, useState, useCallback, useRef } from 'react';

export interface UseMenuNavigationOptions {
  isOpen: boolean;
  itemCount: number;
  onSelect: (index: number) => void;
  onClose?: () => void;
}

export function useMenuNavigation({
  isOpen,
  itemCount,
  onSelect,
  onClose,
}: UseMenuNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const itemCountRef = useRef(itemCount);
  itemCountRef.current = itemCount;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  // Reset focus to top whenever modal opens, and blur any active HTML element
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [isOpen]);

  // Global key navigation while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape -> close or resume
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (onCloseRef.current) {
          onCloseRef.current();
        } else {
          onSelectRef.current(0);
        }
        return;
      }

      // Up / W -> previous option
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        e.stopPropagation();
        const total = itemCountRef.current;
        if (total > 0) {
          setSelectedIndex((prev) => (prev - 1 + total) % total);
        }
        return;
      }

      // Down / S -> next option
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        e.stopPropagation();
        const total = itemCountRef.current;
        if (total > 0) {
          setSelectedIndex((prev) => (prev + 1) % total);
        }
        return;
      }

      // Enter / Space -> trigger current selection
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onSelectRef.current(selectedIndexRef.current);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen]);

  const getItemProps = useCallback(
    (index: number) => ({
      onMouseEnter: () => setSelectedIndex(index),
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement)?.blur();
        setSelectedIndex(index);
        onSelectRef.current(index);
      },
      tabIndex: -1,
      'aria-selected': selectedIndex === index,
    }),
    [selectedIndex]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    getItemProps,
  };
}
