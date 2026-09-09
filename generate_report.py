#!/usr/bin/env python3
"""تقرير PDF أكاديمي من صفحتين - المنصة التعليمية التفاعلية"""

import os, arabic_reshaper
from bidi.algorithm import get_display
from fpdf import FPDF

def ar(text):
    if not text: return text
    return get_display(arabic_reshaper.reshape(text))

pdf = FPDF('P', 'mm', 'A4')
pdf.set_auto_page_break(auto=True, margin=20)
pdf.alias_nb_pages()

mstt = "/usr/share/fonts/truetype/msttcorefonts"
pdf.add_font("T", "", os.path.join(mstt, "times.ttf"))
pdf.add_font("T", "B", os.path.join(mstt, "timesbd.ttf"))
pdf.add_font("T", "I", os.path.join(mstt, "timesi.ttf"))
pdf.add_font("M", "", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")

def tx(txt, s=12, b=False, a="R"):
    pdf.set_font("T", "B" if b else "", s)
    pdf.set_text_color(0,0,0)
    # Using larger line spacing for academic look
    pdf.multi_cell(0, s*0.7, ar(txt), align=a)
    pdf.ln(2)

def sep():
    pdf.set_draw_color(0,0,0)
    pdf.set_line_width(0.4)
    y = pdf.get_y()
    pdf.line(10, y, 200, y)
    pdf.ln(4)

pdf.add_page()

# العنوان
pdf.ln(5)
pdf.set_font("T", "B", 20)
pdf.set_text_color(0,0,0)
pdf.cell(0, 10, ar("المنصة التعليمية التفاعلية"), align="C", new_x="LMARGIN", new_y="NEXT")
pdf.cell(0, 8, ar("تقرير المشروع الأكاديمي"), align="C", new_x="LMARGIN", new_y="NEXT")
pdf.ln(4)
pdf.set_font("T", "I", 11)
pdf.cell(0, 6, "Interactive Education SPA Platform", align="C", new_x="LMARGIN", new_y="NEXT")
sep()

# 1
tx("1. ملخص المشروع", 16, True)
tx("يستعرض هذا التقرير تصميم وتطوير المنصة التعليمية التفاعلية، وهي تطبيق ويب أحادي الصفحة (SPA) يهدف لتوفير بيئة تعليمية متكاملة. يدمج النظام المحتوى الأكاديمي (فيديوهات، ملفات PDF، اختبارات) وأدوات تفاعلية متقدمة مثل الآلة الحاسبة العلمية وأداة حل المعادلات.", 14)
pdf.ln(2)

# 2
tx("2. أهداف المشروع", 16, True)
tx("- مركزية الموارد: توفير واجهة موحدة للوصول السهل للمناهج الدراسية، الكتب، المرئيات، والاختبارات.", 14)
tx("- التعلم التفاعلي: دمج أدوات رياضية متقدمة وألغاز يومية لتحفيز التفكير المنطقي والنقدي.", 14)
tx("- الإدارة المرنة: تقديم لوحة تحكم (Admin Dashboard) تتيح إدارة الشجرة التعليمية والمستخدمين بسهولة.", 14)
tx("- الخصوصية والأمان: بناء نظام مصادقة قوي لحماية المحتويات الخاصة وضمان أمان بيانات المستخدمين.", 14)
pdf.ln(2)

# 3
tx("3. التقنيات والمنهجية المستخدمة", 16, True)
tx("تم بناء النظام وفق معمارية (Client-Server) الحديثة لضمان الفصل التام بين العرض ومنطق العمل:", 14)
tx("الواجهة الأمامية (Front-end):", 14, True)
tx(" - تقنيات HTML5 و CSS3 لتصميم عصري متجاوب يدعم اللغة العربية (RTL).", 14)
tx(" - استخدام JavaScript (Vanilla) لإدارة حالة التطبيق والتنقل دون إعادة تحميل الصفحة.", 14)
tx(" - دمج مكتبة Nerdamer.js لمعالجة العمليات الجبرية وحل المعادلات رمزياً بكفاءة.", 14)
tx("الواجهة الخلفية (Back-end) وقاعدة البيانات:", 14, True)
tx(" - إطار عمل Python FastAPI المتقدم لبناء واجهات برمجة تطبيقات (REST APIs) سريعة وغير متزامنة.", 14)
tx(" - قاعدة بيانات SQLite خفيفة وفعالة لتخزين المناهج وحسابات المستخدمين والاختبارات بطريقة منظمة.", 14)
tx(" - نظام مصادقة قائم على JSON Web Tokens (JWT) مع حماية متقدمة ضد هجمات الويب (Rate Limiting).", 14)
pdf.ln(2)

# 4
tx("4. الميزات الهيكلية والوظيفية", 16, True)
tx("- شجرة منهج ديناميكية: بنية هرمية متسلسلة (صفوف > مواد > فصول > وحدات > دروس) لتصفح سريع.", 14)
tx("- عارض محتوى متقدم: دعم شامل لتضمين فيديوهات يوتيوب، مستندات PDF، والروابط الخارجية.", 14)
tx("- محرك الاختبارات والألغاز: نظام تقييم فوري لمستوى الطالب، ولغز يومي ديناميكي لتعزيز المشاركة.", 14)
tx("- لوحة تحكم الإدارة: إدارة كاملة (CRUD) لبيانات المنصة مع إحصائيات مباشرة عن تفاعل المستخدمين.", 14)
pdf.ln(5)
sep()

# 5
tx("5. الخاتمة والرؤية المستقبلية", 16, True)
tx("يمثل هذا المشروع بيئة تعليمية حديثة، سريعة، ومتكاملة تواكب متطلبات العصر الرقمي الحديث. يشمل التوجه المستقبلي للمنصة دمج وتوظيف تقنيات الذكاء الاصطناعي (AI) لخلق مسارات تعليمية مخصصة، وتوليد أسئلة واختبارات ذكية تتكيف مع مستوى وقدرات الطلاب الفردية بشكل مستدام.", 14)

out = "/media/Storage/NXR8_Project/MMWEB/Interactive-Edu-SPA/report.pdf"
pdf.output(out)
print("تم توليد التقرير بنجاح وحفظه في:", out)
