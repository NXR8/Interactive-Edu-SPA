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
    if (!container) return; // الحاوية غير موجودة في الـ HTML

    if (!puzzle) {
      container.innerHTML = '<p class="puzzle-error-msg">تعذر تحميل لغز اليوم.</p>';
      return;
    }

    container.innerHTML = `
      <div class="puzzle-question">
        <p>${puzzle.question}</p>
      </div>
      <div class="puzzle-action">
        <button id="show-puzzle-answer" class="puzzle-btn">عرض الإجابة</button>
      </div>
      <div id="puzzle-answer" class="puzzle-answer" style="display: none;">
        <p><strong>الإجابة:</strong> ${puzzle.answer}</p>
      </div>
    `;

    // ربط حدث إظهار/إخفاء الإجابة
    const btn = document.getElementById('show-puzzle-answer');
    if (btn) {
      btn.addEventListener('click', function() {
        const ansDiv = document.getElementById('puzzle-answer');
        if (ansDiv.style.display === 'none') {
          ansDiv.style.display = 'block';
          this.textContent = 'إخفاء الإجابة';
        } else {
          ansDiv.style.display = 'none';
          this.textContent = 'عرض الإجابة';
        }
      });
    }
  }

})();
