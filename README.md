# Galactic Star Catalogue ✨

A futuristic, interactive 3D star catalogue built as a hackathon-ready prototype. This web application visualizes over 100,000 stars from the Hipparcos catalogue using React, TypeScript, and Three.js.



## Features

- **🚀 3D Galaxy Explorer**: A performant `react-three-fiber` scene rendering a point cloud of stars with realistic colors, sizes, and a beautiful bloom effect.
- **🎬 Cinematic Fly-To & Story Mode**: Click on any star to smoothly animate the camera to it, or take a guided tour of iconic stars like Sirius and Betelgeuse.
- **🌌 Interactive HR Diagram**: A D3-powered Hertzsprung-Russell diagram to explore the relationship between stellar temperature and luminosity.
- **🛰️ Futuristic UI**: A dark, neon-themed interface built with Tailwind CSS and `framer-motion` for fluid, engaging animations.
- **⚡ Optimized Data Pipeline**: Includes Python scripts to fetch data professionally via `astroquery` and tile it for efficient loading.

## Tech Stack

- **Frontend**: React (Vite + TypeScript), Tailwind CSS
- **3D Rendering**: `three.js`, `react-three-fiber`, `drei`, `postprocessing`
- **Animation**: `framer-motion`, `react-spring`
- **Charts**: `d3.js`

## Quick Start

1.  **Clone & Install**:
    ```bash
    git clone [https://github.com/YOUR_USERNAME/galactic-star-catalogue.git](https://github.com/YOUR_USERNAME/galactic-star-catalogue.git)
    cd galactic-star-catalogue
    npm install
    ```

2.  **Run Development Server**:
    The project includes a sample data file for immediate use.
    ```bash
    npm run dev
    ```

3.  **(Optional) Fetch Full Dataset**:
    To use the full Hipparcos dataset, run the included Python script.
    ```bash
    # Requires Python & astroquery
    pip install astroquery pandas tqdm numpy
    python scripts/fetch_hipparcos_vizier.py
    node scripts/tile_data.mjs
    ```

## Deployment

This project is configured for easy deployment to static hosts like GitHub Pages or Vercel.

```bash
# Build the static site
npm run build