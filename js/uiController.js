/* =============================================
   uiController.js — التحكم بواجهة المستخدم
   =============================================
   هذا الملف مسؤول عن:
   - بناء القائمة الجانبية المنسدلة (Accordion) ديناميكياً من بيانات JSON
   - إدارة فتح/إغلاق عناصر الـ Accordion
   - عرض المحتوى (فيديو، PDF، اختبار) في منطقة المنتصف
   - التعامل مع أحداث النقر على الدروس
   
   هيكل الشجرة: صف -> مادة -> فصل -> وحدة -> درس
   ============================================= */

;(function () {
  'use strict';

  /* ------------------------------------------
     تصدير الوحدة للاستخدام من app.js
     ------------------------------------------ */
  window.UIController = {
    buildNavigationMenu: buildNavigationMenu,
    showContent: showContent,
    showWelcome: showWelcome,
  };

  /* ------------------------------------------
     عناصر DOM المرجعية
     ------------------------------------------ */
  const sidebar = document.getElementById('sidebar');
  const contentArea = document.getElementById('content-area');
  const hamburgerBtn = document.getElementById('hamburger-btn');

  // إنشاء واضافة خلفية داكنة (Overlay) للجوال
  let sidebarOverlay = document.createElement('div');
  sidebarOverlay.className = 'sidebar-overlay';
  document.body.appendChild(sidebarOverlay);

  // دالة لإغلاق القائمة بصرف النظر عن طريقة الإغلاق
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('sidebar--open');
    if (sidebarOverlay) sidebarOverlay.classList.remove('active');
  }

  // إضافة Event Listener لزر الهامبرجر
  if (hamburgerBtn && sidebar) {
    hamburgerBtn.addEventListener('click', function () {
      const isOpen = sidebar.classList.contains('sidebar--open');
      if (isOpen) {
        closeSidebar();
      } else {
        sidebar.classList.add('sidebar--open');
        sidebarOverlay.classList.add('active');
      }
    });
  }

  // إضافة Event Listener لإغلاق القائمة عند النقر على الشفافية
  sidebarOverlay.addEventListener('click', closeSidebar);

  /* ------------------------------------------
     بناء القائمة الجانبية المنسدلة (Accordion)
     ------------------------------------------ */

  /**
   * الدالة الرئيسية: تأخذ بيانات المنهج وتبني شجرة التنقل بالكامل
   * 
   * @param {Object} data - بيانات المنهج من curriculum.json
   * 
   * الهيكل المُولّد:
   * sidebar
   *  └── nav.nav-tree
   *       └── .accordion-group (لكل صف)
   *            ├── .accordion-header (عنوان الصف)
   *            └── .accordion-body
   *                 └── .accordion-group (لكل مادة)
   *                      ├── .accordion-header (عنوان المادة + زر الكتاب)
   *                      └── .accordion-body
   *                           └── .accordion-group (لكل فصل)
   *                                └── ... (وحدات -> دروس)
   */
  function buildNavigationMenu(data) {
    if (!sidebar || !data || !data.grades) return;

    // مسح المحتوى المؤقت الموجود (الـ placeholder)
    const placeholder = sidebar.querySelector('.sidebar__placeholder');
    if (placeholder) placeholder.remove();

    // إنشاء حاوية التنقل الرئيسية
    const nav = document.createElement('nav');
    nav.className = 'nav-tree';
    nav.setAttribute('aria-label', 'شجرة المواد الدراسية');

    // بناء شجرة الصفوف
    data.grades.forEach(function (grade) {
      const gradeGroup = createAccordionGroup({
        title: grade.name,
        icon: grade.icon || '🎒',
        level: 'grade',
        id: grade.id,
      });

      const gradeBodyInner = gradeGroup.bodyInner;

      // بناء المواد داخل كل صف
      grade.subjects.forEach(function (subject) {
        const subjectGroup = createAccordionGroup({
          title: subject.name,
          icon: subject.icon || '📖',
          level: 'subject',
          id: subject.id,
          extra: subject.bookUrl ? createBookButton(subject.bookUrl) : null,
        });

        const subjectBodyInner = subjectGroup.bodyInner;

        // بناء الفصول الدراسية
        subject.semesters.forEach(function (semester) {
          const semesterGroup = createAccordionGroup({
            title: semester.name,
            icon: '📅',
            level: 'semester',
            id: semester.id,
          });

          const semesterBodyInner = semesterGroup.bodyInner;

          // بناء الوحدات
          semester.units.forEach(function (unit) {
            const unitGroup = createAccordionGroup({
              title: unit.name,
              icon: '📦',
              level: 'unit',
              id: unit.id,
            });

            const unitBodyInner = unitGroup.bodyInner;

            // بناء الدروس (المستوى الأخير - أوراق الشجرة)
            unit.lessons.forEach(function (lesson) {
              const lessonItem = createLessonItem(lesson);
              unitBodyInner.appendChild(lessonItem);
            });

            semesterBodyInner.appendChild(unitGroup);
          });

          subjectBodyInner.appendChild(semesterGroup);
        });

        gradeBodyInner.appendChild(subjectGroup);
      });

      nav.appendChild(gradeGroup);
    });

    sidebar.appendChild(nav);
  }

  /* ------------------------------------------
     إنشاء مجموعة Accordion واحدة
     ------------------------------------------ */

  /**
   * إنشاء عنصر Accordion قابل للطي/الفتح
   * 
   * @param {Object} options - خيارات المجموعة
   * @param {string} options.title - عنوان المجموعة
   * @param {string} options.icon - أيقونة المجموعة
   * @param {string} options.level - مستوى المجموعة (grade/subject/semester/unit)
   * @param {string} options.id - معرّف فريد
   * @param {HTMLElement} [options.extra] - عنصر إضافي (مثل زر الكتاب)
   * @returns {HTMLElement} عنصر المجموعة المُنشأ
   */
  function createAccordionGroup(options) {
    // حاوية المجموعة
    const group = document.createElement('div');
    group.className = 'accordion-group accordion-group--' + options.level;
    group.dataset.id = options.id;

    // رأس المجموعة (قابل للنقر)
    const header = document.createElement('button');
    header.className = 'accordion-header accordion-header--' + options.level;
    header.setAttribute('type', 'button');
    header.setAttribute('aria-expanded', 'false');

    // أيقونة السهم (مؤشر الفتح/الإغلاق)
    const arrow = document.createElement('span');
    arrow.className = 'accordion-arrow';
    arrow.innerHTML = '‹'; // سهم يدور عند الفتح

    // أيقونة العنصر
    const icon = document.createElement('span');
    icon.className = 'accordion-icon';
    icon.textContent = options.icon;

    // نص العنوان
    const title = document.createElement('span');
    title.className = 'accordion-title';
    title.textContent = options.title;

    header.appendChild(arrow);
    header.appendChild(icon);
    header.appendChild(title);

    // إضافة عنصر إضافي إن وُجد (مثل زر الكتاب)
    if (options.extra) {
      header.appendChild(options.extra);
    }

    // جسم المجموعة (المحتوى القابل للطي)
    const body = document.createElement('div');
    body.className = 'accordion-body';
    
    // الغلاف الداخلي المطلوب لتأثير شبكة CSS (CSS Grid animation trick)
    const bodyInner = document.createElement('div');
    bodyInner.className = 'accordion-body-inner';
    body.appendChild(bodyInner);

    // ربط حدث النقر لفتح/إغلاق المجموعة
    header.addEventListener('click', function (e) {
      // منع النقر على الأزرار الداخلية (مثل زر الكتاب) من تفعيل الـ Accordion
      if (e.target.closest('.accordion-extra-btn')) return;
      toggleAccordion(group);
    });

    group.appendChild(header);
    group.appendChild(body);
    
    // ملاحظة: نحتفظ بمرجع للغلاف الداخلي لاحقاً لإضافة العناصر الفرعية فيه بدلاً من جسم المجموعة نفسه
    group.bodyInner = bodyInner;

    return group;
  }

  /* ------------------------------------------
     إنشاء عنصر درس (ورقة الشجرة)
     ------------------------------------------ */

  /**
   * إنشاء عنصر درس واحد مع أزرار الإجراءات (فيديو، ملخص، اختبار)
   * 
   * @param {Object} lesson - بيانات الدرس من JSON
   * @returns {HTMLElement} عنصر الدرس المُنشأ
   */
  function createLessonItem(lesson) {
    const item = document.createElement('div');
    item.className = 'lesson-item';
    item.dataset.lessonId = lesson.id;

    // عنوان الدرس
    const titleRow = document.createElement('div');
    titleRow.className = 'lesson-item__title';

    const dot = document.createElement('span');
    dot.className = 'lesson-item__dot';

    const titleText = document.createElement('span');
    titleText.textContent = lesson.title;

    titleRow.appendChild(dot);
    titleRow.appendChild(titleText);
    item.appendChild(titleRow);

    // أزرار الإجراءات (فيديو، ملخص، سنوات سابقة، اختبار)
    const actions = document.createElement('div');
    actions.className = 'lesson-item__actions';

    // زر الفيديو
    if (lesson.videoUrl) {
      actions.appendChild(createActionButton('🎬', 'شرح الدرس', function () {
        showContent('video', {
          title: lesson.title,
          url: lesson.videoUrl,
        });
      }));
    }

    // زر الملخص (PDF)
    if (lesson.summaryUrl) {
      actions.appendChild(createActionButton('📄', 'ملخص', function () {
        showContent('pdf', {
          title: 'ملخص: ' + lesson.title,
          url: lesson.summaryUrl,
        });
      }));
    }

    // زر أسئلة السنوات السابقة
    if (lesson.pastExamsUrl) {
      actions.appendChild(createActionButton('📝', 'سنوات سابقة', function () {
        showContent('pdf', {
          title: 'أسئلة سنوات: ' + lesson.title,
          url: lesson.pastExamsUrl,
        });
      }));
    }

    // زر الاختبار السريع
    if (lesson.quiz && lesson.quiz.length > 0) {
      actions.appendChild(createActionButton('✅', 'اختبار سريع', function () {
        showContent('quiz', {
          title: 'اختبار: ' + lesson.title,
          questions: lesson.quiz,
        });
      }));
    }

    item.appendChild(actions);

    return item;
  }

  /* ------------------------------------------
     أزرار مساعدة
     ------------------------------------------ */

  /**
   * إنشاء زر إجراء صغير (للدروس)
   * @param {string} icon - أيقونة الزر
   * @param {string} label - نص الزر
   * @param {Function} onClick - دالة عند النقر
   * @returns {HTMLElement} عنصر الزر
   */
  function createActionButton(icon, label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'lesson-action-btn';
    btn.innerHTML = '<span class="lesson-action-btn__icon">' + icon + '</span>' +
                    '<span class="lesson-action-btn__label">' + label + '</span>';
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * إنشاء زر تحميل الكتاب (يظهر بجانب اسم المادة)
   * @param {string} url - رابط الكتاب PDF
   * @returns {HTMLElement} عنصر الزر
   */
  function createBookButton(url) {
    const btn = document.createElement('a');
    btn.className = 'accordion-extra-btn';
    btn.href = url;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.title = 'تحميل الكتاب';
    btn.textContent = '📕';
    // منع فقاعة الحدث (Bubble) حتى لا يفتح الـ Accordion عند النقر
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    return btn;
  }

  /* ------------------------------------------
     منطق فتح/إغلاق الـ Accordion
     ------------------------------------------ */

  /**
   * تبديل حالة مجموعة Accordion (فتح ↔ إغلاق)
   */
  function toggleAccordion(group) {
    const header = group.querySelector(':scope > .accordion-header');
    const isOpen = group.classList.contains('accordion-group--open');

    if (isOpen) {
      // إغلاق المجموعة
      group.classList.remove('accordion-group--open');
      header.setAttribute('aria-expanded', 'false');
    } else {
      // إغلاق المجموعات الأخرى على نفس المستوى (سلوك Accordion)
      const parentBody = group.closest('.accordion-body-inner') || group.parentElement;
      if (parentBody) {
        var siblings = parentBody.querySelectorAll(':scope > .accordion-group--open');
        siblings.forEach(function (sibling) {
          if (sibling !== group) {
            sibling.classList.remove('accordion-group--open');
            var sibHeader = sibling.querySelector(':scope > .accordion-header');
            if (sibHeader) sibHeader.setAttribute('aria-expanded', 'false');
          }
        });
      }

      // فتح المجموعة الحالية
      group.classList.add('accordion-group--open');
      header.setAttribute('aria-expanded', 'true');
    }
  }

  /* ------------------------------------------
     عرض المحتوى في المنطقة الوسطى
     ------------------------------------------ */

  /**
   * عرض محتوى في منطقة العرض الوسطى بناءً على النوع
   * 
   * @param {string} type - نوع المحتوى ('video', 'pdf', 'quiz')
   * @param {Object} data - بيانات المحتوى
   */
  function showContent(type, data) {
    if (!contentArea) return;

    // مسح المحتوى السابق
    contentArea.innerHTML = '';

    // إنشاء شريط العنوان
    var titleBar = document.createElement('div');
    titleBar.className = 'content-titlebar';

    var backBtn = document.createElement('button');
    backBtn.className = 'content-back-btn';
    backBtn.textContent = '→ عودة';
    backBtn.addEventListener('click', showWelcome);

    var titleText = document.createElement('h2');
    titleText.className = 'content-titlebar__text';
    titleText.textContent = data.title || '';

    titleBar.appendChild(backBtn);
    titleBar.appendChild(titleText);
    contentArea.appendChild(titleBar);

    // عرض المحتوى حسب النوع
    switch (type) {
      case 'video':
        renderVideo(data);
        break;
      case 'pdf':
        renderPDF(data);
        break;
      case 'quiz':
        renderQuizPlaceholder(data);
        break;
      default:
        showWelcome();
    }
  }

  /**
   * عرض فيديو يوتيوب في iframe
   * @param {Object} data - يحتوي url و title
   */
  function renderVideo(data) {
    var container = document.createElement('div');
    container.className = 'content-video';

    var finalUrl = data.url;
    // تحويل روابط يوتيوب العادية إلى روابط التضمين (Embed) لكي تعمل داخل الـ iframe
    if (finalUrl.includes('youtube.com/watch')) {
      var videoId = new URL(finalUrl).searchParams.get('v');
      if (videoId) {
        finalUrl = 'https://www.youtube.com/embed/' + videoId;
      }
    } else if (finalUrl.includes('youtu.be/')) {
      var idMatch = finalUrl.match(/youtu\.be\/([^?]+)/);
      if (idMatch && idMatch[1]) {
        finalUrl = 'https://www.youtube.com/embed/' + idMatch[1];
      }
    }

    var iframe = document.createElement('iframe');
    iframe.src = finalUrl;
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy');
    iframe.title = data.title || 'فيديو الدرس';

    container.appendChild(iframe);
    contentArea.appendChild(container);
  }

  /**
   * عرض ملف PDF في iframe
   * @param {Object} data - يحتوي url و title
   */
  function renderPDF(data) {
    var container = document.createElement('div');
    container.className = 'content-pdf';

    var finalUrl = data.url;
    // إذا كان الرابط خارجياً (http/https)، نستخدم عارض مستندات جوجل لتجنب مشكلة حظر الـ iframe (X-Frame-Options)
    if (finalUrl.startsWith('http')) {
      finalUrl = 'https://docs.google.com/viewer?url=' + encodeURIComponent(data.url) + '&embedded=true';
    }

    var iframe = document.createElement('iframe');
    iframe.src = finalUrl;
    iframe.title = data.title || 'مستند PDF';

    container.appendChild(iframe);
    contentArea.appendChild(container);
  }

  /**
   * بناء وعرض الاختبار السريع وإضافته لمحرك الاختبارات
   * @param {Object} data - يحتوي questions و title
   */
  function renderQuizPlaceholder(data) {
    if (window.QuizEngine) {
      window.QuizEngine.buildQuiz(data, contentArea);
    } else {
      var container = document.createElement('div');
      container.className = 'content-quiz-placeholder';
  
      container.innerHTML =
        '<div class="content-quiz-placeholder__icon">✅</div>' +
        '<h3>' + data.title + '</h3>' +
        '<p class="content-quiz-placeholder__note">محرك الاختبارات غير متوفر.</p>';
  
      contentArea.appendChild(container);
    }
  }

  /**
   * عرض شاشة الترحيب الافتراضية (عند عدم اختيار أي درس)
   */
  function showWelcome() {
    if (!contentArea) return;

    contentArea.innerHTML =
      '<div class="content-area__placeholder">' +
        '<span class="content-area__placeholder-icon">🎓</span>' +
        '<p class="content-area__placeholder-text">' +
          'منطقة المحتوى<br>' +
          'اختر مادة أو درساً من القائمة الجانبية لعرض المحتوى هنا' +
        '</p>' +
      '</div>';
  }

})();
