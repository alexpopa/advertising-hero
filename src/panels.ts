/**
 * On phones the floating panels (neighborhood card, team card, brand menu, map picker) all
 * open in the same place and pile up. So there, opening one closes the others. On wider
 * screens they sit in different corners and stay independent.
 */
import { useEffect, useRef } from "react";

export type PanelName = "zone" | "team" | "menu" | "layers";

/** Same breakpoint as the phone layout in styles.css. */
const SMALL = "(max-width: 720px)";
const EVENT = "panel-open";

/** Call in each panel's owner: announces it when it opens, and closes it when another opens. */
export function useExclusivePanel(name: PanelName, isOpen: boolean, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (isOpen && window.matchMedia(SMALL).matches) window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
  }, [isOpen, name]);
  useEffect(() => {
    if (!isOpen) return;
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<PanelName>).detail !== name) closeRef.current();
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [isOpen, name]);
}
