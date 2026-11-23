# Advertising Hero — instructions for Claude

Advertising Hero (called Ad Empire SF until 2026-11-23) is Alexandru's browser tycoon game: grow a brand by buying ads across San Francisco's real neighborhoods, valued with Overture Maps data. Work started in a Claude session on a different computer; everything decided is in these files:

- `STATUS.md` — decisions so far, progress, open questions, how to run things. **Read first.**
- `DESIGN.md` — the full v1 game design, scoring model, data pipeline, architecture and build order, plus what changed after the first real numbers (section 6.11).
- `research-notes.md` — background research on Overture Maps data and existing projects.
- `README.md` — the public description of the game.

## Working rules
- Keep STATUS.md's "Where the work is" section current as steps finish.
- Record real trade-offs and cuts as you make them; they go in the README.
- Overture has no revenue, rent or foot-traffic data. Game numbers are synthetic; the inputs must stay real and explainable.
- Never commit `data/raw/`, `private/`, `CLAUDE.local.md` or secrets.
- Explain things to Alexandru in plain English, and say plainly when something isn't tested.
