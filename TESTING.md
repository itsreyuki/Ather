# الاختبارات

```bash
npm run test:unit
node --env-file=.env .\\node_modules\\vitest\\vitest.mjs run tests/integration
node --env-file=.env .\\node_modules\\playwright\\cli.js test
```

تغطي اختبارات الوحدة حسابات الأثر، الأوزان، حالات الورش، انتقالات الوقت، البحث الآمن بالهوية، وتطبيع الجوال. تغطي اختبارات التكامل إنشاء الحساب والمدرسة والاستيراد والورش والتقارير وعزل المدارس. ويغطي سيناريو Playwright التسجيل والاستيراد والقياس والتقييم من بوابة المنسوب برقم الهوية فقط والتقرير والتصدير.

تحتاج اختبارات التكامل وE2E إلى `DATABASE_URL` صالح وmigrations مطبقة.
