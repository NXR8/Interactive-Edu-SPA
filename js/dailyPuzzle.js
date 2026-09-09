;(function () {
  'use strict';

  window.DailyPuzzle = {
    displayDailyPuzzle: displayDailyPuzzle
  };

  /**
   * دالة لجلب لغز اليوم بناءً على تاريخ اليوم من puzzles.json
   */
  function displayDailyPuzzle() {
    const today = new Date();
    // صيغة YYYY-MM-DD
    const dateString = today.getFullYear() + '-' + 
                       String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(today.getDate()).padStart(2, '0');

    fetch('data/puzzles.json')
      .then(function(response) {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(function(puzzles) {
        // البحث عن اللغز المطابق لتاريخ اليوم
        const todayPuzzle = puzzles.find(p => p.date === dateString);
        // في حال عدم وجود لغز لهذا اليوم، عرض أول لغز كبديل
        renderPuzzle(todayPuzzle || puzzles[0]);
      })
      .catch(function(error) {
        console.error('Error fetching daily puzzle:', error);
        renderPuzzle(null);
      });
  }

  /**
   * عرض اللغز في ವಾجهة المستخدم
   */
  function renderPuzzle(puzzle) {
    const container = document.getElementById('daily-puzzle-content');
    if (!container) return;

    if (!puzzle) {
      container.innerHTML = '<p class="puzzle-error-msg">تعذر تحميل لغز اليوم.</p>';
      return;
    }

    container.innerHTML = '';

    var questionDiv = document.createElement('div');
    questionDiv.className = 'puzzle-question';
    var questionP = document.createElement('p');
    questionP.textContent = puzzle.question;
    questionDiv.appendChild(questionP);
    container.appendChild(questionDiv);

    var actionDiv = document.createElement('div');
    actionDiv.className = 'puzzle-action';
    var showBtn = document.createElement('button');
    showBtn.id = 'show-puzzle-answer';
    showBtn.className = 'puzzle-btn';
    showBtn.textContent = 'عرض الإجابة';
    actionDiv.appendChild(showBtn);
    container.appendChild(actionDiv);

    var answerDiv = document.createElement('div');
    answerDiv.id = 'puzzle-answer';
    answerDiv.className = 'puzzle-answer';
    answerDiv.style.display = 'none';
    var answerP = document.createElement('p');
    var strong = document.createElement('strong');
    strong.textContent = 'الإجابة: ';
    answerP.appendChild(strong);
    answerP.appendChild(document.createTextNode(puzzle.answer));
    answerDiv.appendChild(answerP);
    container.appendChild(answerDiv);

    showBtn.addEventListener('click', function() {
      if (answerDiv.style.display === 'none') {
        answerDiv.style.display = 'block';
        this.textContent = 'إخفاء الإجابة';
      } else {
        answerDiv.style.display = 'none';
        this.textContent = 'عرض الإجابة';
      }
    });
  }

})();
