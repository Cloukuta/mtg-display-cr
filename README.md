# MTG Display CR

Multi-user public displays for Magic: The Gathering cards, with prices in Costa Rican colones and purchase inquiries through WhatsApp.

## MVP status

- Responsive demonstration catalog.
- Google authentication through Supabase.
- A seller profile and public URL for each user (`/v/{slug}`).
- Private inventory protected with Row Level Security.
- Moxfield CSV import with printing resolution through Scryfall.
- Quantity, condition, language, finish, CRC price, and availability management.
- Inquiry cart with a prefilled WhatsApp message.

The MVP does not include payments, commissions, shipping, internal chat, or buyer accounts.

## Local development

Requirements: Node.js 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Configure these values in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/migrations/202609140001_initial_schema.sql` in the SQL Editor.
3. In Authentication → Providers, enable Google.
4. Add `http://localhost:3000/dashboard` and the production `/dashboard` URL to the allowed redirect URLs.
5. Copy the Project URL and anon key into the environment variables.

The `service_role` key is not used in the browser and must never be committed to GitHub.

## Moxfield import

The importer recognizes common variations of `Quantity`, `Name`, `Edition/Set`, `Collector Number`, `Scryfall ID`, `Condition`, `Language`, and `Finish/Foil`.

Printing resolution follows this order: Scryfall ID, set + collector number, then exact card name. Unresolved rows remain visible for review.

## Validation

```bash
pnpm build
```

GitHub Actions runs the build on every push and pull request targeting `main`.

## Data and security

- CRC prices are stored as integers.
- Row Level Security limits writes and inventory management to the owner.
- A display becomes public only after the seller publishes it.
- Only available cards with a quantity greater than zero are publicly visible.
- Buyers do not need an account.

Magic card data and images are provided by Scryfall. Magic: The Gathering is owned by Wizards of the Coast.
