# المنصة التعليمية التفاعلية | Interactive Edu SPA

منصة تعليمية عربية كاملة (Full-Stack): واجهة أمامية تفاعلية بصفحة واحدة (SPA) بدون أي إطار عمل،
مع خادم خلفي (Backend) يدير المستخدمين والمناهج والاختبارات ولوحة تحكم للإدارة.

## المزايا

### الواجهة الأمامية (`index.html` + `css/` + `js/`)
- شجرة مناهج تفاعلية: صفوف ← مواد ← فصول ← وحدات ← دروس (تُبنى ديناميكياً من البيانات).
- عرض الدروس: فيديوهات (يوتيوب)، ملفات PDF، روابط خارجية.
- اختبار سريع لكل درس (`quizEngine.js`) مع تصحيح فوري وعرض النتيجة.
- لغز اليوم (`dailyPuzzle.js`) يُقرأ من `data/puzzles.json` حسب تاريخ الجهاز.
- آلة حاسبة علمية مدمجة (`calculator.js`) + حلّال معادلات (`equationSolver.js`).
- تصميم متجاوب: 3 أعمدة على الحاسوب، وقائمة جانبية (Hamburger) على الهاتف.

### الخادم الخلفي (`backend/` — FastAPI)
- مصادقة JWT: تسجيل حساب / تسجيل دخول بالبريد الإلكتروني، تشفير كلمات المرور بـ bcrypt.
- صلاحيات: `student` و `admin`.
- شجرة المناهج مخزنة في قاعدة بيانات SQLite عبر SQLAlchemy، وتُزرع تلقائياً من
  `data/curriculum.json` عند أول تشغيل.
- تتبع قراءات الدروس لكل مستخدم + إحصائيات (الأكثر قراءة).
- تحديد معدل الطلبات (Rate Limiting)، رؤوس أمان، CORS، وإخفاء توثيق `/docs` في الإنتاج.

### لوحة التحكم (`admin.html` + `js/admin.js`)
- تحرير شجرة المناهج كاملة (صفوف/مواد/وحدات/دروس/اختبارات) وحفظها في قاعدة البيانات.
- رفع ملفات PDF إلى مجلد `Books/` حسب المسار الدراسي.
- إدارة الألغاز اليومية (`data/puzzles.json`).
- إدارة المستخدمين (ترقية/حذف/تغيير كلمة المرور) وعرض الإحصائيات.

## بنية المشروع

```text
.
├── index.html          # الواجهة الرئيسية (SPA)
├── admin.html          # لوحة تحكم الإدارة
├── css/                # main, layout, components, calculator, admin, responsive
├── js/                 # app, uiController, curriculumData, quizEngine,
│                       # dailyPuzzle, calculator, equationSolver, admin
├── data/
│   ├── curriculum.json # البذرة الأولية للمناهج
│   └── puzzles.json    # الألغاز اليومية
├── Books/              # كتب وملخصات PDF (تُرفع من لوحة التحكم)
├── backend/
│   ├── main.py         # تطبيق FastAPI + كل مسارات API
│   ├── models.py       # جداول: users, grades, subjects, semesters,
│   │                   # units, lessons, lesson_resources, user_lesson_reads
│   ├── schemas.py      # مخططات Pydantic
│   └── database.py     # إعداد SQLite + الجلسات
├── run.py              # تشغيل السيرفر بأمر واحد
├── make_admin.py       # إنشاء/ترقية حساب أدمن
├── requirements.txt
└── CNAME               # الدومين المخصص للنشر
```

## التشغيل محلياً

المتطلبات: Python 3.10+.

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 run.py
```

ثم افتح: `http://localhost:8899` — وتُنشأ قاعدة البيانات (`edursc.db`) تلقائياً.

### إنشاء حساب أدمن

```bash
# سجّل حساباً عادياً من الموقع أولاً، ثم:
python3 make_admin.py you@example.com
```

### متغيرات البيئة (اختيارية)

| المتغير | الافتراضي | الوصف |
|---|---|---|
| `SECRET_KEY` | مفتاح تطوير | مفتاح توقيع JWT — **غيّره في الإنتاج** |
| `ENV` | _(فارغ)_ | ضع `production` لإخفاء `/docs` وتفعيل HSTS |
| `ALLOWED_ORIGINS` | `https://academy.nxr8.work.gd` | الدومينات المسموحة لـ CORS (افصل بفاصلة) |

## أهم مسارات API

```text
POST /api/auth/register      إنشاء حساب (يرجع JWT)
POST /api/auth/login         تسجيل الدخول (يرجع JWT)
GET  /api/auth/me            بيانات المستخدم الحالي
GET  /api/curriculum         شجرة المناهج كاملة
POST /api/lessons/{id}/read  تسجيل قراءة درس (يحتاج دخول)
GET  /api/lessons/{id}/quiz  أسئلة الاختبار السريع لدرس

# للإدارة فقط (role=admin):
POST /api/admin/curriculum/save
POST /api/admin/upload           رفع PDF إلى Books/
POST /api/admin/puzzles/save
GET  /api/admin/analytics
GET/PUT/DELETE /api/admin/users...
```

التوثيق التفاعلي في وضع التطوير: `http://localhost:8899/docs`

## الفروع والنشر

| الفرع | المحتوى | النشر |
|---|---|---|
| `main` | النسخة الكاملة (واجهة + `backend`) — **تحتاج سيرفر** | سيرفر (VPS) عبر `run.py` |
| `legacy-github-pages` | النسخة القديمة الستاتيك (بدون سيرفر) | GitHub Pages مباشرة |

> لا تدمج الفرعين: تاريخهما مختلف عن قصد (ستاتيك مقابل Full-Stack).
> إذا أردت أن يعرض GitHub Pages الموقع القديم: Settings ← Pages ← Branch ← `legacy-github-pages`.

## التقنيات

HTML5 · CSS3 · Vanilla JavaScript · FastAPI · Uvicorn · SQLAlchemy (SQLite) ·
Pydantic · python-jose (JWT) · passlib/bcrypt · slowapi
