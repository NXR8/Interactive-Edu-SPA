/* =============================================
   app.js — نقطة الدخول الرئيسية للتطبيق
   =============================================
   هذا الملف هو المنسّق المركزي (Orchestrator) الذي:
   - يُحمّل بيانات المنهج من ملف JSON أو الـ API عبر Fetch API
   - يستدعي وحدة التحكم بالواجهة (UIController) لبناء القائمة الجانبية
   - يُعالج المصادقة وتسجيل الدخول
   ============================================= */

;(function () {
  'use strict';

  /* ------------------------------------------
     إعدادات التطبيق
     ------------------------------------------ */
  var CONFIG = {
    // مسار الـ API للحصول على المنهج
    curriculumPath: '/api/curriculum',
    puzzlesPath: 'data/puzzles.json',
  };

  // حالة المستخدم الحالي
  window.AppUser = {
    token: localStorage.getItem('edu_token') || null,
    email: localStorage.getItem('edu_email') || null
  };

  /* ------------------------------------------
     جلب البيانات من الـ API
     ------------------------------------------ */

  function fetchCurriculum() {
    return fetch(CONFIG.curriculumPath)
      .then(function (response) {
        if (!response.ok) {
          throw new Error('فشل تحميل بيانات المنهج. كود الاستجابة: ' + response.status);
        }
        return response.json();
      });
  }

  /* ------------------------------------------
     إعدادات المصادقة (Auth)
     ------------------------------------------ */
  function initAuth() {
    var authSection = document.getElementById('auth-section');
    var loginBtn = document.getElementById('login-btn');
    
    var authModal = document.getElementById('auth-modal');
    var authCloseBtn = document.getElementById('auth-close-btn');
    var authForm = document.getElementById('auth-form');
    var authEmailInput = document.getElementById('auth-email');
    var authPasswordInput = document.getElementById('auth-password');
    var authToggleBtn = document.getElementById('auth-toggle-btn');
    var authTitle = document.getElementById('auth-title');
    var authToggleText = document.getElementById('auth-toggle-text');
    var authSubmitBtn = document.getElementById('auth-submit-btn');
    var authErrorMsg = document.getElementById('auth-error-msg');

    var authRegisterFields = document.getElementById('auth-register-fields');
    var authFirstNameInput = document.getElementById('auth-first-name');
    var authLastNameInput = document.getElementById('auth-last-name');
    var authBirthDateInput = document.getElementById('auth-birth-date');
    var authPasswordConfirmInput = document.getElementById('auth-password-confirm');
    
    var unauthModal = document.getElementById('unauthorized-modal');
    var unauthCloseBtn = document.getElementById('unauth-close-btn');
    var unauthLoginBtn = document.getElementById('unauth-login-btn');
    
    var isLoginMode = true; // false means Register mode

    // تحديث زر الواجهة
    function updateAuthUI() {
      if (window.AppUser.token) {
        loginBtn.textContent = (window.AppUser.email || 'مستخدم') + ' (خروج)';
        loginBtn.classList.add('auth-btn--logged-in');
      } else {
        loginBtn.textContent = 'تسجيل الدخول';
        loginBtn.classList.remove('auth-btn--logged-in');
      }
    }

    updateAuthUI();

    // فتح/إغلاق المودال
    loginBtn.addEventListener('click', function() {
      if (window.AppUser.token) {
        // تسجيل الخروج
        localStorage.removeItem('edu_token');
        localStorage.removeItem('edu_email');
        window.AppUser.token = null;
        window.AppUser.email = null;
        updateAuthUI();
      } else {
        authModal.style.display = 'flex';
      }
    });

    authCloseBtn.addEventListener('click', function() {
      authModal.style.display = 'none';
      authErrorMsg.textContent = '';
    });
    
    unauthCloseBtn.addEventListener('click', function() {
      unauthModal.style.display = 'none';
    });
    
    unauthLoginBtn.addEventListener('click', function() {
      unauthModal.style.display = 'none';
      authModal.style.display = 'flex';
    });

    // تبديل بين تسجيل الدخول وإنشاء الحساب
    authToggleBtn.addEventListener('click', function() {
      isLoginMode = !isLoginMode;
      authErrorMsg.textContent = '';
      if (isLoginMode) {
        authTitle.textContent = 'تسجيل الدخول';
        authSubmitBtn.textContent = 'دخول';
        authToggleText.textContent = 'ليس لديك حساب؟';
        authToggleBtn.textContent = 'إنشاء حساب';
        authRegisterFields.style.display = 'none';
        authEmailInput.required = true;
        authPasswordInput.required = true;
      } else {
        authTitle.textContent = 'إنشاء حساب جديد';
        authSubmitBtn.textContent = 'تسجيل';
        authToggleText.textContent = 'لديك حساب مسبقاً؟';
        authToggleBtn.textContent = 'تسجيل الدخول';
        authRegisterFields.style.display = 'block';
        authEmailInput.required = true;
        authPasswordInput.required = true;
      }
    });

    // إرسال النموذج
    authForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var email = authEmailInput.value.trim();
      var password = authPasswordInput.value.trim();
      
      if (!email || !password) return;
      
      authErrorMsg.textContent = 'جاري التحقق...';
      authSubmitBtn.disabled = true;
      
      var url = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      
      var options = {};
      if (isLoginMode) {
        var formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData
        };
      } else {
        // Register mode: validate fields
        var firstName = authFirstNameInput ? authFirstNameInput.value.trim() : '';
        var lastName = authLastNameInput ? authLastNameInput.value.trim() : '';
        var birthDate = authBirthDateInput ? authBirthDateInput.value : '';
        var passwordConfirm = authPasswordConfirmInput ? authPasswordConfirmInput.value.trim() : '';

        if (!firstName || !lastName) {
          authErrorMsg.textContent = 'يرجى إدخال الاسم الأول والاسم الثاني';
          authSubmitBtn.disabled = false;
          return;
        }
        if (password !== passwordConfirm) {
          authErrorMsg.textContent = 'كلمة المرور غير متطابقة';
          authSubmitBtn.disabled = false;
          return;
        }

        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            first_name: firstName,
            last_name: lastName,
            birth_date: birthDate,
            password: password,
            password_confirm: passwordConfirm
          })
        };
      }

      fetch(url, options)
        .then(function(res) {
          if (!res.ok) {
            return res.json().then(function(errData) {
              throw new Error(errData.detail || 'حدث خطأ غير معروف');
            });
          }
          return res.json();
        })
        .then(function(data) {
          localStorage.setItem('edu_token', data.access_token);
          localStorage.setItem('edu_email', email);
          window.AppUser.token = data.access_token;
          window.AppUser.email = email;
          
          updateAuthUI();
          authModal.style.display = 'none';
          authForm.reset();
          if (authRegisterFields) authRegisterFields.style.display = 'none';
          isLoginMode = true;
        })
        .catch(function(err) {
          authErrorMsg.textContent = err.message;
        })
        .finally(function() {
          authSubmitBtn.disabled = false;
        });
    });
    
    window.showUnauthorizedModal = function() {
      unauthModal.style.display = 'flex';
    };
  }

  /* ------------------------------------------
     تهيئة التطبيق
     ------------------------------------------ */

  function init() {
    if (typeof window.UIController === 'undefined') {
      console.error('خطأ: وحدة UIController غير محمّلة.');
      return;
    }

    initAuth();

    if (window.DailyPuzzle) {
      window.DailyPuzzle.displayDailyPuzzle();
    }

    fetchCurriculum()
      .then(function (data) {
        loadMenu(data, 'FastAPI Backend');
      })
      .catch(function (fetchError) {
        console.warn('⚠️ فشل Fetch API:', fetchError.message);
        if (typeof window.CURRICULUM_DATA !== 'undefined') {
          loadMenu(window.CURRICULUM_DATA, 'Embedded Data');
        } else {
          showLoadError(fetchError.message);
        }
      });
  }

  function loadMenu(data, source) {
    window.UIController.buildNavigationMenu(data);
    console.log('✅ تم تحميل المنهج بنجاح عبر ' + source + ':', data.grades.length, 'صف/صفوف');
  }

  function showLoadError(message) {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    var placeholder = sidebar.querySelector('.sidebar__placeholder');
    if (placeholder) placeholder.remove();
    var errorDiv = document.createElement('div');
    errorDiv.className = 'sidebar__error';

    var iconSpan = document.createElement('span');
    iconSpan.className = 'sidebar__error-icon';
    iconSpan.textContent = '⚠️';
    errorDiv.appendChild(iconSpan);

    var textP = document.createElement('p');
    textP.className = 'sidebar__error-text';
    textP.textContent = 'تعذّر تحميل بيانات المنهج';
    errorDiv.appendChild(textP);

    var detailP = document.createElement('p');
    detailP.className = 'sidebar__error-detail';
    detailP.textContent = message;
    errorDiv.appendChild(detailP);

    var retryBtn = document.createElement('button');
    retryBtn.className = 'sidebar__error-retry';
    retryBtn.textContent = '🔄 إعادة المحاولة';
    retryBtn.addEventListener('click', function() { location.reload(); });
    errorDiv.appendChild(retryBtn);

    sidebar.appendChild(errorDiv);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
