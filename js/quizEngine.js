;(function () {
  'use strict';

  window.QuizEngine = {
    buildQuiz: buildQuiz
  };

  /**
   * بناء الاختبار السريع وإضافته إلى واجهة المستخدم
   * @param {Object} data - بيانات الاختبار (العنوان والأسئلة)
   * @param {HTMLElement} container - العنصر الذي سيتم وضع الاختبار داخله
   */
  function buildQuiz(data, container) {
    if (!container || !data || !data.questions) return;

    var quizContainer = document.createElement('div');
    quizContainer.className = 'quiz-container';

    // عنوان وتعليمات الاختبار
    var header = document.createElement('div');
    header.className = 'quiz-header';
    header.innerHTML = '<h3>اختبار: ' + data.title + '</h3><p>أجب عن جميع الأسئلة ثم اضغط على زر التحقق.</p>';
    quizContainer.appendChild(header);

    // قائمة الأسئلة
    var questionsList = document.createElement('div');
    questionsList.className = 'quiz-questions';

    data.questions.forEach(function (q, index) {
      var questionDiv = document.createElement('div');
      questionDiv.className = 'quiz-question';

      var qTitle = document.createElement('h4');
      qTitle.className = 'quiz-question__title';
      qTitle.textContent = (index + 1) + '. ' + q.question;
      questionDiv.appendChild(qTitle);

      var optionsDiv = document.createElement('div');
      optionsDiv.className = 'quiz-options';

      q.options.forEach(function (opt, optIndex) {
        var label = document.createElement('label');
        label.className = 'quiz-option';
        
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'question-' + index;
        input.value = optIndex;

        var span = document.createElement('span');
        span.textContent = opt;

        label.appendChild(input);
        label.appendChild(span);
        optionsDiv.appendChild(label);
      });

      questionDiv.appendChild(optionsDiv);
      questionsList.appendChild(questionDiv);
    });

    quizContainer.appendChild(questionsList);

    // زر التحقق والنتيجة
    var submitBtn = document.createElement('button');
    submitBtn.className = 'quiz-submit-btn';
    submitBtn.textContent = 'تحقق من إجاباتي';
    submitBtn.addEventListener('click', function () {
      checkAnswers(data.questions, quizContainer);
    });

    var resultDiv = document.createElement('div');
    resultDiv.className = 'quiz-result';
    resultDiv.style.display = 'none';

    quizContainer.appendChild(submitBtn);
    quizContainer.appendChild(resultDiv);

    container.appendChild(quizContainer);
  }

  /**
   * التحقق من إجابات المستخدم وعرض النتيجة
   */
  function checkAnswers(questions, quizContainer) {
    let score = 0;
    
    questions.forEach(function (q, index) {
      const selected = quizContainer.querySelector('input[name="question-' + index + '"]:checked');
      const questionDiv = quizContainer.querySelectorAll('.quiz-question')[index];
      
      // إزالة التنسيقات السابقة (إذا كان قد نقر من قبل)
      questionDiv.classList.remove('correct-answer', 'wrong-answer');
      const options = questionDiv.querySelectorAll('.quiz-option');
      options.forEach(opt => opt.classList.remove('highlight-correct'));
      
      if (selected && parseInt(selected.value) === q.correctAnswer) {
        score++;
        questionDiv.classList.add('correct-answer');
      } else {
        questionDiv.classList.add('wrong-answer');
        // إبراز الإجابة الصحيحة إذا أخطأ
        if (options[q.correctAnswer]) {
            options[q.correctAnswer].classList.add('highlight-correct');
        }
      }
    });

    var resultDiv = quizContainer.querySelector('.quiz-result');
    resultDiv.style.display = 'block';
    
    let message = '';
    if (score === questions.length) {
      message = 'أحسنت! أداء مثالي. ';
      resultDiv.className = 'quiz-result quiz-result--success';
    } else if (score >= questions.length / 2) {
      message = 'جيد جداً! ';
      resultDiv.className = 'quiz-result quiz-result--warning';
    } else {
      message = 'حاول مرة أخرى. يمكنك مراجعة الإجابات الصحيحة. ';
      resultDiv.className = 'quiz-result quiz-result--error';
    }
    
    resultDiv.textContent = message + 'نتيجتك هي ' + score + ' من ' + questions.length;
  }

})();
