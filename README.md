# Pennywise Personal Finance Tracker

A simple personal finance tracker with a responsive web app and a companion mobile app. Record income and expenses, review your balance, filter transactions, and see spending totals for every category.

## Features

- Record income and expenses with an amount, category, date, and optional note
- Reject invalid or non-positive amounts
- Prevent an expense from exceeding the available balance
- View total income, expenses, balance, and spending by category
- Filter transactions by type, category, and inclusive date range
- Save data locally in the browser or on the mobile device

## Tech stack

- Web: React 19 and Vite
- Mobile: React Native and Expo
- Mobile storage: AsyncStorage
- Web storage: browser `localStorage`
- JavaScript with npm

## Setup

Install [Node.js](https://nodejs.org/) and npm first.

### Web app

From the project root:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build, run:

```bash
npm run build
```

### Mobile app

From the `mobile` directory:

```bash
npm install
npm start
```

Open the project in Expo Go or an Android/iOS simulator. For a phone on the same Wi-Fi network, run `npx expo start --host lan`.

## Assumptions and trade-offs

- Currency is USD. Amounts are entered as positive values; transaction type determines whether they count as income or expenses.
- An expense cannot exceed the current balance. Users must record income before adding expenses that would otherwise make the balance negative.
- Categories are a built-in list. The category breakdown includes every category with recorded expenses and uses all transactions, regardless of list filters.
- Data is local to each browser or device. There is no account, server, or synchronization between web and mobile.
- Clearing browser or app data removes locally saved transactions. The app does not currently support backup, editing, or deletion.
- Mobile dates are entered as `YYYY-MM-DD`; the web app uses native date inputs.

## Filtering and rendering

Filtered and sorted transaction lists, financial summaries, and category totals are memoized from their inputs. On web, unchanged transaction rows are memoized so changing filters does not rerender every row.
