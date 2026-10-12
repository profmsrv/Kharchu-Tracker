// The part of the screen that is REALLY visible. On phones the on-screen keyboard covers the bottom of the page
// without changing the page height, so buttons at the bottom end up hidden behind the keyboard.
// The "visual viewport" shrinks when the keyboard opens, so popups use its height and always stay above the keyboard.
import { useEffect, useState } from 'react';

function measure() {
  const viewport = window.visualViewport;
  if (!viewport) return { height: window.innerHeight, top: 0 };
  return { height: viewport.height, top: viewport.offsetTop };
}

export function useVisualViewport() {
  const [size, setSize] = useState(measure);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setSize(measure());
    update();
    window.addEventListener('resize', update);
    if (viewport) {
      viewport.addEventListener('resize', update);
      viewport.addEventListener('scroll', update);
    }
    return () => {
      window.removeEventListener('resize', update);
      if (viewport) {
        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
      }
    };
  }, []);

  return size;
}
