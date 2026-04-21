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
├── cli/                  # أداة CLI الجديدة
│   ├── src/
│   │   ├── index.js      # نقطة دخول CLI
│   │   ├── utils/        # فئات المساعدة
│   │   └── commands/     # تنفيذ الأوامر
├── src/                  # الكود المصدري الأساسي (قديم)
│   ├── export.js         # سكريبت التصدير الأساسي
│   └── slide1.html       # نموذج شريحة HTML
├── projects/             # المشاريع الفرعية
│   ├── 7-hapit/         # مشروع 7 عادات
│   ├── Framex/          # مشروع Framex
│   ├── ads/             # مشروع الإعلانات
│   └── anythings/       # مشروع متنوع
├── scripts/             # سكريبتات المساعدة (قديمة)
│   ├── export-all-projects.js  # تصدير جميع المشاريع
│   └── *.sh             # سكريبتات Shell
├── docs/                # التوثيق
├── output/              # المخرجات (سيتم إنشاؤه)
├── package.json         # إعدادات المشروع
└── README.md           # هذا الملف
```

## 🆕 أداة CLI جديدة

أداة سطر أوامر جديدة (CLI) متاحة الآن، توفر طريقة موحدة لإدارة وتصدير المشاريع. تتضمن CLI الأوامر التالية:

| الأمر | الوصف |
|-------|-------|
| `courselle prepare <اسم>` | إنشاء مشروع جديد من ملفات HTML في مجلد التنزيلات |
| `courselle export <اسم>` | تصدير جميع شرائح مشروع محدد |
| `courselle export-all` | تصدير جميع المشاريع الحالية بالتسلسل |
| `courselle doctor` | التحقق من صحة النظام والمشاريع |
| `courselle migrate [اسم]` | ترحيل المشاريع الحالية إلى الهيكل الجديد |

### التثبيت والاستخدام

بعد تثبيت التبعيات (`npm install`)، يمكنك استخدام CLI بعدة طرق:

1. **استخدام npx** (موصى به للاستخدام العرضي):
   ```bash
   npx courselle --help
   ```

2. **التثبيت العام** (للاستخدام المتكرر):
   ```bash
   npm link
   courselle --help
   ```

3. **التنفيذ المباشر**:
   ```bash
   node cli/src/index.js --help
   ```

### التوافق مع الإصدارات السابقة

سكريبتات Shell القديمة (`projectctl.sh`, `export-all-projects.js`, إلخ.) لا تزال تعمل، لكن CLI الجديد هو الطريقة الموصى بها للتعامل مع النظام. يمكن ترحيل المشاريع الحالية باستخدام `courselle migrate --all`.

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

#### استخدام CLI الجديد (موصى به)

1. **إنشاء مشروع جديد** من ملفات HTML في مجلد التنزيلات:
   ```bash
   npx courselle prepare مشروعي
   ```

2. **تصدير جميع شرائح مشروع**:
   ```bash
   npx courselle export مشروعي
   ```

3. **تصدير الشريحة الأولى فقط** (للمعاينة):
   ```bash
   npx courselle export مشروعي --first
   ```

4. **تصدير جميع المشاريع الحالية**:
   ```bash
   npx courselle export-all
   ```

5. **فحص صحة النظام**:
   ```bash
   npx courselle doctor --verbose
   ```

6. **ترحيل المشاريع الحالية** إلى الهيكل الجديد:
   ```bash
   npx courselle migrate --all
   ```

#### الطرق القديمة (لا تزال مدعومة)

- **تصدير شريحة واحدة**: `npm run export`
- **تصدير جميع المشاريع**: `node scripts/export-all-projects.js`
- **تصدير مشروع محدد**: `cd projects/7-hapit && node export-all.js`

سكريبتات Shell القديمة (`scripts/projectctl.sh`, `scripts/export_project.sh`, إلخ.) تبقى عاملة من أجل التوافق مع الإصدارات السابقة.

## 📁 المشاريع الفرعية

كل مشروع فرعي يحتوي على:

- `export-all.js`: سكريبت تصدير المشروع
- `html/`: مجلد يحتوي على شرائح HTML
- `png/`: مجلد للمخرجات (سيتم إنشاؤه)
- `package.json`: تبعيات المشروع

## 🛠️ التطوير

### إضافة مشروع جديد

**استخدام CLI (موصى به):**
```bash
npx courselle prepare اسم-المشروع
```
هذا ينشئ مشروع جديد بالهيكل المناسب، الملف التعريفي، وسكريبت التصدير.

**الطريقة اليدوية:**
1. إنشاء مجلد جديد في `projects/`
2. نسخ هيكل مشروع موجود
3. إضافة شرائح HTML في مجلد `html/`
4. تحديث `export-all.js` إذا لزم الأمر

### تخصيص إعدادات التصدير

يمكن تكوين إعدادات التصدير بعدة طرق:

1. **الملف التعريفي للمشروع** (`courselle.json`): كل مشروع لديه ملف تعريفي حيث يمكنك تعيين أبعاد المنظور، وقت الانتظار، وخيارات أخرى.

2. **متغيرات البيئة** (تجاوز الإعدادات الافتراضية):
   ```bash
   export VIEWPORT_WIDTH=1200
   export VIEWPORT_HEIGHT=1500
   export WAIT_MS=1000
   export EXPORT_FIRST_ONLY=1
   ```

3. **سكريبت التصدير القديم** (`export-all.js`): لا يزال يمكنك تعديل سكريبت التصدير المُنشأ مباشرةً، لكن استخدام الملف التعريفي هو الأفضل.

الأبعاد الافتراضية: `width: 1080, height: 1350`، وقت الانتظار: `700ms`.

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