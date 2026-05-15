# Scaling Laws Explorer

A lightweight static site for exploring scaling laws, power laws, and allometric scaling.

Core formula:

```text
Y = Y0 * M^β
```

## Main features

- Power law explorer with live controls
- Linear and log-log plots
- Exponent presets for β = 2/3, β = 3/4, β = 1, and β = 1.15
- Biological allometry comparison
- City / network scaling comparison
- Doubling calculator for `scaleFactor^β`

## Preview locally

Open `index.html` directly in a browser.

You can also serve the folder with Python:

```bash
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000/
```

## GitHub Pages

This repo is intended to be served at:

```text
https://chen-qingxiang.github.io/scaling-laws/
```
