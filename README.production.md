# ATHAR — دليل التشغيل

## المتطلبات

- Node.js LTS وnpm.
- ملف SQLite قابل للكتابة ومجلد نسخ احتياطية محمي.
- نطاق HTTPS عند النشر الخارجي.
- Redis موزع لمحددات المعدل في الإنتاج.

SQLite مناسب لتثبيت واحد أو خادم واحد. إذا احتجت عدة خوادم تطبيق أو كتابة متزامنة عالية، استخدم PostgreSQL أو قاعدة خادمية لاحقًا.

## الإعداد المحلي

انسخ .env.example إلى .env ثم نفّذ:

    Copy-Item .env.example .env
    npm run setup:dev
    npm run db:generate
    npm run db:migrate:deploy
    npm run dev

يستخدم التطبيق file:./data/athar.db افتراضيًا. احفظ مجلد data على قرص دائم ولا تضعه في المستودع.

## البناء والنشر

    npm ci
    npm run db:generate
    npm run typecheck
    npm run lint
    npm run test:unit
    npm run db:migrate:deploy
    npm run build
    npm start

لا يحتاج هذا الإصدار إلى SMS أو بريد إلكتروني أو CAPTCHA. المدير يدخل بكلمة مرور، والمنسوب يدخل برقم الهوية فقط.

## النسخ الاحتياطي

    npm run db:backup -- backups/athar-manual.db
    npm run db:backup:verify -- backups/athar-manual.db

راجع دليل النسخ والاستعادة في docs/backup-restore.md.
