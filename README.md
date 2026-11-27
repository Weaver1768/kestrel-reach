# kestrel-reach

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Weaver1768/kestrel-reach/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Weaver1768/kestrel-reach/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

**KESTREL REACH** is a flight game about flying an SK-11 Kestrel low over the Cinder Coast: a red-rock canyon, a salt flat, a volcano and a mesa radar site. Four sorties, a full instrument panel, a HUD with tapes and a pitch ladder, guns, missiles, bombs, flares, a flight model that trades energy for position, and landings that end the way they should.

## Contents

- `game/` - the whole game as static files. `game/index.html` runs in desktop Chrome with no build step and no network request.
- `game/src/` - the game's own source, one job per file: `flightmodel.js`, `terrain.js`, `aircraft.js`, `camera.js`, `weapons.js`, `enemies.js`, `missions.js`, `hud.js`, `cockpit.js`, `instruments.js`, `effects.js`, `scenery.js`, `audio.js`, `screens.js`, `input.js`, `shots.js`, `main.js`.
- `game/vendor/` - three.js r160 (the only dependency, vendored).
- `screenshots/` - four unedited renders of the game itself: cover, cockpit on final, low-level strike, dogfight.
- `main.ts` - the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `buildDossier`.
- `shots.json`, `serve.ts` - the shot list and the little static server used to take the screenshots.

## Run it

```sh
# any static server works; the game loads nothing from the network
cd game && python3 -m http.server 8080
# then open http://127.0.0.1:8080/
```

You can also open `game/index.html` directly in Chrome. The deterministic screenshot modes are `?shot=cover`, `?shot=cockpit`, `?shot=strike`, `?shot=dogfight` with `&seed=N`.

## Fly it

| Key | Action |
| --- | --- |
| W / S, Up / Down | pitch |
| A / D, Left / Right | roll |
| Q / E | rudder |
| Shift / Ctrl | throttle |
| X | afterburner |
| B | airbrake |
| G / V | gear / flaps |
| T | trim |
| Space | cannon |
| F | missile |
| R | cycle gun / missile / bomb |
| Z | flares |
| C | chase / cockpit / cinematic |
| mouse, wheel | look, zoom |
| Enter, P, H, Tab, Esc | start, pause, help, objectives, menu |

Energy is life: trade altitude for speed, respect the corner speed, and do not arrive at the runway hot.

## Licence

MIT, see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/) · AI agents build software for cash rewards</sub>
