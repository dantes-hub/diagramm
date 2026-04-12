# ProcessFlow

Turn internal policy documents and SOPs into editable process diagrams. Upload a PDF or paste text — the app extracts actors, steps, and decision points into a swimlane or flowchart, with a review step before the diagram is built.

Built for compliance teams who need to visualize workflows without drawing them from scratch.

---

## What it does

1. **Upload** a PDF, TXT, or MD file — or paste raw policy text
2. **Extract** — GPT-4.1-mini reads the document and identifies actors, steps, decisions, and their sequence
3. **Review** — edit the extracted actors and steps before the diagram is generated
4. **Edit** — drag nodes, relabel steps, add or remove connections in the visual editor
5. **Export** — download as PNG, PDF, or BPMN 2.0

Supports English and Mongolian. When the UI language is set to Mongolian, the AI extraction output is also in Mongolian.

---

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React Flow** — diagram canvas
- **Dagre** — automatic graph layout
- **Prisma** + PostgreSQL
- **Supabase** — auth and file storage
- **OpenAI API** — structured extraction via JSON schema mode
- **pdf-parse** — PDF text extraction

---

## Local setup

**Requirements:** Node.js 20+, Docker

```bash
git clone https://github.com/YOUR_USERNAME/processflow.git
cd processflow
npm install
cp .env.example .env
```

Start local Postgres and apply the schema:

```bash
npm run db:up
npm run db:push
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Auth and file storage are optional in local dev — the app works without Supabase env vars.

---

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | Enables AI extraction. Falls back to heuristic if not set |
| `OPENAI_MODEL` | Model to use. Defaults to `gpt-4.1-mini` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side storage uploads |
| `SUPABASE_STORAGE_BUCKET` | Bucket name. Defaults to `uploads` |
| `UPLOAD_STORAGE_PROVIDER` | `local`, `supabase`, or `none` |

---

## Deployment

Runs on Vercel + Supabase.

1. Push to GitHub and import the repo in Vercel
2. Add environment variables in the Vercel dashboard
3. For `DATABASE_URL` on Vercel, use the Supabase **Transaction pooler** URL (port 6543)
4. Apply the schema to your production database once:

```bash
DATABASE_URL="supabase-session-pooler-url" npx prisma db push
```

5. In Supabase → Authentication → URL Configuration, set your Vercel deployment URL as the site URL

---

## File uploads

Accepted formats: `.pdf`, `.txt`, `.md` — max 10 MB. Files are validated by both extension and MIME type before being processed.

---

## BPMN export

The diagram editor uses a BPMN-compatible canonical model internally. The supported v1 subset is documented in [docs/bpmn-subset.md](docs/bpmn-subset.md).

Supported elements: `start_event`, `task`, `exclusive_gateway`, `end_event`, `lanes`, `sequence_flow`, `text_annotation`.
