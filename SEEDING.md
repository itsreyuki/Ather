# Development seed

The seed creates only synthetic data for local UI review. It is blocked when `NODE_ENV=production` and also requires an explicit `ATHAR_SEED=true` guard.

Configure the database and development secrets, then run:

```powershell
$env:NODE_ENV = "development"
$env:SEED_DEMO_EMAIL = "demo.manager@athar.local"
$env:SEED_DEMO_PASSWORD = "Demo-only-password-123!"
npm run setup:dev
npm run db:migrate:deploy
$env:ATHAR_SEED = "true"
npm run db:seed
npm run dev
```

The seed creates `مدرسة النماء النموذجية`, 35 clearly fake staff records, two completed workshops with snapshots, an in-progress workshop, a scheduled workshop, a post-assessment-ready workshop, a draft, templates, notifications, and audit activity.

The fake identity values use the `990000....` range and the phone values use the `050000....` range. They are not real people or credentials. The demo account is printed only by the development seed command and is never created automatically in production.
