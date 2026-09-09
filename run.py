import uvicorn

# هذا السكريبت لتسهيل تشغيل المشروع بأمر واحد:
# python3 run.py

if __name__ == "__main__":
    # تشغيل تطبيق FastAPI من مسار backend.main:app
    # reload=True مفيد أثناء التطوير لإعادة تشغيل السيرفر تلقائياً عند أي تعديل في الكود
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8899, reload=True)
