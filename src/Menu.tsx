/**
 * The menu: a small card floating over the map. Home offers Continue (when a run is saved
 * in this browser) and New game. New game asks one thing per step: product, brand name,
 * difficulty.
 */
import { useMemo, useState } from "react";
import { C, type CategoriesData, type Difficulty, type Tier } from "./sim";
import { bestDays, type SavedGame, type Win } from "./storage";
import { usd } from "./scale";

export const TIER_NAMES: Record<Tier, string> = { starter: "Starter", tricky: "Tricky", expert: "Expert" };
const TIER_HELP: Record<Tier, string> = {
  starter: "Your buyers are where you'd expect",
  tricky: "A few places aren't what they seem",
  expert: "Several surprises, and few obvious clues",
};

export const DIFFICULTIES: { key: Difficulty; name: string; text: string }[] = [
  {
    key: "hard",
    name: "Hard",
    text: "You know who your buyers are and one or two places that matter. Each neighborhood you advertise in for two weeks teaches you one more.",
  },
  {
    key: "easy",
    name: "Easy",
    text: "Every clue is shown: which places draw your buyers, carry you or compete with you. The map shows where you fit, and you get suggestions.",
  },
];

const NAME_A = ["Fog", "Golden", "Cable", "Mission", "Bay", "Hilltop", "Sunset", "Pier", "Twin", "Ocean"];
const NAME_B = ["& Co.", "Supply", "Labs", "Collective", "Club", "Goods", "Brothers", "Works", "House", "Republic"];
function randomBrand(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(NAME_A)} ${pick(NAME_B)}`;
}

type Step = "home" | "pitch" | "loan";
const STEPS: Step[] = ["pitch", "loan"];

interface Props {
  categories: CategoriesData;
  saved: SavedGame | null;
  /** Paid-off runs in this browser: the best day shows on each product. */
  wins: Win[];
  /** Skip the home step (after "Play again"). */
  startNew?: boolean;
  onStart: (brand: string, productKey: string, difficulty: Difficulty) => void;
  onContinue: () => void;
}

export function Menu({ categories, saved, wins, startNew, onStart, onContinue }: Props) {
  const best = useMemo(() => bestDays(wins), [wins]);
  const [step, setStep] = useState<Step>(startNew ? "pitch" : "home");
  const [brand, setBrand] = useState(randomBrand);
  const [product, setProduct] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const resumable = saved && saved.state.status === "playing";
  const finished = saved && saved.state.status !== "playing";
  const n = STEPS.indexOf(step);
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [key, p] of Object.entries(categories.products)) m.set(p.group, [...(m.get(p.group) ?? []), key]);
    return [...m];
  }, [categories]);
  const savedProduct = saved ? categories.products[saved.state.productKey] : undefined;
  const chosen = product ? categories.products[product] : undefined;
  const back = () => setStep(n <= 0 ? "home" : STEPS[n - 1]);
  const ready = !!product && !!brand.trim();

  if (step === "home") {
    return (
      <div className="menu-layer">
        <div className="float-card menu-card home">
          <h1 className="menu-title">Advertising Hero</h1>
          <p className="menu-pitch">One brand, 76 San Francisco neighborhoods, 180 days.</p>
          <div className="menu-actions">
            {resumable && (
              <button className="btn btn-primary btn-big" onClick={onContinue}>
                Continue
                <span className="btn-sub">
                  {savedProduct?.icon} {saved.brand} · day {saved.state.day} · {usd(saved.state.cash)}
                </span>
              </button>
            )}
            <button className={"btn btn-big " + (resumable ? "btn-ghost" : "btn-primary")} onClick={() => setStep("pitch")}>
              New game
              {resumable && <span className="btn-sub">Replaces your saved game</span>}
            </button>
            {finished && (
              <button className="btn btn-ghost" onClick={onContinue}>
                See how {saved.brand} did
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-layer">
      <div className={"float-card menu-card story story-" + step} role="dialog" aria-label="New game">
        <header className="step-head">
          <button className="icon-btn" onClick={back} aria-label="Back">
            ‹
          </button>
          <span className="step-dots" aria-label={`Step ${n + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span key={s} className={i <= n ? "on" : ""} />
            ))}
          </span>
          <span className="icon-btn-spacer" />
        </header>

        {step === "pitch" && (
          <form
            className="story-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) setStep("loan");
            }}
          >
            <div className="story-lede">
              <h2>Today, you quit your job.</h2>
              <p>No more someone else's dream. You're going all in on your own brand. What will you sell?</p>
            </div>
            <div className="product-groups">
              {groups.map(([group, keys]) => (
                <section key={group} aria-label={group}>
                  <h3 className="product-group">{group}</h3>
                  <div className="product-grid">
                    {keys.map((key) => {
                      const p = categories.products[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          className={"product-card" + (product === key ? " selected" : "")}
                          aria-pressed={product === key}
                          onClick={() => setProduct(key)}
                        >
                          <span className="product-top">
                            <span className="product-icon" aria-hidden>
                              {p.icon}
                            </span>
                            <span className="product-badges">
                              {best.has(key) && (
                                <span className="tier best-day" title={`Best: paid off on day ${best.get(key)!.day}`}>
                                  🏆 {best.get(key)!.day}
                                </span>
                              )}
                              <span className={`tier tier-${p.tier}`} title={TIER_HELP[p.tier]}>
                                {TIER_NAMES[p.tier]}
                              </span>
                            </span>
                          </span>
                          <span className="product-name">{p.name}</span>
                          <span className="muted small">{p.who}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <footer className="story-foot">
              <label className="name-line">
                <span className="name-icon" aria-hidden>
                  {chosen?.icon ?? "🏷️"}
                </span>
                <input aria-label="Brand name" value={brand} maxLength={32} onChange={(e) => setBrand(e.target.value)} />
                <button className="icon-btn" onClick={() => setBrand(randomBrand())} type="button" aria-label="Random name" title="Random name">
                  🎲
                </button>
              </label>
              <button className="btn btn-primary" type="submit" disabled={!ready}>
                Next
              </button>
            </footer>
          </form>
        )}

        {step === "loan" && chosen && (
          <>
            <div className="story-lede">
              <h2>
                {chosen.icon} {brand.trim()} is ready to open its doors.
              </h2>
              <p>
                Your life savings are gone, and the bank lent you the rest. There's {usd(C.startCash)} left in the
                account. Then a letter arrives.
              </p>
            </div>
            <blockquote className="bank-letter">
              <span className="bank-mark" aria-hidden>
                🏦
              </span>
              <p>
                Dear {brand.trim()}: you owe us <b>{usd(C.loan)}</b>. Pay it in full by <b>day {C.days}</b>, or we take
                everything you own.
              </p>
            </blockquote>
            <div className="segmented" role="radiogroup" aria-label="Difficulty">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  role="radio"
                  aria-checked={difficulty === d.key}
                  className={difficulty === d.key ? "on" : ""}
                  onClick={() => setDifficulty(d.key)}
                >
                  {d.name}
                </button>
              ))}
            </div>
            <p className="muted small difficulty-text">{DIFFICULTIES.find((d) => d.key === difficulty)!.text}</p>
            <button className="btn btn-primary btn-big" onClick={() => onStart(brand.trim(), product!, difficulty)}>
              🔑 Open the doors
            </button>
          </>
        )}
      </div>
    </div>
  );
}
