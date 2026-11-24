/**
 * On phones the floating panels (neighborhood card, team card, brand menu, map picker) all
 * open in the same place and pile up. So there, opening one closes the others. On wider
 * screens the team card and the map picker share the left edge, so those two close each
 * other; the brand menu, centered, joins in while the window is too narrow for it to sit
 * between the side panels. The rest stay independent.
 */
import { useEffect, useRef } from "react";

export type PanelName = "zone" | "team" | "menu" | "layers";

/** Same breakpoint as the phone layout in styles.css. */
const SMALL = "(max-width: 720px)";
/** Below this the 400px menu touches the side panels (360px + 16px margin each). */
const MEDIUM = "(max-width: 1180px)";
const EVENT = "panel-open";
const LEFT_EDGE: PanelName[] = ["team", "layers"];

function collide(a: PanelName, b: PanelName): boolean {
  if (a === b) return false;
  if (window.matchMedia(SMALL).matches) return true;
  if (LEFT_EDGE.includes(a) && LEFT_EDGE.includes(b)) return true;
  return (a === "menu" || b === "menu") && window.matchMedia(MEDIUM).matches;
}

/** Call in each panel's owner: announces it when it opens, and closes it when another opens. */
export function useExclusivePanel(name: PanelName, isOpen: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (isOpen) window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
  }, [isOpen, name]);
  useEffect(() => {
    if (!isOpen) return;
    const onOpen = (e: Event) => {
      if (collide(name, (e as CustomEvent<PanelName>).detail)) closeRef.current();
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [isOpen, name]);
}
