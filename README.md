# Pump Free-on-Loan Tracker

A responsive React app for tracking company pumps issued free on loan to customers. It works like a lightweight master sheet with barcode lookup, mobile updates, dashboard counts, and CSV export.

## Features

- Pump master records with Pump ID, model, serial number, customer, site, contact, salesperson, issue date, expected return date, status, and remarks
- Barcode / QR payload lookup by Pump ID or serial number
- Live QR/barcode camera scanning on supported mobile browsers
- Printable QR label per pump, linked to that pump record
- Admin PIN flow for inventory add/delete/reset
- Customer issue and return-status workflow
- Status options: Available, Active, Returned, Damaged, Lost, Replaced
- Dashboard totals for available, on-loan, due-return, and lost/damaged pumps
- Customer-wise and pump-wise search
- Local persistence through `localStorage`
- CSV export and print support
- Desktop and mobile responsive layouts

## Run Locally

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

## Admin Access

Inventory changes require the admin PIN. The default Apps Script PIN is `admin123`; change `PUMP_TRACKER_ADMIN_PIN` in Apps Script project properties before sharing the app widely.
