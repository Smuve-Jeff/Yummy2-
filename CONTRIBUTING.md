# Contributing

## Branching Strategy

This project follows a simplified branching strategy:
- `main`: The primary branch for stable code.
- `fix/*`: For bug fixes (e.g., `fix/base-href-for-gh-pages`).
- `feature/*`: For new features.

## Environment Variables

This project uses `vite` for development. Environment variables are managed via `.env` files.
To set up your environment:
1. Copy `.env.example` to `.env.local`.
2. Add your `API_KEY` (Gemini API Key) to `.env.local`.

**Note:** Never commit `.env` or `.env.local` to the repository.

## Security

- Do not hardcode API keys in the source code.
- Use `index.tsx` for sanitization of environment variables.
