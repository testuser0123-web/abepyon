# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Vite + React + TypeScript app. Application code lives in `src/`, with `main.tsx` bootstrapping React and `App.tsx` holding the main screen flow. Styles are colocated in `src/App.css` and `src/index.css`. Use `public/` for static files served by path at runtime, such as `public/abe_01.png` or `public/ad.png`. Keep generated output in `dist/`; do not edit it manually.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server with hot reload.
- `npm run build`: run `tsc -b` and produce a production bundle in `dist/`.
- `npm run preview`: serve the built app locally for a production-style check.
- `npm run lint`: run ESLint across the project.

Run commands from the repository root.

## Coding Style & Naming Conventions
Use TypeScript and React function components. Follow the existing style: 2-space indentation, semicolons, and single quotes in `src/`. Name React components in PascalCase (`App.tsx`), hooks and utilities in camelCase, and keep asset filenames lowercase with underscores (`abe_02.png`). Prefer small stateful UI components over large monolithic files as the app grows.

ESLint is configured in `eslint.config.js` with TypeScript, React Hooks, and React Refresh rules. Lint before opening a PR.

## Testing Guidelines
There is currently no test runner configured. For now, treat `npm run lint` and `npm run build` as the minimum verification gate. When adding tests, place them under `src/` beside the component they cover and use `*.test.ts` or `*.test.tsx` naming.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so no repository-specific commit pattern can be inferred. Use short, imperative commit messages such as `Add skin selector toggle` or `Refine splash screen timing`.

PRs should include a brief summary, the user-visible impact, verification steps, and screenshots or short recordings for UI changes. Link related issues when applicable.
