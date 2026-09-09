import re
from pydantic import BaseModel, validator, Field
from typing import List, Optional

# مخططات المصادقة (Auth)
class UserCreate(BaseModel):
    email: str = Field(max_length=254)
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    birth_date: str
    password: str
    password_confirm: str

    @validator('password')
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
        if not re.search(r'[A-Z]', v):
            raise ValueError('كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل')
        if not re.search(r'\d', v):
            raise ValueError('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل')
        return v

    @validator('password_confirm')
    def passwords_match(cls, v, values):
        if 'password' in values and v != values['password']:
            raise ValueError('كلمة المرور غير متطابقة')
        return v

    @validator('email')
    def email_valid(cls, v):
        if len(v) > 254:
            raise ValueError('البريد الإلكتروني طويل جداً')
        return v

class Token(BaseModel):
    access_token: str
    token_type: str

# مخططات المنهج (Curriculum)
class ResourceSchema(BaseModel):
    id: int
    type: str
    url: str
    title: Optional[str] = None

    class Config:
        from_attributes = True

class LessonSchema(BaseModel):
    id: int
    title: str
    is_private: bool
    resources: List[ResourceSchema] = []

    # سنقوم أيضاً بدعم أسئلة الاختبارات في المستقبل، مبدئياً سنجعلها خالية هنا
    quiz: List[dict] = []

    class Config:
        from_attributes = True

class UnitSchema(BaseModel):
    id: int
    name: str
    lessons: List[LessonSchema] = []

    class Config:
        from_attributes = True

class SemesterSchema(BaseModel):
    id: int
    name: str
    bookUrl: Optional[str] = Field(None, validation_alias='book_url')
    units: List[UnitSchema] = []

    class Config:
        from_attributes = True
        populate_by_name = True

class SubjectSchema(BaseModel):
    id: int
    name: str
    icon: Optional[str] = None
    bookUrl: Optional[str] = Field(None, validation_alias='book_url')
    semesters: List[SemesterSchema] = []

    class Config:
        from_attributes = True
        populate_by_name = True

class GradeSchema(BaseModel):
    id: int
    name: str
    icon: Optional[str] = None
    subjects: List[SubjectSchema] = []

    class Config:
        from_attributes = True

class CurriculumSchema(BaseModel):
    grades: List[GradeSchema] = []
