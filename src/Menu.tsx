/**
 * The menu: a small card floating over the map. Home offers Continue (when a run is saved
 * in this browser) and New game. New game asks one thing per step: product, brand name,
 * difficulty.
 */
import { useMemo, useState } from "react";
import { C, type CategoriesData, type Difficulty, type Tier } from "./sim";
import type { SavedGame } from "./storage";
import { usd } from "./scale";

export const TIER_NAMES: Record<Tier, string> = { starter: "Starter", tricky: "Tricky", expert: "Expert" };
const TIER_HELP: Record<Tier, string> = {
  starter: "Your buyers are where you'd expect",
  tricky: "A few places aren't what they seem",
  expert: "Several surprises, and few obvious clues",
};

export const DIFFICULTIES: { key: Difficulty; name: string; text: string }[] = [
  {
    key: "easy",
    name: "Easy",
    text: "Every clue is shown: which places draw your buyers, carry you or compete with you. The map shows where you fit, and you get suggestions.",
  },
  {
    key: "normal",
    name: "Normal",
    text: "You know who your buyers are and one or two places that matter. Each neighborhood you advertise in for two weeks teaches you one more.",
  },
  {
    key: "hard",
    name: "Hard",
    text: "Only a line about your buyers. Work everything else out from the map and your own results.",
  },
];

const NAME_A = ["Fog", "Golden", "Cable", "Mission", "Bay", "Hilltop", "Sunset", "Pier", "Twin", "Ocean"];
const NAME_B = ["& Co.", "Supply", "Labs", "Collective", "Club", "Goods", "Brothers", "Works", "House", "Republic"];
function randomBrand(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(NAME_A)} ${pick(NAME_B)}`;
}

type Step = "home" | "product" | "name" | "difficulty";
const STEPS: Step[] = ["product", "name", "difficulty"];

interface Props {
  categories: CategoriesData;
  saved: SavedGame | null;
  /** Skip the home step (after "Play again"). */
  startNew?: boolean;
  onStart: (brand: string, productKey: string, difficulty: Difficulty) => void;
  onContinue: () => void;
}

export function Menu({ categories, saved, startNew, onStart, onContinue }: Props) {
  const [step, setStep] = useState<Step>(startNew ? "product" : "home");
  const [brand, setBrand] = useState(randomBrand);
  const [product, setProduct] = useState<string | null>(null);
  const resumable = saved && saved.state.status === "playing";
  const finished = saved && saved.state.status !== "playing";
  const n = STEPS.indexOf(step as Exclude<Step, "home">);
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [key, p] of Object.entries(categories.products)) m.set(p.group, [...(m.get(p.group) ?? []), key]);
    return [...m];
  }, [categories]);
  const savedProduct = saved ? categories.products[saved.state.productKey] : undefined;
  const back = () => setStep(n <= 0 ? "home" : STEPS[n - 1]);

  if (step === "home") {
    return (
      <div className="menu-layer">
        <div className="float-card menu-card home">
          <h1 className="menu-title">Ad Empire SF</h1>
          <p className="menu-pitch">
            Grow a brand by buying ads across San Francisco's real neighborhoods. You have {usd(C.startCash)} and {C.days}{" "}
            days.
          </p>
          <div className="menu-actions">
            {resumable && (
              <button className="btn btn-primary btn-big" onClick={onContinue}>
                Continue
                <span className="btn-sub">
                  {savedProduct?.icon} {saved.brand} · day {saved.state.day} · {usd(saved.state.cash)}
                </span>
              </button>
            )}
            <button className={"btn btn-big " + (resumable ? "btn-ghost" : "btn-primary")} onClick={() => setStep("product")}>
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
      <div className="float-card menu-card" role="dialog" aria-label="New game">
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

        {step === "product" && (
          <>
            <h2>What do you sell?</h2>
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
                          onClick={() => {
                            setProduct(key);
                            setStep("name");
                          }}
                        >
                          <span className="product-top">
                            <span className="product-icon" aria-hidden>
                              {p.icon}
                            </span>
                            <span className={`tier tier-${p.tier}`} title={TIER_HELP[p.tier]}>
                              {TIER_NAMES[p.tier]}
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
          </>
        )}

        {step === "name" && (
          <form
            className="step-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (brand.trim()) setStep("difficulty");
            }}
          >
            <h2>Name your brand</h2>
            <div className="row">
              <input
                autoFocus
                aria-label="Brand name"
                value={brand}
                maxLength={32}
                onChange={(e) => setBrand(e.target.value)}
              />
              <button className="btn btn-ghost" onClick={() => setBrand(randomBrand())} type="button">
                🎲 Random
              </button>
            </div>
            <button className="btn btn-primary btn-big" type="submit" disabled={!brand.trim()}>
              Next
            </button>
          </form>
        )}

        {step === "difficulty" && (
          <>
            <h2>How do you want to play?</h2>
            <div className="choice-list">
              {DIFFICULTIES.map((d) => (
                <button key={d.key} className="choice" onClick={() => product && onStart(brand.trim(), product, d.key)}>
                  <b>
                    {d.name}
                    {d.key === "normal" && <span className="tag">Recommended</span>}
                  </b>
                  <span className="muted small">{d.text}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
