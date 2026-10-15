# Pennywise Personal Finance Tracker

A personal finance tracker with web and mobile apps. Users sign in with a one-time code sent to email or SMS. Transactions are stored in Supabase and protected by per-user row security.

## Features

- Sign in by email OTP or SMS OTP
- Record income and expenses with amount, category, date, and an optional note
- Prevent expenses from exceeding the available balance in the app and database
- View balances and spending totals for every category
- Filter transactions by type, category, and inclusive date range
- Move existing local transactions to the account on first sign-in, when the account has no transactions yet

## Tech stack

- Web: React 19 and Vite
- Mobile: Expo SDK 57, React Native 0.86, and React 19.2
- Authentication and database: Supabase Auth and Postgres
- Mobile session storage: AsyncStorage
- JavaScript with npm

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). This creates the transactions table, row-level security policies, and a database check that blocks overspending.
3. In **Authentication → Sign In / Providers**, enable Email and Phone. Configure an SMS provider such as Twilio for phone OTP. Configure the **Magic Link** and **Change email address** templates to include `{{ .Token }}` for code entry. See the [Supabase email template guide](https://supabase.com/docs/guides/auth/auth-email-templates) and [phone sign-in guide](https://supabase.com/docs/guides/auth/phone-login).
4. Copy the root `.env.example` to `.env` for web, then copy `mobile/.env.example` to `mobile/.env` for Expo. Fill in the project URL and publishable key (or legacy anon key) from the Supabase project settings.
5. In Supabase Auth settings, set appropriate site and redirect URLs for local development and the deployed Netlify site.

The browser/mobile key is intended for client apps. Never put a Supabase `service_role` key in this repository or in client environment variables. Row-level security must remain enabled.

## Run locally

Install [Node.js](https://nodejs.org/) and npm.

### Web

From the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run `npm run build`.

### Mobile

From the `mobile` directory:

```bash
npm install
npm start
```

Open the app in Expo Go or an Android/iOS simulator. For a phone on the same Wi-Fi network, run `npm start -- --host lan` from the `mobile` directory.

## Netlify

Import the GitHub repository, use `npm run build` as the build command, and `dist` as the publish directory. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the site's environment variables, then redeploy.

## Assumptions and trade-offs

- Currency is USD. Amounts are stored as positive values; type determines whether they count as income or expenses.
- An expense cannot exceed the user's current balance. The UI gives immediate feedback, and a database trigger enforces the rule even if multiple sessions try to spend at once.
- Categories are built in. Totals include all expenses regardless of transaction-list filters.
- Email and SMS delivery require enabled Supabase providers. SMS requires an external delivery provider and may incur charges; configure provider rate limits and abuse protection.
- Email and phone are separate sign-in identities by default. Sign in with one method, then use **Link email / phone** in the app to verify the other method on the same account. That keeps both methods attached to the same transactions.
- Transaction data is cloud-synced for the signed-in account. The first sign-in imports legacy local data only when the account has no saved transactions. If migration fails, local data is left in place.
- The app does not currently support editing or deleting transactions.

## Filtering and rendering

Filtered and sorted transaction lists, financial summaries, and category totals are memoized from their inputs. The web transaction rows and mobile filter chips are memoized to avoid unnecessary rerenders.
