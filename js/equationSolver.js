/* =============================================
   equationSolver.js — محرك حل المعادلات الجبرية
   =============================================
   هذا الملف يحتوي على:
   - معالجة مدخلات المستخدم (تنظيف النص وتحويل "س" إلى "x")
   - حل المعادلات باستخدام مكتبة Nerdamer
   - تنسيق النتائج لتظهر ككسور وجذور (بدلاً من فواصل عشرية)
   - معالجة الأخطاء وعرض رسائل توضيحية للمستخدم
   
   التبعيات: Nerdamer.js (Core + Algebra + Calculus + Solve)
   ملاحظة: الكود مغلّف داخل IIFE لمنع تلويث النطاق العام
   ============================================= */

;(function () {
  'use strict';

  /* ------------------------------------------
     عناصر DOM
     ------------------------------------------ */
  let inputEl, solveBtn, clearBtn, resultArea, examplesContainer;

  /* ------------------------------------------
     التحقق من تحميل مكتبة Nerdamer
     والانتظار حتى تصبح جاهزة
     ------------------------------------------ */

  /**
   * انتظار تحميل مكتبة Nerdamer من CDN
   * المكتبة محمّلة بـ defer في الـ head، لذا قد تتأخر قليلاً
   * نتحقق كل 100 مللي ثانية لمدة أقصاها 10 ثوانٍ
   */
  function waitForNerdamer(callback, maxWait) {
    maxWait = maxWait || 10000;
    const interval = 100;
    let elapsed = 0;

    const check = setInterval(function () {
      if (typeof nerdamer !== 'undefined' && typeof nerdamer.solve === 'function') {
        clearInterval(check);
        callback();
      } else {
        elapsed += interval;
        if (elapsed >= maxWait) {
          clearInterval(check);
          console.error('خطأ: انتهت مهلة تحميل مكتبة Nerdamer.');
          var ra = document.getElementById('eq-result-area');
          if (ra) {
            ra.innerHTML = '<div class="eq-result-error"><span class="eq-error-icon">❌</span><p class="eq-error-text">⚠️ تعذّر تحميل المكتبة الرياضية. تحقق من اتصال الإنترنت.</p></div>';
          }
        }
      }
    }, interval);
  }

  /* ------------------------------------------
     أمثلة المعادلات المُعدّة مسبقاً
     ------------------------------------------ */
  const examples = [
    { label: 'س² - 4 = 0', value: 'x^2 - 4 = 0' },
    { label: '2س + 6 = 0', value: '2x + 6 = 0' },
    { label: 'س² - 3 = 0', value: 'x^2 - 3 = 0' },
    { label: '3س² + 2س - 1 = 0', value: '3x^2 + 2x - 1 = 0' },
    { label: 'س³ - 8 = 0', value: 'x^3 - 8 = 0' },
  ];

  /* ------------------------------------------
     تهيئة أزرار الأمثلة
     ------------------------------------------ */
  function initExamples() {
    if (!examplesContainer) return;

    examples.forEach(ex => {
      const btn = document.createElement('button');
      btn.className = 'eq-example-btn';
      btn.textContent = ex.label;
      btn.addEventListener('click', () => {
        inputEl.value = ex.value;
        inputEl.focus();
        // تأثير بصري عند اختيار المثال
        btn.classList.add('eq-example-btn--active');
        setTimeout(() => btn.classList.remove('eq-example-btn--active'), 300);
      });
      examplesContainer.appendChild(btn);
    });
  }

  /* ------------------------------------------
     تنظيف ومعالجة المدخلات
     ------------------------------------------ */

  /**
   * تحويل النص المُدخل من صيغة المستخدم إلى صيغة يفهمها Nerdamer
   * 
   * المعالجات:
   * 1. استبدال الحرف العربي "س" بـ "x"
   * 2. تحويل الضرب الضمني (مثل: 2x → 2*x)
   * 3. تحويل الرموز العربية (× → *, ÷ → /)
   * 4. تنظيف المسافات الزائدة
   * 
   * @param {string} input - النص المُدخل من المستخدم
   * @returns {string} النص المُعالج الجاهز لـ Nerdamer
   */
  function preprocessInput(input) {
    let expr = input.trim();

    // 1. استبدال الحرف العربي "س" بالحرف اللاتيني "x"
    expr = expr.replace(/س/g, 'x');

    // 2. استبدال الرموز العربية بالرموز الرياضية القياسية
    expr = expr.replace(/×/g, '*');
    expr = expr.replace(/÷/g, '/');
    expr = expr.replace(/−/g, '-');

    // 3. إدراج عملية الضرب الضمنية
    // مثال: "2x" → "2*x", "3sin" → "3*sin", "(2)(3)" → "(2)*(3)"
    expr = expr.replace(/(\d)([a-zA-Z(])/g, '$1*$2');           // رقم متبوع بحرف أو قوس
    expr = expr.replace(/([a-zA-Z)])(\d)/g, '$1*$2');           // حرف أو قوس مغلق متبوع برقم (حالات خاصة)
    expr = expr.replace(/\)(\()/g, ')*(');                       // )( → )*(

    // 4. تنظيف المسافات الزائدة
    expr = expr.replace(/\s+/g, ' ').trim();

    return expr;
  }

  /* ------------------------------------------
     تحويل تعبير Nerdamer إلى نص عربي مقروء
     ------------------------------------------ */

  /**
   * تنسيق نتيجة الحل لعرضها بشكل رياضي أنيق
   * - تحويل sqrt إلى رمز √
   * - عرض الكسور بشكل واضح
   * - تجنب الفواصل العشرية الطويلة
   * 
   * @param {string} solution - نص النتيجة من Nerdamer
   * @returns {string} النتيجة المنسّقة
   */
  function formatSolution(solution) {
    let formatted = solution;

    // تحويل sqrt(n) إلى √n لعرض أجمل
    formatted = formatted.replace(/sqrt\(([^)]+)\)/g, '√($1)');

    // تحسين عرض الكسور - مثل: (1/3) → ¹⁄₃ أو نعرضها كما هي لأنها أوضح
    // نحتفظ بصيغة الكسر الأصلية لأنها مقروءة

    // إزالة الأقواس الخارجية غير الضرورية إذا كانت النتيجة بسيطة
    if (formatted.startsWith('(') && formatted.endsWith(')')) {
      const inner = formatted.slice(1, -1);
      // نتحقق أن الأقواس ليست ضرورية (لا يوجد عمليات رئيسية بداخلها)
      let depth = 0;
      let safe = true;
      for (const ch of inner) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (depth < 0) { safe = false; break; }
      }
      if (safe && depth === 0) {
        formatted = inner;
      }
    }

    // تحويل بعض التعبيرات الشائعة لشكل أجمل
    formatted = formatted.replace(/\*/g, '·');  // نقطة الضرب بدل *
    formatted = formatted.replace(/\^/g, '^');   // نحتفظ بعلامة الأُس

    return formatted;
  }

  /**
   * إنشاء عنصر HTML لعرض حل واحد بشكل أنيق
   * @param {string} solution - نص الحل المنسّق
   * @param {number} index - ترتيب الحل
   * @returns {string} كود HTML للحل
   */
  function createSolutionCard(solution, index) {
    const formatted = formatSolution(solution);
    return `
      <div class="eq-solution-card" style="animation-delay: ${index * 0.1}s">
        <span class="eq-solution-label">س${index + 1} =</span>
        <span class="eq-solution-value">${formatted}</span>
      </div>
    `;
  }

  /* ------------------------------------------
     محرك الحل الأساسي
     ------------------------------------------ */

  /**
   * حل المعادلة المُدخلة باستخدام Nerdamer
   * 
   * الخطوات:
   * 1. التحقق من وجود إدخال
   * 2. معالجة النص وتحويل الحروف العربية
   * 3. فصل طرفي المعادلة (إذا تضمنت علامة =)
   * 4. استدعاء nerdamer.solveEquations() للحصول على نتائج رمزية (كسور وجذور)
   * 5. تنسيق النتائج وعرضها
   * 6. معالجة الأخطاء وعرض رسالة مفيدة
   */
  function solveEquation() {
    const rawInput = inputEl.value.trim();

    // التحقق من وجود إدخال
    if (!rawInput) {
      showError('📝 يرجى كتابة معادلة أولاً');
      return;
    }

    // معالجة النص المُدخل
    const processed = preprocessInput(rawInput);

    try {
      let solList = [];

      // بناء صيغة المعادلة المناسبة لـ Nerdamer
      let equationStr;
      if (processed.includes('=')) {
        // المعادلة تحتوي على علامة مساواة بالفعل
        const parts = processed.split('=');
        if (parts.length !== 2) {
          showError('⚠️ يجب أن تحتوي المعادلة على علامة "=" واحدة فقط');
          return;
        }
        equationStr = parts[0].trim() + '=' + parts[1].trim();
      } else {
        // إذا لم تكن هناك علامة =، نفترض أن التعبير = 0
        equationStr = processed + '=0';
      }

      // ── المحاولة الأولى: استخدام solveEquations للحصول على نتائج رمزية ──
      // solveEquations يُرجع النتائج ككسور وجذور (مثل: sqrt(3), 1/2)
      // بينما solve يُرجع تقريبات عددية (مثل: 1.732...)
      try {
        var sysSolutions = nerdamer.solveEquations(equationStr, 'x');

        // solveEquations قد يُرجع مصفوفة من المصفوفات [[var, value], ...] أو مصفوفة من القيم
        if (Array.isArray(sysSolutions)) {
          sysSolutions.forEach(function (sol) {
            if (Array.isArray(sol)) {
              // صيغة [['x', 'value']]
              solList.push(sol[1] !== undefined ? sol[1].toString() : sol.toString());
            } else {
              // صيغة ['value1', 'value2']
              solList.push(sol.toString());
            }
          });
        } else {
          // كائن واحد
          solList.push(sysSolutions.toString());
        }
      } catch (e1) {
        // ── المحاولة الثانية: استخدام solve كخطة بديلة ──
        // في حالة فشل solveEquations (معادلات معقدة أو غير مدعومة)
        var eqForSolve = equationStr.split('=');
        var expression = '(' + eqForSolve[0] + ')-(' + eqForSolve[1] + ')';
        var fallbackSolutions = nerdamer.solve(expression, 'x');
        var fallbackStr = fallbackSolutions.toString();
        if (fallbackStr) {
          solList = fallbackStr.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
        }
      }

      // التحقق من وجود نتائج
      if (solList.length === 0) {
        showInfo('🔍 لا يوجد حلول حقيقية لهذه المعادلة');
        return;
      }

      // تصفية النتائج المكررة
      solList = solList.filter(function (item, index) {
        return solList.indexOf(item) === index;
      });

      // عرض النتائج
      showSolutions(solList, rawInput);

    } catch (error) {
      // معالجة الأخطاء - عرض رسالة مفيدة للمستخدم
      console.error('خطأ في حل المعادلة:', error);
      showError(getErrorMessage(error));
    }
  }

  /* ------------------------------------------
     عرض النتائج والأخطاء
     ------------------------------------------ */

  /**
   * عرض حلول المعادلة بشكل أنيق
   * @param {string[]} solutions - مصفوفة الحلول
   * @param {string} originalInput - المعادلة الأصلية
   */
  function showSolutions(solutions, originalInput) {
    const count = solutions.length;
    const headerText = count === 1 ? 'الحل:' : `الحلول (${count}):`;

    let html = `
      <div class="eq-result-success">
        <div class="eq-result-header">
          <span class="eq-result-icon">✅</span>
          <span class="eq-result-title">${headerText}</span>
        </div>
        <div class="eq-solutions-list">
          ${solutions.map((sol, i) => createSolutionCard(sol, i)).join('')}
        </div>
      </div>
    `;

    resultArea.innerHTML = html;
    resultArea.classList.add('eq-result-area--visible');
  }

  /**
   * عرض رسالة خطأ
   * @param {string} message - نص رسالة الخطأ
   */
  function showError(message) {
    resultArea.innerHTML = `
      <div class="eq-result-error">
        <span class="eq-error-icon">❌</span>
        <p class="eq-error-text">${message}</p>
        <p class="eq-error-hint">💡 تأكد من صياغة المعادلة بشكل صحيح. مثال: <code>2x^2 - 8 = 0</code></p>
      </div>
    `;
    resultArea.classList.add('eq-result-area--visible');
  }

  /**
   * عرض رسالة معلوماتية
   * @param {string} message - نص الرسالة
   */
  function showInfo(message) {
    resultArea.innerHTML = `
      <div class="eq-result-info">
        <p>${message}</p>
      </div>
    `;
    resultArea.classList.add('eq-result-area--visible');
  }

  /**
   * تحويل أخطاء JavaScript إلى رسائل عربية مفهومة
   * @param {Error} error - كائن الخطأ
   * @returns {string} رسالة الخطأ بالعربية
   */
  function getErrorMessage(error) {
    const msg = error.message || '';

    if (msg.includes('parse') || msg.includes('unexpected')) {
      return '⚠️ صيغة المعادلة غير صحيحة. تحقق من الأقواس والرموز.';
    }
    if (msg.includes('division by zero') || msg.includes('divide')) {
      return '⚠️ خطأ: قسمة على صفر!';
    }
    if (msg.includes('undefined') || msg.includes('not defined')) {
      return '⚠️ المعادلة تحتوي على رمز غير معروف.';
    }

    return `⚠️ تعذّر حل المعادلة: الصيغة غير مدعومة أو تحتوي على خطأ.`;
  }

  /**
   * مسح حقل الإدخال والنتيجة
   */
  function clearAll() {
    inputEl.value = '';
    resultArea.innerHTML = '';
    resultArea.classList.remove('eq-result-area--visible');
    inputEl.focus();
  }

  /* ------------------------------------------
     ربط الأحداث
     ------------------------------------------ */
  function bindEvents() {
    if (!solveBtn || !inputEl) return;

    // زر "أوجد قيمة س"
    solveBtn.addEventListener('click', solveEquation);

    // زر "مسح"
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAll);
    }

    // الضغط على Enter في حقل الإدخال
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        solveEquation();
      }
    });

    // مسح رسالة الخطأ عند بدء الكتابة
    inputEl.addEventListener('input', function () {
      if (resultArea.querySelector('.eq-result-error')) {
        resultArea.innerHTML = '';
        resultArea.classList.remove('eq-result-area--visible');
      }
    });
  }

  /* ------------------------------------------
     التهيئة
     ------------------------------------------ */
  function init() {
    // جلب عناصر DOM
    inputEl = document.getElementById('eq-input');
    solveBtn = document.getElementById('eq-solve-btn');
    clearBtn = document.getElementById('eq-clear-btn');
    resultArea = document.getElementById('eq-result-area');
    examplesContainer = document.getElementById('eq-examples');

    // انتظار تحميل مكتبة Nerdamer ثم ربط الأحداث
    waitForNerdamer(function () {
      bindEvents();
      initExamples();
    });
  }

  // انتظار تحميل DOM بالكامل
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
