# MIV Console

Mobile-first operations console for Maa Inti Vanta.

## Stack

- React + TypeScript + Vite
- Tailwind CSS (with shadcn-style component primitives)
- Firebase Auth + Firestore + Hosting
- Vitest

## Setup

1. Copy `.env.example` to `.env.local` and set `VITE_FIREBASE_*`.
2. Install dependencies:
   - `npm ci`
3. Start local app:
   - `npm run dev`

## Firebase Deployment

- Hosting targets: `dev`, `prod`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- CI workflow: `.github/workflows/firebase-hosting.yml`

Required GitHub secrets:

- `FIREBASE_SERVICE_ACCOUNT_DEV`
- `FIREBASE_PROJECT_ID_DEV`
- `FIREBASE_SERVICE_ACCOUNT_PROD`
- `FIREBASE_PROJECT_ID_PROD`

## Key V1 Invariants Implemented

- One menu per `dateKey` (`menus/{dateKey}`), overwrite requires explicit confirmation.
- WhatsApp text is generated dynamically; not persisted in Firestore.
- No automatic menu deletion.
- Billing blocked when no menu exists for selected date.
- Monetary values use integer paise (`*InPaise`) only.
- Order creation defaults to `status: "pending"`.
- `createdAt`, `updatedAt`, `deliveredAt` use `serverTimestamp()` when written.
- Courier delivery update changes only `status` and `deliveredAt` (`pending -> delivered`).
- Breakfast inventory is uncategorized; lunch/dinner use structured categories.
- Kitchen board strike states are local UI state only (not persisted).
