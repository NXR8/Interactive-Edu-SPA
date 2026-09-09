/* =============================================
   calculator.js — المنطق الرياضي للآلة الحاسبة العلمية
   =============================================
   هذا الملف يحتوي على:
   - إدارة حالة الآلة الحاسبة (State)
   - معالجة المدخلات (أرقام، عمليات، دوال علمية)
   - محرك الحساب (Evaluation Engine)
   - ربط الأحداث بالأزرار (Event Binding)
   
   ملاحظة: الكود مغلّف داخل IIFE لمنع تلويث النطاق العام (Global Scope)
   ============================================= */

;(function () {
  'use strict';

  /* ------------------------------------------
     عناصر DOM الأساسية
     ------------------------------------------ */
  const expressionEl = document.getElementById('calc-expression');
  const resultEl = document.getElementById('calc-result');
  const angleIndicatorEl = document.getElementById('calc-angle-indicator');
  const scientificPanel = document.getElementById('calc-scientific');
  const modeBtns = document.querySelectorAll('.calc-modes__btn');

  /* ------------------------------------------
     حالة الآلة الحاسبة (Calculator State)
     ------------------------------------------ */
  const state = {
    expression: '',       // التعبير الرياضي الكامل (ما يظهر في السطر العلوي)
    currentInput: '0',    // الرقم الحالي المُدخل (ما يظهر في السطر السفلي)
    isNewInput: true,     // هل يجب استبدال الرقم الحالي عند الإدخال التالي؟
    lastResult: null,     // آخر نتيجة محسوبة
    angleMode: 'deg',     // وضع الزوايا: 'deg' (درجات) أو 'rad' (راديان)
    openParens: 0,        // عدد الأقواس المفتوحة التي لم تُغلق بعد
    hasError: false,      // هل حدث خطأ في الحساب؟
    scientificMode: true, // هل الوضع العلمي مُفعّل؟
  };

  /* ------------------------------------------
     تحديث شاشة العرض
     ------------------------------------------ */

  /**
   * تحديث السطر العلوي (التعبير الرياضي)
   */
  function updateExpression() {
    expressionEl.textContent = state.expression || '';
  }

  /**
   * تحديث السطر السفلي (النتيجة / الرقم الحالي)
   */
  function updateResult() {
    const text = state.currentInput;

    // إزالة صنف الخطأ إذا كان موجوداً
    resultEl.classList.remove('calc-display__result--error', 'calc-display__result--small');

    if (state.hasError) {
      resultEl.classList.add('calc-display__result--error');
    }

    // تصغير الخط إذا كان النص طويلاً
    if (text.length > 12) {
      resultEl.classList.add('calc-display__result--small');
    }

    resultEl.textContent = text;
  }

  /**
   * تحديث الشاشة بالكامل
   */
  function updateDisplay() {
    updateExpression();
    updateResult();
  }

  /* ------------------------------------------
     تنسيق الأرقام لعرضها
     ------------------------------------------ */

  /**
   * تنسيق الرقم لعرضه بشكل مقروء
   * - تقريب الأرقام العشرية الطويلة
   * - التعامل مع الأرقام الكبيرة جداً أو الصغيرة جداً
   * @param {number} num - الرقم المراد تنسيقه
   * @returns {string} النص المنسّق
   */
  function formatNumber(num) {
    if (typeof num !== 'number' || !isFinite(num)) {
      return 'خطأ';
    }

    // إذا كان الرقم كبيراً جداً أو صغيراً جداً، نستخدم الترميز العلمي
    if (Math.abs(num) > 1e15 || (Math.abs(num) < 1e-10 && num !== 0)) {
      return num.toExponential(8);
    }

    // تقريب إلى 10 خانات عشرية كحد أقصى لتجنب أخطاء الفاصلة العائمة
    const rounded = parseFloat(num.toPrecision(12));
    return String(rounded);
  }

  /* ------------------------------------------
     تحويل الزوايا
     ------------------------------------------ */

  /**
   * تحويل القيمة من الدرجات إلى الراديان (إذا كان الوضع بالدرجات)
   * دوال Math.sin/cos/tan تعمل بالراديان دائماً
   * @param {number} value - القيمة بالدرجات أو الراديان
   * @returns {number} القيمة بالراديان
   */
  function toRadians(value) {
    if (state.angleMode === 'deg') {
      return value * (Math.PI / 180);
    }
    return value; // إذا كان الوضع بالراديان، لا حاجة للتحويل
  }

  /**
   * تحويل القيمة من الراديان إلى الدرجات (للدوال العكسية)
   * @param {number} value - القيمة بالراديان
   * @returns {number} القيمة بالدرجات أو الراديان حسب الوضع
   */
  function fromRadians(value) {
    if (state.angleMode === 'deg') {
      return value * (180 / Math.PI);
    }
    return value;
  }

  /* ------------------------------------------
     إعادة ضبط الحالة (Reset)
     ------------------------------------------ */

  /**
   * مسح كل شيء وإعادة الآلة الحاسبة لحالتها الابتدائية
   */
  function clearAll() {
    state.expression = '';
    state.currentInput = '0';
    state.isNewInput = true;
    state.lastResult = null;
    state.openParens = 0;
    state.hasError = false;
    updateDisplay();
  }

  /**
   * حذف آخر حرف من الإدخال الحالي (Backspace)
   */
  function deleteLast() {
    if (state.hasError || state.isNewInput) {
      clearAll();
      return;
    }

    if (state.currentInput.length > 1) {
      state.currentInput = state.currentInput.slice(0, -1);
    } else {
      state.currentInput = '0';
      state.isNewInput = true;
    }
    updateResult();
  }

  /* ------------------------------------------
     إدخال الأرقام والفاصلة العشرية
     ------------------------------------------ */

  /**
   * إدخال رقم (0-9)
   * @param {string} digit - الرقم المُدخل
   */
  function inputDigit(digit) {
    if (state.hasError) clearAll();

    if (state.isNewInput) {
      // استبدال الرقم الحالي بالرقم الجديد
      state.currentInput = digit;
      state.isNewInput = false;
    } else {
      // منع إضافة أصفار متعددة في البداية (مثل: 000)
      if (state.currentInput === '0' && digit === '0') return;
      // استبدال الصفر الوحيد بالرقم الجديد (مثل: 0 → 5)
      if (state.currentInput === '0' && digit !== '0') {
        state.currentInput = digit;
      } else {
        state.currentInput += digit;
      }
    }
    updateResult();
  }

  /**
   * إدخال الفاصلة العشرية (.)
   * يمنع إضافة أكثر من فاصلة واحدة
   */
  function inputDecimal() {
    if (state.hasError) clearAll();

    if (state.isNewInput) {
      state.currentInput = '0.';
      state.isNewInput = false;
    } else if (!state.currentInput.includes('.')) {
      state.currentInput += '.';
    }
    updateResult();
  }

  /* ------------------------------------------
     العمليات الحسابية الأساسية
     ------------------------------------------ */

  /**
   * تطبيق عملية حسابية أساسية (+, -, ×, ÷)
   * @param {string} operator - رمز العملية
   */
  function inputOperator(operator) {
    if (state.hasError) return;

    const currentVal = state.currentInput;

    // إذا كان هناك تعبير سابق وهذا إدخال جديد، نستبدل العملية الأخيرة
    if (state.isNewInput && state.expression) {
      // استبدال آخر عملية بالعملية الجديدة
      state.expression = state.expression.replace(/\s[+\-×÷]\s$/, ` ${operator} `);
      updateExpression();
      return;
    }

    // إضافة الرقم الحالي والعملية إلى التعبير
    state.expression += currentVal + ` ${operator} `;
    state.isNewInput = true;
    updateExpression();
  }

  /**
   * إدخال قوس (مفتوح أو مغلق)
   * يقرر تلقائياً أي نوع بناءً على السياق
   */
  function inputParenthesis() {
    if (state.hasError) clearAll();

    const expr = state.expression;
    const lastChar = expr.trim().slice(-1);

    // إذا كانت هناك أقواس مفتوحة والسياق يسمح بإغلاقها
    if (state.openParens > 0 && state.isNewInput === false) {
      state.expression += state.currentInput + ' ) ';
      state.openParens--;
      state.isNewInput = true;
    }
    // فتح قوس جديد
    else {
      // إذا كان آخر شيء رقم أو قوس مغلق، نضيف عملية ضرب ضمنية
      if (!state.isNewInput && state.currentInput !== '0') {
        state.expression += state.currentInput + ' × ';
      }
      state.expression += '( ';
      state.openParens++;
      state.isNewInput = true;
      state.currentInput = '0';
    }
    updateDisplay();
  }

  /* ------------------------------------------
     تغيير الإشارة والنسبة المئوية
     ------------------------------------------ */

  /**
   * تبديل الإشارة (موجب ↔ سالب)
   */
  function toggleSign() {
    if (state.hasError || state.currentInput === '0') return;

    if (state.currentInput.startsWith('-')) {
      state.currentInput = state.currentInput.slice(1);
    } else {
      state.currentInput = '-' + state.currentInput;
    }
    updateResult();
  }

  /**
   * حساب النسبة المئوية (يقسم الرقم على 100)
   */
  function applyPercent() {
    if (state.hasError) return;

    const num = parseFloat(state.currentInput);
    if (isNaN(num)) return;

    state.currentInput = formatNumber(num / 100);
    state.isNewInput = true;
    updateResult();
  }

  /* ------------------------------------------
     الدوال العلمية (Scientific Functions)
     ------------------------------------------ */

  /**
   * تطبيق دالة علمية على الرقم الحالي
   * @param {string} funcName - اسم الدالة العلمية
   * 
   * الدوال المدعومة:
   * - sin, cos, tan: دوال مثلثية (تعتمد على وضع الزوايا deg/rad)
   * - asin, acos, atan: دوال مثلثية عكسية
   * - log: اللوغاريتم العشري (log₁₀)
   * - ln: اللوغاريتم الطبيعي (logₑ)
   * - sqrt: الجذر التربيعي (√)
   * - cbrt: الجذر التكعيبي (∛)
   * - square: التربيع (x²)
   * - cube: التكعيب (x³)
   * - inverse: المقلوب (1/x)
   * - factorial: المضروب (x!)
   * - abs: القيمة المطلقة (|x|)
   * - exp: الدالة الأسية (eˣ)
   * - tenPow: عشرة أُس x (10ˣ)
   * - pi: ثابت باي (π)
   * - euler: ثابت أويلر (e)
   */
  function applyScientific(funcName) {
    if (state.hasError) clearAll();

    const num = parseFloat(state.currentInput);
    if (isNaN(num) && funcName !== 'pi' && funcName !== 'euler') return;

    let result;

    switch (funcName) {
      /* ── الدوال المثلثية ── */
      case 'sin':
        // حساب الجيب (Sine) - يتم تحويل الدرجات للراديان إذا لزم
        result = Math.sin(toRadians(num));
        state.expression = `sin(${num}) =`;
        break;

      case 'cos':
        // حساب جيب التمام (Cosine)
        result = Math.cos(toRadians(num));
        state.expression = `cos(${num}) =`;
        break;

      case 'tan':
        // حساب الظل (Tangent) - يعطي خطأ عند 90° و 270° لأن tan غير معرّف
        const radians = toRadians(num);
        if (Math.abs(Math.cos(radians)) < 1e-10) {
          state.currentInput = 'غير معرّف';
          state.expression = `tan(${num}) =`;
          state.hasError = true;
          updateDisplay();
          return;
        }
        result = Math.tan(radians);
        state.expression = `tan(${num}) =`;
        break;

      /* ── الدوال المثلثية العكسية ── */
      case 'asin':
        // الجيب العكسي - المجال المقبول: [-1, 1]
        if (num < -1 || num > 1) {
          state.currentInput = 'خطأ: خارج النطاق';
          state.hasError = true;
          state.expression = `sin⁻¹(${num}) =`;
          updateDisplay();
          return;
        }
        result = fromRadians(Math.asin(num));
        state.expression = `sin⁻¹(${num}) =`;
        break;

      case 'acos':
        // جيب التمام العكسي - المجال المقبول: [-1, 1]
        if (num < -1 || num > 1) {
          state.currentInput = 'خطأ: خارج النطاق';
          state.hasError = true;
          state.expression = `cos⁻¹(${num}) =`;
          updateDisplay();
          return;
        }
        result = fromRadians(Math.acos(num));
        state.expression = `cos⁻¹(${num}) =`;
        break;

      case 'atan':
        // الظل العكسي - يقبل أي قيمة
        result = fromRadians(Math.atan(num));
        state.expression = `tan⁻¹(${num}) =`;
        break;

      /* ── اللوغاريتمات ── */
      case 'log':
        // اللوغاريتم العشري (log₁₀) - يشترط أن يكون الرقم موجباً
        if (num <= 0) {
          state.currentInput = 'خطأ: رقم غير موجب';
          state.hasError = true;
          state.expression = `log(${num}) =`;
          updateDisplay();
          return;
        }
        result = Math.log10(num);
        state.expression = `log₁₀(${num}) =`;
        break;

      case 'ln':
        // اللوغاريتم الطبيعي (ln) - يشترط أن يكون الرقم موجباً
        if (num <= 0) {
          state.currentInput = 'خطأ: رقم غير موجب';
          state.hasError = true;
          state.expression = `ln(${num}) =`;
          updateDisplay();
          return;
        }
        result = Math.log(num);
        state.expression = `ln(${num}) =`;
        break;

      /* ── الجذور ── */
      case 'sqrt':
        // الجذر التربيعي - يشترط أن يكون الرقم غير سالب
        if (num < 0) {
          state.currentInput = 'خطأ: جذر رقم سالب';
          state.hasError = true;
          state.expression = `√(${num}) =`;
          updateDisplay();
          return;
        }
        result = Math.sqrt(num);
        state.expression = `√(${num}) =`;
        break;

      case 'cbrt':
        // الجذر التكعيبي - يقبل الأرقام السالبة أيضاً
        result = Math.cbrt(num);
        state.expression = `∛(${num}) =`;
        break;

      /* ── الأُسُس (القوى) ── */
      case 'square':
        // تربيع الرقم (x²)
        result = Math.pow(num, 2);
        state.expression = `(${num})² =`;
        break;

      case 'cube':
        // تكعيب الرقم (x³)
        result = Math.pow(num, 3);
        state.expression = `(${num})³ =`;
        break;

      case 'power':
        // الأُس (xʸ) - نضيف فقط رمز الأُس للتعبير ونترك المستخدم يدخل الأُس
        state.expression += state.currentInput + ' ^ ';
        state.isNewInput = true;
        updateDisplay();
        return;

      /* ── دوال أخرى ── */
      case 'inverse':
        // المقلوب (1/x) - يشترط أن لا يكون الرقم صفراً
        if (num === 0) {
          state.currentInput = 'خطأ: قسمة على صفر';
          state.hasError = true;
          state.expression = `1/(${num}) =`;
          updateDisplay();
          return;
        }
        result = 1 / num;
        state.expression = `1/(${num}) =`;
        break;

      case 'factorial':
        // المضروب (x!) - فقط للأعداد الصحيحة غير السالبة
        if (num < 0 || !Number.isInteger(num)) {
          state.currentInput = 'خطأ: عدد صحيح غير سالب فقط';
          state.hasError = true;
          state.expression = `${num}! =`;
          updateDisplay();
          return;
        }
        if (num > 170) {
          // المضروب لأرقام أكبر من 170 يتجاوز حدود JavaScript
          state.currentInput = 'خطأ: رقم كبير جداً';
          state.hasError = true;
          state.expression = `${num}! =`;
          updateDisplay();
          return;
        }
        result = factorial(num);
        state.expression = `${num}! =`;
        break;

      case 'abs':
        // القيمة المطلقة |x|
        result = Math.abs(num);
        state.expression = `|${num}| =`;
        break;

      case 'exp':
        // الدالة الأسية (e أُس x)
        result = Math.exp(num);
        state.expression = `e^(${num}) =`;
        break;

      case 'tenPow':
        // 10 أُس x
        result = Math.pow(10, num);
        state.expression = `10^(${num}) =`;
        break;

      /* ── الثوابت الرياضية ── */
      case 'pi':
        // إدخال ثابت باي (π ≈ 3.14159265...)
        state.currentInput = String(Math.PI);
        state.isNewInput = false;
        updateResult();
        return;

      case 'euler':
        // إدخال ثابت أويلر (e ≈ 2.71828182...)
        state.currentInput = String(Math.E);
        state.isNewInput = false;
        updateResult();
        return;

      default:
        return;
    }

    // تحديث الشاشة بالنتيجة
    state.currentInput = formatNumber(result);
    state.isNewInput = true;
    state.hasError = state.currentInput === 'خطأ';
    updateDisplay();
  }

  /* ------------------------------------------
     دالة حساب المضروب (Factorial)
     ------------------------------------------ */

  /**
   * حساب المضروب بطريقة تكرارية (Iterative)
   * n! = n × (n-1) × (n-2) × ... × 1
   * 0! = 1 (بالتعريف)
   * @param {number} n - العدد المراد حساب مضروبه
   * @returns {number} ناتج المضروب
   */
  function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  /* ------------------------------------------
     محرك الحساب (Evaluation Engine)
     ------------------------------------------ */

  /**
   * حساب النتيجة النهائية عند الضغط على زر المساواة (=)
   * 
   * الخطوات:
   * 1. تجميع التعبير الكامل
   * 2. إغلاق الأقواس المفتوحة تلقائياً
   * 3. تحويل الرموز العربية/المرئية إلى رموز JavaScript
   * 4. التحقق من صحة التعبير
   * 5. حساب النتيجة باستخدام Function constructor (أكثر أماناً من eval)
   */
  function calculate() {
    if (state.hasError) return;

    // إضافة الرقم الحالي للتعبير
    let fullExpr = state.expression;
    if (!state.isNewInput) {
      fullExpr += state.currentInput;
    } else if (!fullExpr) {
      // لا يوجد تعبير للحساب
      return;
    }

    // إغلاق الأقواس المفتوحة تلقائياً
    while (state.openParens > 0) {
      fullExpr += ' )';
      state.openParens--;
    }

    // عرض التعبير الكامل مع علامة =
    state.expression = fullExpr + ' =';

    // تحويل رموز العرض إلى رموز الجافاسكربت
    let jsExpr = fullExpr
      .replace(/×/g, '*')    // ضرب
      .replace(/÷/g, '/')    // قسمة
      .replace(/−/g, '-')    // طرح
      .replace(/\^/g, '**'); // أُس

    // إزالة المسافات الزائدة
    jsExpr = jsExpr.trim();

    // التحقق الأمني: السماح فقط بالأرقام والعمليات والأقواس
    if (!/^[\d\s+\-*/().%e**]+$/i.test(jsExpr.replace(/\s/g, ''))) {
      state.currentInput = 'خطأ في التعبير';
      state.hasError = true;
      updateDisplay();
      return;
    }

    try {
      // استخدام Function constructor بدلاً من eval لأسباب أمنية
      // Function constructor ينشئ دالة في نطاق معزول
      const computeFn = new Function('return (' + jsExpr + ')');
      const result = computeFn();

      if (typeof result !== 'number' || !isFinite(result)) {
        state.currentInput = 'خطأ رياضي';
        state.hasError = true;
      } else {
        state.currentInput = formatNumber(result);
        state.lastResult = result;
      }
    } catch (e) {
      // معالجة أي خطأ في التعبير الرياضي
      state.currentInput = 'خطأ في التعبير';
      state.hasError = true;
    }

    state.isNewInput = true;
    updateDisplay();
  }

  /* ------------------------------------------
     تبديل وضع الزوايا (Degrees / Radians)
     ------------------------------------------ */

  /**
   * التبديل بين وضع الدرجات والراديان
   * يؤثر على حساب الدوال المثلثية (sin, cos, tan)
   */
  function toggleAngleMode() {
    if (state.angleMode === 'deg') {
      state.angleMode = 'rad';
      angleIndicatorEl.textContent = 'RAD';
    } else {
      state.angleMode = 'deg';
      angleIndicatorEl.textContent = 'DEG';
    }
  }

  /* ------------------------------------------
     التبديل بين الوضع العلمي والبسيط
     ------------------------------------------ */

  /**
   * إظهار/إخفاء لوحة الأزرار العلمية
   * @param {string} mode - 'scientific' أو 'basic'
   */
  function setMode(mode) {
    state.scientificMode = (mode === 'scientific');

    // تحديث مظهر أزرار التبديل
    modeBtns.forEach(btn => {
      btn.classList.toggle('calc-modes__btn--active', btn.dataset.mode === mode);
    });

    // إظهار/إخفاء اللوحة العلمية بتأثير حركي
    scientificPanel.classList.toggle('calc-scientific--visible', state.scientificMode);
  }

  /* ------------------------------------------
     ربط الأحداث بالأزرار (Event Binding)
     ------------------------------------------ */

  /**
   * ربط جميع أحداث النقر على أزرار الآلة الحاسبة
   * يستخدم Event Delegation على الحاوية الأم لتحسين الأداء
   */
  function bindEvents() {
    const calculator = document.getElementById('calculator');
    if (!calculator) return;

    // --- Event Delegation: الاستماع للنقرات على الحاوية الأم ---
    calculator.addEventListener('click', function (e) {
      const btn = e.target.closest('.calc-btn');
      if (!btn) return;

      const action = btn.dataset.action;
      const value = btn.dataset.value;

      // تحديد نوع الإجراء المطلوب
      if (value !== undefined) {
        // --- إدخال رقم ---
        inputDigit(value);
      } else if (action) {
        switch (action) {
          // --- عمليات أساسية ---
          case 'add':        inputOperator('+'); break;
          case 'subtract':   inputOperator('−'); break;
          case 'multiply':   inputOperator('×'); break;
          case 'divide':     inputOperator('÷'); break;
          case 'equals':     calculate(); break;

          // --- وظائف ---
          case 'clear':      clearAll(); break;
          case 'delete':     deleteLast(); break;
          case 'decimal':    inputDecimal(); break;
          case 'sign':       toggleSign(); break;
          case 'percent':    applyPercent(); break;
          case 'parens':     inputParenthesis(); break;

          // --- دوال علمية ---
          default:
            applyScientific(action);
            break;
        }
      }
    });

    // --- تبديل وضع الزوايا ---
    if (angleIndicatorEl) {
      angleIndicatorEl.addEventListener('click', toggleAngleMode);
    }

    // --- أزرار تبديل الوضع (علمي / بسيط) ---
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // --- دعم لوحة المفاتيح ---
    document.addEventListener('keydown', function (e) {
      // تجاهل الأحداث إذا كان المستخدم يكتب في حقل إدخال آخر
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key;

      if (/^[0-9]$/.test(key)) {
        inputDigit(key);
      } else {
        switch (key) {
          case '+':         inputOperator('+'); break;
          case '-':         inputOperator('−'); break;
          case '*':         inputOperator('×'); break;
          case '/':
            e.preventDefault(); // منع البحث في المتصفح
            inputOperator('÷');
            break;
          case 'Enter':
          case '=':         calculate(); break;
          case 'Escape':    clearAll(); break;
          case 'Backspace': deleteLast(); break;
          case '.':
          case ',':         inputDecimal(); break;
          case '(':
          case ')':         inputParenthesis(); break;
          case '%':         applyPercent(); break;
        }
      }
    });
  }

  /* ------------------------------------------
     التهيئة عند تحميل الصفحة
     ------------------------------------------ */

  /**
   * تهيئة الآلة الحاسبة: ربط الأحداث وعرض الحالة الأولية
   */
  function init() {
    bindEvents();
    // تفعيل الوضع العلمي افتراضياً
    setMode('scientific');
    updateDisplay();
  }

  // انتظار تحميل DOM بالكامل قبل التهيئة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
