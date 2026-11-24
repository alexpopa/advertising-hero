/**
 * The first minute of a first game: who buys your product, then three steps that tick
 * themselves off as you do them (pick a neighborhood, set an ad, launch). It sits on the left,
 * clear of the neighborhood card, and never changes size, so nothing moves as you go.
 */
import { CHANNEL_NAMES, labelName, type World } from "./sim";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props {
  world: World;
  easy: boolean;
  /** Hard: the place types you start out knowing. Click one to color the map by it. */
  clues: string[];
  /** Place types coloring the map right now. */
  shown: string[];
  onShow: (labels: string[]) => void;
  zoneOpen: boolean;
  planned: number;
  onHelp: () => void;
  onClose: () => void;
}

export function Coach({ world, easy, clues, shown, onShow, zoneOpen, planned, onHelp, onClose }: Props) {
  const at = planned > 0 ? 2 : zoneOpen ? 1 : 0;
  const steps = [
    easy ? "Click a dark blue area" : "Click a neighborhood",
    `Set ${CHANNEL_NAMES.digital} to Low`,
    "Add more, or launch",
  ];
  return (
    <section className={`float-card coach coach-${at}`} aria-label="Getting started">
      <header>
        <span className="coach-icon" aria-hidden>
          {world.product.icon}
        </span>
        <b className="coach-who">{world.product.who}</b>
        <span className="coach-btns">
          <button className="icon-btn" onClick={onHelp} aria-label="How to play" title="How to play">
            ?
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </span>
      </header>
      {!easy && clues.length > 0 && (
        <div className="coach-clues">
          {clues.map((l) => {
            const on = shown.includes(l);
            return (
              <button
                key={l}
                className={"clue" + (on ? " on" : "")}
                aria-pressed={on}
                title={`Show ${labelName(l)} on the map`}
                onClick={() => onShow(on ? shown.filter((x) => x !== l) : [...shown, l])}
              >
                {cap(labelName(l))}
              </button>
            );
          })}
        </div>
      )}
      <ol className="coach-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < at ? "done" : i === at ? "now" : ""} aria-current={i === at ? "step" : undefined}>
            <span aria-hidden>{i < at ? "✓" : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}
