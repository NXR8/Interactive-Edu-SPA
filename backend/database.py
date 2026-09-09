from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# مسار قاعدة البيانات الخاصة بنا (SQLite)
# سيتم إنشاء ملف edursc.db في نفس مسار تشغيل التطبيق
SQLALCHEMY_DATABASE_URL = "sqlite:///./edursc.db"

# إعداد محرك قاعدة البيانات
# connect_args={"check_same_thread": False} ضروري فقط في SQLite مع FastAPI
# للسماح لأكثر من طلب بالوصول لقاعدة البيانات في نفس الوقت
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# إعداد جلسة الاتصال بقاعدة البيانات
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# الفئة الأساسية (Base) التي سترث منها جميع الجداول (Models)
Base = declarative_base()

# دالة للحصول على جلسة قاعدة البيانات واستخدامها في الـ Endpoints
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
