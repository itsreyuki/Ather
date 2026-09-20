# أثر | ATHAR

منصة عربية لقياس أثر التدريب المدرسي، من البيانات إلى القرار.

## التشغيل المحلي

```bash
npm ci
Copy-Item .env.example .env
npm run setup:dev
npm run db:generate
npm run db:migrate:deploy
npm run dev
```

يمكن تشغيل بيانات العرض في التطوير فقط بوضع `ATHAR_SEED=true` ثم تنفيذ `npm run db:seed`.

## الدخول

- المدير: يسجل أو يدخل بالبريد الإلكتروني أو الجوال وكلمة المرور.
- المنسوب: يدخل برقم الهوية فقط، بلا رسالة SMS أو بريد أو CAPTCHA.

توجد محددات معدل وسجل تدقيق للأحداث الأمنية، لكن دخول المنسوب برقم الهوية وحده أقل قوة من التحقق الثنائي. شغّل الإنتاج خلف HTTPS مع Redis لمحددات المعدل.

## التحقق

```bash
npm run typecheck
npm run lint
npm run test:all
```

للنشر راجع [دليل الإنتاج](README.production.md)، [دليل الخدمات الخارجية](docs/provider-setup.md)، و[درس النشر](docs/production-deployment-tutorial.md).
