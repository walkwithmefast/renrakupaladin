# Renraku Paladin

An offline character builder for Shadowrun 5th Edition, built as a faster alternative to Chummer5a. Runs as a
desktop app (Electron) or in a browser.

## How to Use

- Double-click `Renraku Paladin.bat` in the folder above this one to launch it. First run installs
  dependencies automatically (needs [Node.js](https://nodejs.org)).
- Build your character in **Build** mode, then switch to **Play** mode for a clean, table-ready sheet during
  a session.
- Characters save automatically to `app/characters/`, one file per character.
- Already have characters in Chummer5a? Import your `.chum5` saves directly.
- No installer needed if you'd rather run it in a browser instead — open `dist/index.html` — though characters
  are then kept in browser storage instead of on disk.

## Features

- Full character creation: priorities, attributes, skills, qualities, magic/resonance, augments, gear,
  weapons, vehicles, lifestyles, contacts
- Chummer5a `.chum5` import, with a report on what did/didn't carry over
- Play mode for running sessions: damage, Edge, ammo, Karma and nuyen, drones, the Matrix, loot and custom
  items, selling gear
- An inspector panel on every item with stats, rules effects, and a link to the rulebook page
- Reads your own rulebook PDFs for in-app rules excerpts and page links (kept local, never shared)
- Fillable PDF character sheet export
- Six visual themes, each with light and dark variants

## Development

```
npm install
npm start       # runs the desktop app
npm test        # rules-engine tests
```

## License

GPL-3.0 (see `LICENSE`). Game data is converted from [Chummer5a](https://github.com/chummer5a/chummer5a),
also GPL-3.0 — this project wouldn't exist without it.
