# Pennywise — Personal Finance Tracker

A personal finance transaction tracker with a responsive React web application and a React Native app powered by Expo.

## Features

- Record income and expenses with amount, category, date, and optional note
- Validate positive amounts and required fields
- View income, expenses, and remaining balance
- Filter transactions by type, category, and inclusive date range
- View spending totals by category
- Persist transactions locally in the browser or on the mobile device
- Keep the summary and category breakdown based on all recorded transactions, independent of list filters

## Tech stack

- Web: React 19, Vite, browser `localStorage`
- Mobile: React Native, Expo, AsyncStorage
- No account or server required; browser and device data are stored separately

## Run the web app

From the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`.

## Run the mobile app

From the `mobile` directory:

```bash
npm install
npm start
```

Use Expo Go or an Android/iOS simulator. The mobile date filters accept `YYYY-MM-DD`; the web app uses native date inputs.

## Assumptions and trade-offs

- Currency is USD and amounts are stored as positive decimal values; the transaction type determines whether the amount adds to income or expenses.
- Balance is calculated as total income minus total expenses. Expenses may exceed income, so a negative balance can accurately represent overspending; the app does not block a valid expense based on the current balance.
- The tracker is single-user and local-only. There is no synchronization between browser and mobile installations, backup, authentication, editing, or deletion.
- Categories use a built-in list. The dashboard totals use all transactions, while filters only change the transaction list.
- Local persistence is best suited to a personal/demo tracker; clearing browser or app data removes locally stored transactions.
