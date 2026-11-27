import { useEffect, useRef, type RefObject } from 'react';

/**
 * Manages modal Escape-key dismissal, initial focus on open, and focus
 * restoration to the previously active element when the modal closes.
 */
export function useModalFocus(
  open: boolean,
  onClose: () => void,
  initialFocusRef: RefObject<HTMLElement | null>
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    initialFocusRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open, initialFocusRef]);
}
