# نشر أثر باستخدام SQLite

## تشغيل محلي

    Copy-Item .env.example .env
    npm run setup:dev
    npm run db:generate
    npm run db:migrate:deploy
    npm run dev

لا تحتاج إلى Docker أو PostgreSQL. ينشأ الملف data/athar.db بعد تطبيق migration.

## تشغيل Docker

    docker compose --profile full up --build

تستخدم الخدمة volume باسم athar_sqlite_data حتى تبقى قاعدة البيانات بعد إعادة تشغيل الحاويات.

## إنتاج بخادم واحد

1. جهّز .env.production من .env.example.
2. استخدم DATABASE_URL=file:/app/data/athar.db داخل الحاوية أو مسارًا دائمًا خارجها.
3. استخدم RATE_LIMIT_STORE=upstash مع RATE_LIMIT_REDIS_URL وRATE_LIMIT_REDIS_TOKEN.
4. نفّذ npm ci ثم npm run db:generate وnpm run db:migrate:deploy وnpm run build.
5. شغّل npm start.
6. ضع نسخة احتياطية دورية لملف SQLite.
7. لا تشغّل أكثر من نسخة تطبيق تكتب إلى الملف نفسه.

الدخول لا يستخدم SMS أو بريدًا أو CAPTCHA. المدير يستخدم كلمة المرور، والمنسوب يستخدم رقم الهوية فقط؛ لذلك يجب حماية النطاق بـHTTPS وتشغيل محددات المعدل الموزعة.
