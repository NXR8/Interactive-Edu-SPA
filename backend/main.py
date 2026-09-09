import os
import json
from datetime import datetime, timedelta
from typing import List

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from passlib.context import CryptContext
from jose import JWTError, jwt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from .database import engine, Base, get_db
from . import models, schemas

# دالة مساعدة للحصول على IP العميل الحقيقي خلف nginx reverse proxy
def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)

limiter = Limiter(key_func=client_ip)

# إخفاء Swagger UI في الإنتاج (ضبط ENV=production)
is_production = os.getenv("ENV") == "production"
app = FastAPI(title="Interactive Edu Platform API", docs_url=None if is_production else "/docs", redoc_url=None if is_production else "/redoc")
app.state.limiter = limiter
app.add_exception_handler(429, _rate_limit_exceeded_handler)

# إعداد CORS — قائمة البيضاء من متغير البيئة أو القيمة الافتراضية للتطوير
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://academy.nxr8.work.gd").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# إضافة رؤوس أمان (Security Headers) ومنع الكاش لكل الاستجابات
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # منع التخزين المؤقت لكل الملفات لضمان التحديث الفوري
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# ----------------- إعدادات المصادقة (Auth) -----------------
SECRET_KEY = os.getenv("SECRET_KEY", "my_super_secret_key_for_edu_platform")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # أسبوع

# إنشاء الجداول عند بدء التشغيل بدلاً من مستوى الملف
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """التحقق من التوكن واسترجاع المستخدم الحالي"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="تعذر التحقق من بيانات الاعتماد",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

def require_admin(current_user: models.User = Depends(get_current_user)):
    """التحقق من أن المستخدم الحالي هو مسؤول (Admin) وإلا يُرفض الطلب"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="هذا الإجراء مسموح للمسؤولين فقط"
        )
    return current_user

# ----------------- مسارات المصادقة (Auth) -----------------

