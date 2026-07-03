import { forwardRef, useImperativeHandle, useRef } from "react";
import SimpleBar from "simplebar-react";
import type SimpleBarCore from "simplebar-core";

interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Whether to auto-hide the scrollbar. Defaults to false. */
  autoHide?: boolean;
}

export interface ScrollAreaHandle {
  getScrollElement: () => HTMLElement | null;
  recalculate: () => void;
}

/**
 * Wraps content with SimpleBar custom scrollbar.
 * Use `ref` to access the scroll element for react-virtual integration.
 */
export const ScrollArea = forwardRef<ScrollAreaHandle, ScrollAreaProps>(
  ({ children, className, style, autoHide = false }, ref) => {
    const simpleBarRef = useRef<SimpleBarCore | null>(null);

    useImperativeHandle(ref, () => ({
      getScrollElement: () => simpleBarRef.current?.getScrollElement() ?? null,
      recalculate: () => simpleBarRef.current?.recalculate(),
    }));

    return (
      <SimpleBar ref={simpleBarRef} className={className} style={style} autoHide={autoHide}>
        {children}
      </SimpleBar>
    );
  },
);

ScrollArea.displayName = "ScrollArea";
