from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

# استيراد Base من ملف إعداد قاعدة البيانات
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    first_name = Column(String)
    last_name = Column(String)
    birth_date = Column(String, nullable=True)
    password_hash = Column(String)
    role = Column(String, default="student") # admin أو student

    # علاقة مع جدول القراءات
    lesson_reads = relationship("UserLessonRead", back_populates="user")

class Grade(Base):
    """جدول الصفوف الدراسية (مثال: الصف الأول الثانوي)"""
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    icon = Column(String, nullable=True)

    # علاقة مع المواد: الصف الواحد يحتوي على عدة مواد
    subjects = relationship("Subject", back_populates="grade", cascade="all, delete-orphan")

class Subject(Base):
    """جدول المواد الدراسية (مثال: فيزياء)"""
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    icon = Column(String, nullable=True)
    book_url = Column(String, nullable=True)
    grade_id = Column(Integer, ForeignKey("grades.id"))

    grade = relationship("Grade", back_populates="subjects")
    semesters = relationship("Semester", back_populates="subject", cascade="all, delete-orphan")

class Semester(Base):
    """جدول الفصول الدراسية (مثال: الفصل الدراسي الأول)"""
    __tablename__ = "semesters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    book_url = Column(String, nullable=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"))

    subject = relationship("Subject", back_populates="semesters")
    units = relationship("Unit", back_populates="semester", cascade="all, delete-orphan")

class Unit(Base):
    """جدول الوحدات الدراسية"""
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    semester_id = Column(Integer, ForeignKey("semesters.id"))

    semester = relationship("Semester", back_populates="units")
    lessons = relationship("Lesson", back_populates="unit", cascade="all, delete-orphan")

class Lesson(Base):
    """جدول الدروس ويحتوي على الروابط والتفاصيل"""
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"))
    
    # تحديد ما إذا كان الدرس خاص (يتطلب تسجيل دخول أو صلاحيات)
    is_private = Column(Boolean, default=False)
    
    # تخزين بيانات الأسئلة (Quiz) بصيغة JSON
    quiz_data = Column(String, nullable=True)

    unit = relationship("Unit", back_populates="lessons")
    # علاقة مع المصادر المتعددة
    resources = relationship("LessonResource", back_populates="lesson", cascade="all, delete-orphan")
    # علاقة مع جدول القراءات لمعرفة من قرأ هذا الدرس
    user_reads = relationship("UserLessonRead", back_populates="lesson", cascade="all, delete-orphan")

class LessonResource(Base):
    """جدول المصادر المتعددة للدرس"""
    __tablename__ = "lesson_resources"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    type = Column(String, index=True) # video, pdf, link, quiz
    url = Column(String)
    title = Column(String, nullable=True)

    lesson = relationship("Lesson", back_populates="resources")

class UserLessonRead(Base):
    """جدول وسيط لتتبع إحصائيات القراءة لكل مستخدم لكل درس"""
    __tablename__ = "user_lesson_reads"

    # استخدام المفاتيح المركبة غير ضروري هنا لوجود id منفصل، لكن سنربطهم كـ ForeignKeys
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    
    is_read = Column(Boolean, default=False)
    # وقت تسجيل القراءة
    timestamp = Column(DateTime, default=datetime.utcnow)

    # العلاقات للوصول للمستخدم والدرس مباشرة
    user = relationship("User", back_populates="lesson_reads")
    lesson = relationship("Lesson", back_populates="user_reads")