@app.post("/api/auth/register", response_model=schemas.Token)
@limiter.limit("5/minute")
def register(request: Request, user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجل مسبقاً")
    
    hashed_pw = get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        birth_date=user.birth_date,
        password_hash=hashed_pw
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")
    
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {"email": current_user.email, "first_name": current_user.first_name, "last_name": current_user.last_name, "role": current_user.role}

# ----------------- مسارات الـ API العامة -----------------

@app.get("/api/curriculum", response_model=schemas.CurriculumSchema)
def get_curriculum(db: Session = Depends(get_db)):
    """جلب جميع الصفوف مع المواد والفصول والوحدات والدروس والمصادر"""
    grades = db.query(models.Grade).all()
    
    # إذا كانت قاعدة البيانات فارغة، نقوم بتعبئتها من JSON كـ Seed أولي
    if not grades:
        seed_database(db)
        grades = db.query(models.Grade).all()
    
    # تضمين بيانات الأسئلة (quiz) في كل درس
    for grade in grades:
        for subject in grade.subjects:
            for semester in subject.semesters:
                for unit in semester.units:
                    for lesson in unit.lessons:
                        if lesson.quiz_data:
                            try:
                                lesson.quiz = json.loads(lesson.quiz_data)
                            except (json.JSONDecodeError, TypeError):
                                lesson.quiz = []
                        else:
                            lesson.quiz = []
        
    return {"grades": grades}

@app.post("/api/lessons/{lesson_id}/read")
def mark_lesson_read(lesson_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """تسجيل قراءة درس معين للمستخدم الحالي"""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="الدرس غير موجود")
    
    existing_read = db.query(models.UserLessonRead).filter(
        models.UserLessonRead.user_id == current_user.id,
        models.UserLessonRead.lesson_id == lesson_id
    ).first()
    
    if not existing_read:
        new_read = models.UserLessonRead(user_id=current_user.id, lesson_id=lesson_id, is_read=True)
        db.add(new_read)
        db.commit()
        
    return {"status": "success"}

# =====================================================
# مسارات لوحة التحكم (Admin API)
# =====================================================

@app.post("/api/admin/curriculum/save")
def admin_save_curriculum(
    payload: dict,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """
    حفظ وتزامن شجرة المناهج الكاملة مع قاعدة البيانات.
    
    يستقبل شجرة المناهج المعدلة بصيغة JSON ويقوم بـ:
    1. التحقق من صحة البيانات قبل المسح (حماية ضد البيانات الفارغة)
    2. مسح البيانات القديمة بالكامل
    3. إعادة بناء الشجرة من الـ JSON المستلم
    4. تحديث ملف curriculum.json للتزامن
    """
    try:
        grades_data = payload.get("grades", [])
        
        # ======= التحقق من صحة البيانات قبل المسح (حماية) =======
        if not grades_data or not isinstance(grades_data, list):
            raise HTTPException(
                status_code=400,
                detail="لا توجد بيانات صالحة للحفظ. أعد تحميل الصفحة وحاول مجدداً."
            )
        for i, g in enumerate(grades_data):
            if not isinstance(g, dict) or not g.get("name"):
                raise HTTPException(
                    status_code=400,
                    detail=f"بيانات غير صالحة في العنصر {i+1}: اسم الصف مطلوب."
                )
            if not isinstance(g.get("subjects"), list):
                raise HTTPException(
                    status_code=400,
                    detail=f"الصف '{g.get('name')}' لا يحتوي على قائمة مواد صالحة."
                )
        
        # ======= الخطوة 1: مسح البيانات القديمة بالكامل بالتفصيل =======
        db.query(models.LessonResource).delete()
        db.query(models.UserLessonRead).delete()
        db.query(models.Lesson).delete()
        db.query(models.Unit).delete()
        db.query(models.Semester).delete()
        db.query(models.Subject).delete()
        db.query(models.Grade).delete()
        db.flush()
        
        # ======= الخطوة 2: إعادة بناء الشجرة =======
        for g_data in grades_data:
            grade = models.Grade(
                name=g_data.get("name", ""),
                icon=g_data.get("icon", "")
            )
            db.add(grade)
            db.flush()
            
            for s_data in g_data.get("subjects", []):
                subject = models.Subject(
                    name=s_data.get("name", ""),
                    icon=s_data.get("icon", ""),
                    book_url=s_data.get("bookUrl", ""),
                    grade_id=grade.id
                )
                db.add(subject)
                db.flush()
                
                for sem_data in s_data.get("semesters", []):
                    semester = models.Semester(
                        name=sem_data.get("name", ""),
                        book_url=sem_data.get("bookUrl", ""),
                        subject_id=subject.id
                    )
                    db.add(semester)
                    db.flush()
                    
                    for u_data in sem_data.get("units", []):
                        unit = models.Unit(
                            name=u_data.get("name", ""),
                            semester_id=semester.id
                        )
                        db.add(unit)
                        db.flush()
                        
                        for l_data in u_data.get("lessons", []):
                            lesson = models.Lesson(
                                title=l_data.get("title", ""),
                                unit_id=unit.id,
                                is_private=l_data.get("is_private", False)
                            )
                            db.add(lesson)
                            db.flush()
                            
                            # حفظ بيانات الأسئلة (Quiz) مع التحقق
                            quiz = l_data.get("quiz", [])
                            if quiz:
                                for qi, q in enumerate(quiz):
                                    opts = q.get("options", [])
                                    if len(opts) < 2:
                                        raise HTTPException(
                                            status_code=400,
                                            detail=f"السؤال {qi + 1} في درس '{l_data.get('title', '')}' يجب أن يحتوي على خيارين على الأقل"
                                        )
                                lesson.quiz_data = json.dumps(quiz, ensure_ascii=False)
                            
                            # إضافة المصادر المتعددة (من مصفوفة resources مع دعم الحقول المسطحة القديمة)
                            if "resources" in l_data and isinstance(l_data["resources"], list):
                                for r in l_data["resources"]:
                                    url = (r.get("url") or "").strip()
                                    if url:
                                        db.add(models.LessonResource(
                                            lesson_id=lesson.id,
                                            type=r.get("type", "link"),
                                            url=url,
                                            title=r.get("title", "")
                                        ))
                            else:
                                # Fallback: الحقول المسطحة القديمة (videoUrl, summaryUrl, pastExamsUrl)
                                if l_data.get("videoUrl"):
                                    db.add(models.LessonResource(
                                        lesson_id=lesson.id, type="video",
                                        url=l_data["videoUrl"], title="شرح مرئي"
                                    ))
                                if l_data.get("summaryUrl"):
                                    db.add(models.LessonResource(
                                        lesson_id=lesson.id, type="pdf",
                                        url=l_data["summaryUrl"], title="ملخص الدرس"
                                    ))
                                if l_data.get("pastExamsUrl"):
                                    db.add(models.LessonResource(
                                        lesson_id=lesson.id, type="pdf",
                                        url=l_data["pastExamsUrl"], title="أسئلة سنوات سابقة"
                                    ))
        
        # ======= الخطوة 3: تأكيد العملية (Commit) =======
        db.commit()
        
        # ======= الخطوة 4: تحديث ملف JSON للتزامن =======
        try:
            with open("data/curriculum.json", "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"تحذير: فشل تحديث ملف curriculum.json: {e}")
        
        return {
            "status": "success",
            "message": "تم حفظ المناهج وتحديث قاعدة البيانات بنجاح",
            "grades_count": len(grades_data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"فشل حفظ المناهج: {str(e)}"
        )


# ----------------- مسار رفع الملفات -----------------
@app.post("/api/admin/upload")
async def admin_upload_file(
    file: UploadFile = File(...),
    grade: str = Form(...),
    subject: str = Form(...),
    semester: str = Form(...),
    unit: str = Form(default=""),
    admin: models.User = Depends(require_admin)
):
    """رفع ملف PDF إلى مجلد Books/ وفق المسار المحدد"""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="يرجى رفع ملف PDF فقط")
    
    # إنشاء المجلدات المطلوبة
    dir_path = os.path.join("Books", grade, subject, semester, unit) if unit else os.path.join("Books", grade, subject, semester)
    os.makedirs(dir_path, exist_ok=True)
    
    # حفظ الملف
    file_path = os.path.join(dir_path, file.filename)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    # إرجاع رابط المسار المحلي
    url_path = f"/Books/{grade}/{subject}/{semester}/{unit}/{file.filename}"
    return {"url": url_path, "filename": file.filename}


# ----------------- مسار حفظ الألغاز (Puzzles) -----------------
@app.post("/api/admin/puzzles/save")
def save_puzzles(
    payload: dict,
    admin: models.User = Depends(require_admin)
):
    """حفظ الألغاز إلى ملف puzzles.json على السيرفر"""
    puzzles = payload.get("puzzles", [])
    if not isinstance(puzzles, list):
        raise HTTPException(status_code=400, detail="البيانات غير صالحة")
    try:
        with open("data/puzzles.json", "w", encoding="utf-8") as f:
            json.dump(puzzles, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": f"تم حفظ {len(puzzles)} لغزاً بنجاح", "count": len(puzzles)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"فشل حفظ الألغاز: {str(e)}")


# ----------------- مسار جلب أسئلة الاختبار للدرس -----------------
@app.get("/api/lessons/{lesson_id}/quiz")
def get_lesson_quiz(lesson_id: int, db: Session = Depends(get_db)):
    """جلب أسئلة الاختبار السريع لدرس معين"""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="الدرس غير موجود")
    
    questions = []
    if lesson.quiz_data:
        try:
            questions = json.loads(lesson.quiz_data)
        except (json.JSONDecodeError, TypeError):
            questions = []
    
    return {"questions": questions, "lesson_id": lesson_id, "title": lesson.title}


@app.get("/api/admin/analytics")
def admin_analytics(
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin)
):
    """
    إرجاع إحصائيات سريعة للوحة التحكم:
    - عدد الطلاب المسجلين
    - عدد المسؤولين
    - قائمة الدروس الأكثر قراءة (مرتبة تنازلياً)
    
    يستخدم GROUP BY و COUNT لحساب عدد القراءات لكل درس.
    """
    # عدد الطلاب المسجلين
    total_students = db.query(func.count(models.User.id)).filter(
        models.User.role == "student"
    ).scalar() or 0
    
    # عدد المسؤولين
    total_admins = db.query(func.count(models.User.id)).filter(
        models.User.role == "admin"
    ).scalar() or 0
    
    # الدروس الأكثر قراءة: GROUP BY lesson_id مع COUNT
    top_lessons_query = (
        db.query(
            models.UserLessonRead.lesson_id,
            func.count(models.UserLessonRead.id).label("read_count")
        )
        .group_by(models.UserLessonRead.lesson_id)
        .order_by(func.count(models.UserLessonRead.id).desc())
        .limit(20)
        .all()
    )
    
    # بناء قائمة الدروس الأكثر قراءة مع أسمائها
    top_lessons = []
    for lesson_id, read_count in top_lessons_query:
        lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
        if lesson:
            # جلب اسم الوحدة والفصل والمادة والصف للعرض الكامل
            unit = db.query(models.Unit).filter(models.Unit.id == lesson.unit_id).first()
            breadcrumb = lesson.title
            if unit:
                semester = db.query(models.Semester).filter(models.Semester.id == unit.semester_id).first()
                if semester:
                    subject = db.query(models.Subject).filter(models.Subject.id == semester.subject_id).first()
                    if subject:
                        breadcrumb = f"{subject.name} › {lesson.title}"
            
            top_lessons.append({
                "lesson_id": lesson_id,
                "title": lesson.title,
                "breadcrumb": breadcrumb,
                "read_count": read_count
            })
    
    return {
        "total_students": total_students,
        "total_admins": total_admins,
        "top_lessons": top_lessons,
        "total_lessons": db.query(func.count(models.Lesson.id)).scalar() or 0,
        "total_reads": db.query(func.count(models.UserLessonRead.id)).scalar() or 0
    }


# ----------------- مسارات إدارة المستخدمين (Admin) -----------------
@app.get("/api/admin/users")
def admin_get_users(db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    """جلب جميع المستخدمين (للإدارة)"""
    users = db.query(models.User).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "birth_date": u.birth_date or "",
            }
            for u in users
        ]
    }

