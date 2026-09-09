import sys
import getpass
from backend.database import SessionLocal
from backend.models import User
from backend.main import get_password_hash

def make_admin(username):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.role = "admin"
            db.commit()
            print(f"✅ تم تحويل المستخدم '{username}' الحالي إلى مسؤول (Admin) بنجاح!")
        else:
            print(f"المستخدم '{username}' غير موجود في قاعدة البيانات.")
            choice = input("هل ترغب في إنشاء حساب جديد بهذا الاسم كأدمن؟ (y/n): ")
            if choice.lower() == 'y':
                password = getpass.getpass(f"أدخل كلمة المرور الجديدة للحساب '{username}': ")
                hashed_pw = get_password_hash(password)
                new_user = User(username=username, password_hash=hashed_pw, role="admin")
                db.add(new_user)
                db.commit()
                print(f"✅ تم إنشاء حساب الأدمن '{username}' بنجاح!")
            else:
                print("❌ تم الإلغاء.")
    except Exception as e:
        print(f"حدث خطأ: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("الاستخدام: python3 make_admin.py <username>")
        sys.exit(1)
        
    target_username = sys.argv[1]
    make_admin(target_username)
