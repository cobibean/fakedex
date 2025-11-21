# FakeDEX – Powered by FAKEUSD

**Backed by nothing, trusted by everyone.**

FakeDEX is a one-page, meme-native DEX simulation where users trade ridiculous meme pairs against FAKEUSD.

## Getting Started

### 1. Environment Setup

Create a `.env.local` file in the root directory with the following variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_thirdweb_client_id
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup (Supabase)

Run the SQL commands in `supabase/schema.sql` in your Supabase SQL Editor to set up the database tables and seed initial data.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), Tailwind CSS, Framer Motion
- **Web3**: thirdweb SDK (v4/v5 compatible hooks)
- **Backend**: Supabase (Postgres + Realtime)
- **Simulation**: Chaos Engine (Client/Server hybrid)