@app.put("/api/admin/users/{user_id}")
def admin_update_user(user_id: int, payload: dict, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    """تعديل صلاحية أو اسم مستخدم"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if "role" in payload:
        if payload["role"] not in ("student", "admin"):
            raise HTTPException(status_code=400, detail="الصلاحية غير صالحة")
        user.role = payload["role"]
    if "first_name" in payload:
        user.first_name = payload["first_name"]
    if "last_name" in payload:
        user.last_name = payload["last_name"]
    db.commit()
    return {"status": "success", "message": "تم تحديث المستخدم بنجاح"}

@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    """حذف مستخدم"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="لا يمكنك حذف حسابك بنفسك")
    db.delete(user)
    db.commit()
    return {"status": "success", "message": "تم حذف المستخدم بنجاح"}

@app.put("/api/admin/users/{user_id}/password")
def admin_change_user_password(user_id: int, payload: dict, db: Session = Depends(get_db), admin: models.User = Depends(require_admin)):
    """تغيير كلمة سر مستخدم"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    new_password = payload.get("new_password", "")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    user.password_hash = get_password_hash(new_password)
    db.commit()
    return {"status": "success", "message": "تم تغيير كلمة المرور بنجاح"}


# ----------------- دالة تغذية قاعدة البيانات المبدئية -----------------
def seed_database(db: Session):
    """تعبئة قاعدة البيانات من ملف curriculum.json عند أول تشغيل"""
    try:
        with open("data/curriculum.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            
        for g_data in data.get("grades", []):
            grade = models.Grade(name=g_data.get("name"), icon=g_data.get("icon"))
            db.add(grade)
            db.commit()
            db.refresh(grade)
            
            for s_data in g_data.get("subjects", []):
                subject = models.Subject(name=s_data.get("name"), icon=s_data.get("icon"), book_url=s_data.get("bookUrl"), grade_id=grade.id)
                db.add(subject)
                db.commit()
                db.refresh(subject)
                
                for sem_data in s_data.get("semesters", []):
                    semester = models.Semester(name=sem_data.get("name"), book_url=sem_data.get("bookUrl"), subject_id=subject.id)
                    db.add(semester)
                    db.commit()
                    db.refresh(semester)
                    
                    for u_data in sem_data.get("units", []):
                        unit = models.Unit(name=u_data.get("name"), semester_id=semester.id)
                        db.add(unit)
                        db.commit()
                        db.refresh(unit)
                        
                        for l_data in u_data.get("lessons", []):
                            # لجعل بعض الدروس خاصة لأغراض الاختبار
                            is_private = True if "2" in str(l_data.get("id", "")) else False
                            
                            lesson = models.Lesson(title=l_data.get("title"), unit_id=unit.id, is_private=is_private)
                            db.add(lesson)
                            db.commit()
                            db.refresh(lesson)
                            
                            # حفظ بيانات الأسئلة (Quiz)
                            quiz = l_data.get("quiz", [])
                            if quiz:
                                lesson.quiz_data = json.dumps(quiz, ensure_ascii=False)
                                db.commit()
                            
                            # إضافة المصادر المتعددة
                            if l_data.get("videoUrl"):
                                db.add(models.LessonResource(lesson_id=lesson.id, type="video", url=l_data.get("videoUrl"), title="شرح مرئي"))
                            if l_data.get("summaryUrl"):
                                db.add(models.LessonResource(lesson_id=lesson.id, type="pdf", url=l_data.get("summaryUrl"), title="ملخص الدرس"))
                            if l_data.get("pastExamsUrl"):
                                db.add(models.LessonResource(lesson_id=lesson.id, type="pdf", url=l_data.get("pastExamsUrl"), title="أسئلة سنوات سابقة"))
                            
                            db.commit()
    except Exception as e:
        print("Error seeding database:", e)
        db.rollback()

# ----------------- ربط الملفات الثابتة والـ SPA -----------------

# ربط مجلدات الواجهة الأمامية
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")
app.mount("/data", StaticFiles(directory="data"), name="data")

# إذا كان المجلد Books موجوداً
if os.path.exists("Books"):
    app.mount("/Books", StaticFiles(directory="Books"), name="Books")

# تقديم صفحة الأدمن
@app.get("/admin")
def serve_admin():
    """تقديم صفحة لوحة التحكم للمسؤولين"""
    return FileResponse("admin.html")

# تقديم ملف index.html للمسار الرئيسي
@app.get("/")
def serve_spa():
    return FileResponse("index.html")
