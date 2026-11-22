import { useState } from "react";
import { C, type CategoriesData, type Difficulty } from "./sim";
import type { SavedGame } from "./storage";
import { usd } from "./scale";

export const PRODUCT_UI: Record<string, { icon: string; who: string }> = {
  cold_brew: { icon: "☕", who: "Office workers and students who need a pick-me-up" },
  supplements: { icon: "💪", who: "Gym-goers and weekend athletes" },
  pet_food: { icon: "🐕", who: "Dog and cat owners who spoil their pets" },
  kids_gear: { icon: "🧸", who: "Parents of babies and young kids" },
  late_night: { icon: "🌙", who: "Night owls heading home from bars and shows" },
  skincare: { icon: "🧴", who: "Beauty and wellness regulars" },
};

const NAME_A = ["Fog", "Golden", "Cable", "Mission", "Bay", "Hilltop", "Sunset", "Pier", "Twin", "Ocean"];
const NAME_B = ["& Co.", "Supply", "Labs", "Collective", "Club", "Goods", "Brothers", "Works", "House", "Republic"];
function randomBrand(): string {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(NAME_A)} ${pick(NAME_B)}`;
}

interface Props {
  categories: CategoriesData;
  saved: SavedGame | null;
  onStart: (brand: string, productKey: string, difficulty: Difficulty) => void;
  onContinue: () => void;
}

export function StartScreen({ categories, saved, onStart, onContinue }: Props) {
  const [brand, setBrand] = useState(randomBrand);
  const [product, setProduct] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const resumable = saved && saved.state.status === "playing";

  return (
    <div className="start">
      <div className="start-inner">
        <h1 className="start-title">Ad Empire SF</h1>
        <p className="start-pitch">
          Launch a brand and grow it by buying ads across San Francisco's real neighborhoods. Every
          neighborhood's value comes from an open map of what's actually there. You have {usd(C.startCash)} and{" "}
          {C.days} days.
        </p>

        {resumable && (
          <button className="btn btn-secondary continue" onClick={onContinue}>
            Continue <b>{saved.brand}</b> · day {saved.state.day} of {C.days} · {usd(saved.state.cash)}
          </button>
        )}

        <label className="field">
          <span>Brand name</span>
          <div className="row">
            <input value={brand} maxLength={32} onChange={(e) => setBrand(e.target.value)} />
            <button className="btn btn-ghost" onClick={() => setBrand(randomBrand())} type="button">
              Random
            </button>
          </div>
        </label>

        <fieldset className="field">
          <legend>What do you sell?</legend>
          <div className="product-grid">
            {Object.entries(categories.products).map(([key, p]) => (
              <button
                key={key}
                type="button"
                className={"product-card" + (product === key ? " selected" : "")}
                aria-pressed={product === key}
                onClick={() => setProduct(key)}
              >
                <span className="product-icon" aria-hidden>
                  {PRODUCT_UI[key]?.icon}
                </span>
                <span className="product-name">{p.name}</span>
                <span className="muted small">{PRODUCT_UI[key]?.who}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Difficulty</legend>
          <div className="segmented" role="radiogroup">
            {(["hard", "easy"] as Difficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                className={difficulty === d ? "on" : ""}
                onClick={() => setDifficulty(d)}
              >
                <b>{d === "hard" ? "Hard" : "Easy"}</b>
                <span className="small">
                  {d === "hard" ? "Read the map and decide for yourself" : "Get suggestions on where to place ads"}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <button
          className="btn btn-primary start-btn"
          disabled={!product || !brand.trim()}
          onClick={() => product && onStart(brand.trim(), product, difficulty)}
        >
          {product ? "Start" : "Pick a product to start"}
        </button>
        {resumable && <p className="muted small">Starting a new game replaces your saved one.</p>}
      </div>
    </div>
  );
}
