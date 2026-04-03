/* =============================================
   app.js — نقطة الدخول الرئيسية للتطبيق
   =============================================
   هذا الملف هو المنسّق المركزي (Orchestrator) الذي:
   - يُحمّل بيانات المنهج من ملف JSON عبر Fetch API
   - يستدعي وحدة التحكم بالواجهة (UIController) لبناء القائمة الجانبية
   - يُعالج أخطاء التحميل ويعرض رسائل مناسبة
   
   التبعيات: يعتمد على js/uiController.js (يجب تحميله قبل هذا الملف)
   ============================================= */

;(function () {
  'use strict';

  /* ------------------------------------------
     إعدادات التطبيق
     ------------------------------------------ */
  var CONFIG = {
    // مسار ملف بيانات المنهج
    curriculumPath: 'data/curriculum.json',
    // مسار ملف الألغاز (سيُستخدم لاحقاً)
    puzzlesPath: 'data/puzzles.json',
  };

  /* ------------------------------------------
     جلب البيانات من ملفات JSON
     ------------------------------------------ */

  /**
   * جلب بيانات المنهج من ملف curriculum.json
   * يستخدم Fetch API لتحميل الملف بشكل غير متزامن (Asynchronous)
   * 
   * @returns {Promise<Object>} وعد بكائن البيانات
   */
  function fetchCurriculum() {
    return fetch(CONFIG.curriculumPath)
      .then(function (response) {
        // التحقق من نجاح الاستجابة
        if (!response.ok) {
          throw new Error('فشل تحميل بيانات المنهج. كود الاستجابة: ' + response.status);
        }
        return response.json();
      });
  }

  /* ------------------------------------------
     تهيئة التطبيق
     ------------------------------------------ */

  /**
   * الدالة الرئيسية لتهيئة التطبيق
   * 
   * الخطوات:
   * 1. محاولة جلب بيانات المنهج من JSON عبر Fetch API
   * 2. إذا فشل الجلب (مثل بيئة file://): استخدام البيانات المضمّنة من curriculumData.js
   * 3. بناء القائمة الجانبية عبر UIController
   * 4. عرض شاشة الترحيب في منطقة المحتوى
   */
  function init() {
    // التحقق من وجود وحدة UIController
    if (typeof window.UIController === 'undefined') {
      console.error('خطأ: وحدة UIController غير محمّلة. تأكد من ترتيب ملفات JavaScript.');
      return;
    }

    // عرض لغز اليوم
    if (window.DailyPuzzle) {
      window.DailyPuzzle.displayDailyPuzzle();
    }

    // محاولة جلب البيانات من ملف JSON أولاً
    fetchCurriculum()
      .then(function (data) {
        // نجح التحميل عبر Fetch API (بيئة خادم)
        loadMenu(data, 'Fetch API');
      })
      .catch(function (fetchError) {
        // فشل الجلب - نحاول استخدام البيانات المضمّنة كحل بديل
        console.warn('⚠️ فشل Fetch API:', fetchError.message);
        console.log('🔄 جاري استخدام البيانات المضمّنة (Fallback)...');

        if (typeof window.CURRICULUM_DATA !== 'undefined') {
          // البيانات المضمّنة متوفرة - نستخدمها
          loadMenu(window.CURRICULUM_DATA, 'Embedded Data');
        } else {
          // لا توجد بيانات بديلة - عرض رسالة خطأ
          console.error('❌ لا تتوفر بيانات المنهج.');
          showLoadError(fetchError.message);
        }
      });
  }

  /**
   * تحميل القائمة الجانبية من البيانات
   * @param {Object} data - بيانات المنهج
   * @param {string} source - مصدر البيانات (للتشخيص)
   */
  function loadMenu(data, source) {
    window.UIController.buildNavigationMenu(data);
    console.log('✅ تم تحميل المنهج بنجاح عبر ' + source + ':', data.grades.length, 'صف/صفوف');
  }

  /* ------------------------------------------
     عرض رسالة خطأ التحميل
     ------------------------------------------ */

  /**
   * عرض رسالة خطأ أنيقة في القائمة الجانبية إذا فشل تحميل البيانات
   * @param {string} message - نص رسالة الخطأ
   */
  function showLoadError(message) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // مسح المحتوى المؤقت
    var placeholder = sidebar.querySelector('.sidebar__placeholder');
    if (placeholder) placeholder.remove();

    // إنشاء رسالة الخطأ
    var errorDiv = document.createElement('div');
    errorDiv.className = 'sidebar__error';
    errorDiv.innerHTML =
      '<span class="sidebar__error-icon">⚠️</span>' +
      '<p class="sidebar__error-text">تعذّر تحميل بيانات المنهج</p>' +
      '<p class="sidebar__error-detail">' + message + '</p>' +
      '<button class="sidebar__error-retry" onclick="location.reload()">🔄 إعادة المحاولة</button>';

    sidebar.appendChild(errorDiv);
  }

  /* ------------------------------------------
     انتظار تحميل DOM ثم بدء التهيئة
     ------------------------------------------ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
