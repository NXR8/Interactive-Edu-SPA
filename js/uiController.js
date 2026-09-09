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

; (function () {
  'use strict';

  /* ------------------------------------------
     تصدير الوحدة للاستخدام من app.js
     ------------------------------------------ */
  window.UIController = {
    buildNavigationMenu: buildNavigationMenu,
    showContent: showContent,
    showWelcome: showWelcome,
    showAboutDeveloper: showAboutDeveloper
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
            bookUrl: semester.bookUrl,
            extra: semester.bookUrl ? createBookButton(semester.bookUrl) : null,
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

    // إضافة زر عن المطور أسفل القائمة
    let aboutBtn = sidebar.querySelector('.about-dev-btn');
    if (!aboutBtn) {
      const aboutContainer = document.createElement('div');
      aboutContainer.className = 'about-dev-container';

      aboutBtn = document.createElement('button');
      aboutBtn.className = 'about-dev-btn';
      aboutBtn.innerHTML = '<span class="about-dev-btn__icon">👩‍💻</span> <span class="about-dev-btn__text">عن المطور</span>';
      aboutBtn.addEventListener('click', showAboutDeveloper);

      aboutContainer.appendChild(aboutBtn);
      sidebar.appendChild(aboutContainer);
    }
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
    if (options.bookUrl) group.dataset.bookUrl = options.bookUrl;

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
    if (lesson.is_private) {
      titleText.innerHTML += ' <span style="font-size: 10px; color: #fdcb6e;">🔒</span>';
    }

    titleRow.appendChild(dot);
    titleRow.appendChild(titleText);
    item.appendChild(titleRow);

    // أزرار الإجراءات (فيديو، ملخص، سنوات سابقة، اختبار)
    const actions = document.createElement('div');
    actions.className = 'lesson-item__actions';

    // دالة مساعدة للتحقق من الصلاحيات وتسجيل القراءة
    function handleContentClick(type, data) {
      if (lesson.is_private && (!window.AppUser || !window.AppUser.token)) {
        if (window.showUnauthorizedModal) {
          window.showUnauthorizedModal();
        }
        return;
      }

      showContent(type, data);

      // إرسال إحصائية صامتة
      if (window.AppUser && window.AppUser.token) {
        fetch('/api/lessons/' + lesson.id + '/read', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + window.AppUser.token
          }
        }).catch(function (e) { console.error('Read stat error:', e); });
      }
    }

    // إضافة المصادر المتعددة (مع تجميع المصادر من نفس النوع)
    if (lesson.resources && lesson.resources.length > 0) {
      // تجميع حسب النوع
      var grouped = {};
      lesson.resources.forEach(function (res) {
        if (!grouped[res.type]) grouped[res.type] = [];
        grouped[res.type].push(res);
      });

      Object.keys(grouped).forEach(function (type) {
        var items = grouped[type];
        var icon = type === 'video' ? '🎬' : type === 'pdf' ? '📄' : '🔗';
        var typeLabel = type === 'video' ? 'فيديو' : type === 'pdf' ? 'ملخص' : 'رابط';

        if (items.length === 1) {
          var res = items[0];
          actions.appendChild(createActionButton(icon, res.title || typeLabel, function () {
            handleContentClick(res.type, {
              title: lesson.title + ' - ' + (res.title || ''),
              url: res.url,
            });
          }));
        } else {
          var groupDiv = document.createElement('div');
          groupDiv.className = 'resource-group';
          items.forEach(function (res, ri) {
            var label = res.title || (typeLabel + ' ' + (ri + 1));
            var btn = createActionButton(icon, label, function () {
              handleContentClick(res.type, {
                title: lesson.title + ' - ' + (res.title || label),
                url: res.url,
              });
            });
            groupDiv.appendChild(btn);
          });
          actions.appendChild(groupDiv);
        }
      });
    }

    // زر الاختبار السريع - جلب الأسئلة من قاعدة البيانات عبر API
    if (lesson.quiz && lesson.quiz.length > 0) {
      actions.appendChild(createActionButton('✅', 'اختبار سريع', function () {
        var quizBtn = this;
        quizBtn.disabled = true;
        quizBtn.innerHTML = '<span class="lesson-action-btn__icon">⏳</span><span class="lesson-action-btn__label">جاري التحميل...</span>';
        fetch('/api/lessons/' + lesson.id + '/quiz')
          .then(function (res) { return res.json(); })
          .then(function (data) {
            handleContentClick('quiz', {
              title: 'اختبار: ' + lesson.title,
              questions: data.questions || [],
            });
          })
          .catch(function () {
            // Fallback: استخدام الأسئلة المضمنة
            handleContentClick('quiz', {
              title: 'اختبار: ' + lesson.title,
              questions: lesson.quiz,
            });
          })
          .finally(function () {
            quizBtn.disabled = false;
            quizBtn.innerHTML = '<span class="lesson-action-btn__icon">✅</span><span class="lesson-action-btn__label">اختبار سريع</span>';
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
    var iconSpan = document.createElement('span');
    iconSpan.className = 'lesson-action-btn__icon';
    iconSpan.textContent = icon;
    btn.appendChild(iconSpan);
    var labelSpan = document.createElement('span');
    labelSpan.className = 'lesson-action-btn__label';
    labelSpan.textContent = label;
    btn.appendChild(labelSpan);
    btn.addEventListener('click', onClick);
    return btn;
  }

  /**
   * إنشاء زر عرض الكتاب (يظهر بجانب اسم المادة)
   * يفحص أولاً هل يوجد كتاب للفصل المفتوح حالياً، فإن لم يوجد يتراجع لكتاب المادة العام
   * @param {string} subjectBookUrl - رابط كتاب المادة العام (لكلا الفصلين)
   * @returns {HTMLElement} عنصر الزر
   */
  function createBookButton(subjectBookUrl) {
    const btn = document.createElement('button');
    btn.className = 'accordion-extra-btn';
    btn.title = 'عرض الكتاب';
    btn.textContent = '📕';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var subjectGroup = this.closest('.accordion-group--subject');
      var openSemester = subjectGroup ? subjectGroup.querySelector('.accordion-body .accordion-group--open') : null;
      var semesterBookUrl = openSemester ? openSemester.dataset.bookUrl : null;
      var finalUrl = semesterBookUrl || subjectBookUrl;
      if (finalUrl) {
        window.UIController.showContent('pdf', {
          title: 'كتاب المادة',
          url: finalUrl
        });
      } else {
        var cArea = document.getElementById('content-area');
        if (cArea) {
          cArea.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#888;font-size:18px;">📕 الكتاب غير متوفر حالياً</div>';
        }
      }
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
      case 'link':
        renderLink(data);
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

    var rawUrl = data.url;
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('http')) {
      rawUrl = window.location.origin + rawUrl;
    }

    var viewerUrl = 'https://docs.google.com/gview?url=' + encodeURIComponent(rawUrl) + '&embedded=true';

    var iframe = document.createElement('iframe');
    iframe.src = viewerUrl;
    iframe.title = data.title || 'مستند PDF';

    container.appendChild(iframe);

    var fallback = document.createElement('p');
    fallback.className = 'pdf-fallback';
    var link = document.createElement('a');
    link.href = rawUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'إذا لم يفتح الملف تلقائياً، اضغط هنا لتحميله مباشرة';
    fallback.appendChild(link);
    container.appendChild(fallback);

    contentArea.appendChild(container);
  }

  /**
   * فتح رابط خارجي في تبويب جديد
   * @param {Object} data - يحتوي url و title
   */
  function renderLink(data) {
    if (data && data.url) {
      var a = document.createElement('a');
      a.href = data.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'جاري فتح الرابط...';
      a.style.display = 'none';
      contentArea.appendChild(a);
      a.click();
      a.remove();
    }
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

      var iconDiv = document.createElement('div');
      iconDiv.className = 'content-quiz-placeholder__icon';
      iconDiv.textContent = '✅';
      container.appendChild(iconDiv);

      var titleH3 = document.createElement('h3');
      titleH3.textContent = data.title;
      container.appendChild(titleH3);

      var noteP = document.createElement('p');
      noteP.className = 'content-quiz-placeholder__note';
      noteP.textContent = 'محرك الاختبارات غير متوفر.';
      container.appendChild(noteP);

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

  /**
   * عرض البطاقة التعريفية للمطور
   */
  function showAboutDeveloper() {
    if (!contentArea) return;

    // إغلاق القائمة الجانبية إذا كانت مفتوحة (على الهواتف)
    if (typeof closeSidebar === 'function') {
      closeSidebar();
    }

    // مسح المحتوى السابق
    contentArea.innerHTML = '';

    // إنشاء شريط العنوان
    var titleBar = document.createElement('div');
    titleBar.className = 'content-titlebar';

    var backBtn = document.createElement('button');
    backBtn.className = 'content-back-btn';
    backBtn.textContent = '→ تصميم المنصة';
    backBtn.addEventListener('click', showWelcome);

    var titleText = document.createElement('h2');
    titleText.className = 'content-titlebar__text';
    titleText.textContent = 'عن المطور';

    titleBar.appendChild(backBtn);
    titleBar.appendChild(titleText);
    contentArea.appendChild(titleBar);

    // توليد البطاقة التعريفية
    var cardContainer = document.createElement('div');
    cardContainer.className = 'profile-wrapper';

    cardContainer.innerHTML = `
      <div class="profile-card">
        <div class="profile-card__header">
          <div class="profile-card__icon-wrapper">
            <svg class="profile-card__header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
            </svg>
          </div>
          <h2 class="profile-card__name">مرح جمال</h2>
          <p class="profile-card__major">طموح تعليمي لا محدود 🌟</p>
        </div>
        <div class="profile-card__body">
          <div class="profile-card__goal">
            <h3>الهدف من الموقع</h3>
            <p>تقديم منصة تعليمية شاملة ومنظمة لمختلف المواد الدراسية، تهدف إلى تيسير وصول الطلاب للمعلومة بطرق تفاعلية مبتكرة، وتوفير بيئة تدعم مسيرتهم الأكاديمية.</p>
          </div>
          <div class="profile-card__vision">
            <h3>الرؤية المستقبلية</h3>
            <p>يتم العمل حالياً على دمج تقنيات الذكاء الاصطناعي (AI) لتوليد اختبارات ذكية وألغاز يومية مخصصة لكل طالب.</p>
          </div>
        </div>
        <div class="profile-card__footer">
          <a href="mailto:marahjamal1312@gmail.com" target="_blank" rel="noopener noreferrer" class="profile-btn profile-btn--contact">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            تواصل معي
          </a>
        </div>
      </div>
    `;

    contentArea.appendChild(cardContainer);
  }

})();
