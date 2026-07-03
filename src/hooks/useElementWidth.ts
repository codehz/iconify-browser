import { useEffect, useState } from "react";

export function useElementWidth<T extends Element>(element: T | null) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!element) {
      setWidth(0);
      return;
    }

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  return width;
}
