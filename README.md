# Splitly web

Independent Bun 1.4.3 / Next.js repository. Run `bun install --frozen-lockfile`,
then `bun run check`, `bun run test`, and `bun run build` from this directory.

For native development, copy `.env.local.example` to `.env.local`, enter the
dev Supabase URL and publishable key, then run `bun run dev`. Open
`http://localhost:3003`. The app has no login UI yet; the Supabase variables
prepare the public configuration for later implementation.

Only publishable Supabase keys belong in `NEXT_PUBLIC_*` variables.
