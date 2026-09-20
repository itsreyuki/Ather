# خدمات خارجية اختيارية

لا يحتاج أثر إلى مزود رسائل قصيرة أو بريد إلكتروني أو CAPTCHA لتشغيله. لا ترسل المنصة رسائل خارجية، ولا توجد مفاتيح أو إعدادات لمزودي المراسلة.

المكونات الخارجية الاختيارية المتبقية هي:

- SQLite: قاعدة بيانات التطبيق المحلية، وهي مطلوبة.
- Upstash Redis: مخزن rate limiting الموزع في الإنتاج. اضبط `RATE_LIMIT_STORE=upstash` و`RATE_LIMIT_REDIS_URL` و`RATE_LIMIT_REDIS_TOKEN`.
- مراقبة الأخطاء: اربط `ERROR_MONITORING_PROVIDER` و`ERROR_MONITORING_DSN` و`ERROR_MONITORING_API_KEY` بجهة المراقبة التي تعتمدها المدرسة.

بعد إدخال إعدادات Redis أو المراقبة يمكن التحقق منها دون إرسال أي رسائل:

```bash
npm run providers:verify -- redis
npm run providers:verify -- monitor
```

دخول المدير يتم بكلمة المرور، ودخول المنسوب يتم برقم الهوية فقط. لذلك لا تضف متغيرات SMS أو Email أو CAPTCHA إلى بيئة النشر؛ أي متغيرات قديمة منها ستبقى غير مستخدمة.
