# أتمتة إنشاء محتوى لـ Courselle

مشروع أتمتة لإنشاء وتصدير محتوى مرئي لـ Courselle من شرائح HTML إلى صور PNG.

## 📋 المميزات

- تصدير شرائح HTML إلى صور PNG عالية الجودة
- دعم متعدد المشاريع (7-hapit, Framex, ads, anythings)
- تكامل مع Playwright لأتمتة المتصفح
- سكريبتات موحدة للتصدير الجماعي
- هيكل منظم وسهل الصيانة

## 🏗️ هيكل المشروع

```
courselle-automation/
├── src/                    # الكود المصدري الأساسي
│   ├── export.js          # سكريبت التصدير الأساسي
│   └── slide1.html        # نموذج شريحة HTML
├── projects/              # المشاريع الفرعية
│   ├── 7-hapit/          # مشروع 7 عادات
│   ├── Framex/           # مشروع Framex
│   ├── ads/              # مشروع الإعلانات
│   └── anythings/        # مشروع متنوع
├── scripts/              # سكريبتات المساعدة
│   ├── export-all-projects.js  # تصدير جميع المشاريع
│   └── *.sh              # سكريبتات Shell
├── docs/                 # التوثيق
├── output/               # المخرجات (سيتم إنشاؤه)
├── package.json          # إعدادات المشروع
└── README.md            # هذا الملف
```

## 🚀 البدء السريع

### المتطلبات الأساسية
- Node.js 14 أو أعلى
- npm أو yarn

### التثبيت

```bash
# استنساخ المشروع
git clone <رابط-المستودع>
cd courselle-automation

# تثبيت التبعيات
npm install

# تثبيت Playwright browsers
npx playwright install
```

### الاستخدام

#### 1. تصدير شريحة واحدة
```bash
npm run export
```

#### 2. تصدير جميع المشاريع
```bash
node scripts/export-all-projects.js
```

#### 3. تصدير مشروع محدد
```bash
cd projects/7-hapit
npm install
node export-all.js
```

## 📁 المشاريع الفرعية

كل مشروع فرعي يحتوي على:

- `export-all.js`: سكريبت تصدير المشروع
- `html/`: مجلد يحتوي على شرائح HTML
- `png/`: مجلد للمخرجات (سيتم إنشاؤه)
- `package.json`: تبعيات المشروع

## 🛠️ التطوير

### إضافة مشروع جديد

1. إنشاء مجلد جديد في `projects/`
2. نسخ هيكل مشروع موجود
3. إضافة شرائح HTML في مجلد `html/`
4. تحديث `export-all.js` إذا لزم الأمر

### تخصيص إعدادات التصدير

يمكن تعديل إعدادات الصور في `export-all.js`:
- الأبعاد: `width: 1080, height: 1350`
- تنسيق الانتظار
- معالجة الخطوط

## 📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT. انظر ملف [LICENSE](LICENSE) للتفاصيل.

## 👥 المساهمة

1. Fork المشروع
2. إنشاء فرع للميزة (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
4. Push إلى الفرع (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

## 📞 الاتصال

محمد حليم رحيم كريم - [@mohammedgist](https://github.com/mohammedgist)

رابط المشروع: [https://github.com/mohammedgist/courselle-automation](https://github.com/mohammedgist/courselle-automation)