# إعداد متغيرات البيئة - WamedBot

## المتغيرات المطلوبة

قم بإنشاء ملف `.env.local` في مجلد المشروع وأضف المتغيرات التالية:

```env
# Astra DB Configuration
ASTRA_DB_NAMESPACE=your_namespace
ASTRA_DB_COLLECTION=wamed_content
ASTRA_DB_API_ENDPOINT=https://your-database-id-your-region.apps.astra.datastax.com
ASTRA_DB_APPLICATION_TOKEN=your_application_token

# Google AI Configuration
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

## كيفية الحصول على القيم

### 1. Astra DB
1. اذهب إلى [Astra DB Console](https://astra.datastax.com/)
2. أنشئ قاعدة بيانات جديدة أو استخدم موجودة
3. احصل على Application Token من إعدادات الأمان
4. انسخ Namespace و API Endpoint من صفحة قاعدة البيانات

### 2. Google AI (Gemini)
1. اذهب إلى [Google AI Studio](https://makersuite.google.com/app/apikey)
2. أنشئ API Key جديد
3. انسخ المفتاح إلى المتغير `GOOGLE_GENERATIVE_AI_API_KEY`

## ملاحظات مهمة

- لا تشارك ملف `.env.local` في Git
- تأكد من أن جميع المتغيرات مملوءة قبل تشغيل المشروع
- بعد إعداد المتغيرات، قم بتشغيل `npm run seed` لتحميل البيانات 