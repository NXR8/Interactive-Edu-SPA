/**
 * admin.js — Admin Dashboard Logic
 */

const adminApp = (function () {
  let state = {
    curriculum: { grades: [] },
    puzzles: []
  };

  // State to preserve expanded/collapsed tree nodes
  let openTreeNodes = new Set();

  // State for currently editing items
  let currentEditingNode = null; 
  let currentEditingLevel = null; // 'grade', 'subject', 'semester', 'unit', 'lesson'
  let parentListReference = null; // To allow deletion or sibling operations
  let editingPuzzleIndex = -1;

  // Paths to original JSONs (or fallback data)
  const curriculumURL = 'data/curriculum.json';
  const puzzlesURL = 'data/puzzles.json';

  // --- Init ---
  async function init() {
    setupTabs();
    setupModals();
    await loadData();
    renderCurriculumTree();
    renderPuzzlesList();
    setupExportButtons();
  }

  async function loadData() {
    try {
      const cRes = await fetch(curriculumURL);
      if (cRes.ok) state.curriculum = await cRes.json();
    } catch (e) {
      console.warn("Failed to load curriculum.json, starting empty.");
    }
    
    try {
      const pRes = await fetch(puzzlesURL);
      if (pRes.ok) state.puzzles = await pRes.json();
    } catch (e) {
      console.warn("Failed to load puzzles.json, starting empty.");
    }
  }

  // --- Tabs ---
  function setupTabs() {
    const tabs = document.querySelectorAll('.admin-tabs .tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-main .tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    const lTabs = document.querySelectorAll('.lesson-tabs .lesson-tab-btn');
    lTabs.forEach(btn => {
      btn.addEventListener('click', (e) => {
        lTabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.lesson-tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.ltab).classList.add('active');
      });
    });
  }

  // --- Helpers ---
  function generateId(prefix) {
    return prefix + '-' + Math.random().toString(36).substr(2, 6);
  }

  // --- Validation ---
  function isIdUnique(testId, ignoreObj) {
    let unique = true;
    function checkLevel(arr) {
      if (!arr) return;
      for (const item of arr) {
        if (item.id === testId && item !== ignoreObj) {
          unique = false;
          return;
        }
        if (item.subjects) checkLevel(item.subjects);
        if (item.semesters) checkLevel(item.semesters);
        if (item.units) checkLevel(item.units);
        if (item.lessons) checkLevel(item.lessons);
      }
    }
    checkLevel(state.curriculum.grades);
    return unique;
  }

  function validateIdInput(inputEl, feedbackEl, ignoreObj) {
    const val = inputEl.value.trim();
    if (!val) {
      inputEl.className = 'id-input is-invalid';
      feedbackEl.innerText = 'المعرف لا يمكن أن يكون فارغاً';
      feedbackEl.className = 'feedback-msg error';
      return false;
    }
    
    if (isIdUnique(val, ignoreObj)) {
      inputEl.className = 'id-input is-valid';
      feedbackEl.innerText = 'المعرف متاح ومقبول';
      feedbackEl.className = 'feedback-msg success';
      return true;
    } else {
      inputEl.className = 'id-input is-invalid';
      feedbackEl.innerText = 'هذا المعرف مستخدم مسبقاً بالشجرة!';
      feedbackEl.className = 'feedback-msg error';
      return false;
    }
  }

  // ==========================================
  // CURRICULUM TREE RENDER
  // ==========================================
  function renderCurriculumTree() {
    const container = document.getElementById('curriculum-tree-container');
    container.innerHTML = '';
    
    if (!state.curriculum.grades || state.curriculum.grades.length === 0) {
      container.innerHTML = '<p class="loading-msg">لا يوجد مناهج حالياً.</p>';
      return;
    }

    state.curriculum.grades.forEach((grade, gIdx) => {
      container.appendChild(createNodeElement(grade, 'grade', state.curriculum.grades, 'مادة'));
    });
  }

  function createNodeElement(obj, level, parentArr, childAddLabel) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = `tree-node level-${level}`;
    
    const header = document.createElement('div');
    header.className = 'tree-node-header';
    
    // Expand/Collapse Toggle (if not lesson)
    if (level !== 'lesson') {
      const toggleBtn = document.createElement('span');
      toggleBtn.className = 'tree-node-toggle';
      toggleBtn.innerText = '▶';
      if (openTreeNodes.has(obj.id)) {
        toggleBtn.classList.add('open');
      }
      toggleBtn.onclick = () => {
        if (openTreeNodes.has(obj.id)) {
          openTreeNodes.delete(obj.id);
        } else {
          openTreeNodes.add(obj.id);
        }
        renderCurriculumTree(); // Re-render tree to apply changes
      };
      header.appendChild(toggleBtn);
    }

    const title = document.createElement('div');
    title.className = 'tree-node-title';
    title.innerText = `${obj.icon ? obj.icon + ' ' : ''}${obj.name || obj.title}`;
    
    const actions = document.createElement('div');
    actions.className = 'node-actions';
    
    // Edit Button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit';
    editBtn.innerText = 'تعديل';
    editBtn.onclick = () => level === 'lesson' ? openLessonModal(obj, parentArr) : openBasicNodeModal(obj, level, parentArr);
    actions.appendChild(editBtn);

    // Add Child Button (if not lesson)
    if (level !== 'lesson') {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-add';
      addBtn.innerText = '+ ' + childAddLabel;
      addBtn.onclick = () => addChildToNode(obj, level);
      actions.appendChild(addBtn);
    }

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.innerText = 'حذف';
    delBtn.onclick = () => deleteNode(obj, parentArr);
    actions.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(actions);
    nodeDiv.appendChild(header);

    // Children rendering
    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    if (openTreeNodes.has(obj.id)) {
      childrenDiv.classList.add('open');
    }
    
    if (level === 'grade' && obj.subjects) {
      obj.subjects.forEach(subj => childrenDiv.appendChild(createNodeElement(subj, 'subject', obj.subjects, 'فصل دراسي')));
    } else if (level === 'subject' && obj.semesters) {
      obj.semesters.forEach(sem => childrenDiv.appendChild(createNodeElement(sem, 'semester', obj.semesters, 'وحدة')));
    } else if (level === 'semester' && obj.units) {
      obj.units.forEach(unit => childrenDiv.appendChild(createNodeElement(unit, 'unit', obj.units, 'درس')));
    } else if (level === 'unit' && obj.lessons) {
      obj.lessons.forEach(lesson => childrenDiv.appendChild(createNodeElement(lesson, 'lesson', obj.lessons, '')));
    }
    
    if (childrenDiv.hasChildNodes()) {
      nodeDiv.appendChild(childrenDiv);
    }

    return nodeDiv;
  }

  // ==========================================
  // NODE OPERATIONS
  // ==========================================
  function deleteNode(obj, parentArr) {
    if(confirm(`هل أنت متأكد من حذف "${obj.name || obj.title}" ومحتوياته؟`)) {
      const idx = parentArr.indexOf(obj);
      if(idx > -1) parentArr.splice(idx, 1);
      renderCurriculumTree();
    }
  }

  function addGrade() {
    if(!state.curriculum.grades) state.curriculum.grades = [];
    state.curriculum.grades.push({ id: generateId('grade'), name: "صف جديد", icon: "📚", subjects: [] });
    renderCurriculumTree();
  }

  function addChildToNode(obj, level) {
    if (level === 'grade') {
      if(!obj.subjects) obj.subjects = [];
      obj.subjects.push({ id: generateId('subj'), name: "مادة جديدة", icon: "📘", semesters: [] });
    } else if (level === 'subject') {
      if(!obj.semesters) obj.semesters = [];
      obj.semesters.push({ id: generateId('sem'), name: "فصل دراسي جديد", units: [] });
    } else if (level === 'semester') {
      if(!obj.units) obj.units = [];
      obj.units.push({ id: generateId('unit'), name: "وحدة جديدة", lessons: [] });
    } else if (level === 'unit') {
      if(!obj.lessons) obj.lessons = [];
      obj.lessons.push({ id: generateId('les'), title: "درس جديد", quiz: [] });
    }
    openTreeNodes.add(obj.id); // Expand parent to show the new child immediately
    renderCurriculumTree();
  }

  // ==========================================
  // MODALS
  // ==========================================
  function setupModals() {
    window.onclick = function(event) {
      if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
      }
    }
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  // -- Basic Node Modal (Grade, Subject, Semester, Unit) --
  function openBasicNodeModal(obj, level, parentArr) {
    currentEditingNode = obj;
    currentEditingLevel = level;

    document.getElementById('node-id').value = obj.id;
    document.getElementById('node-id').className = 'id-input';
    document.getElementById('node-id-feedback').innerText = '';
    
    document.getElementById('node-name').value = obj.name;
    
    if (level === 'grade' || level === 'subject') {
      document.getElementById('node-icon-group').style.display = 'block';
      document.getElementById('node-icon').value = obj.icon || '';
    } else {
      document.getElementById('node-icon-group').style.display = 'none';
      document.getElementById('node-icon').value = '';
    }

    if (level === 'subject') {
      document.getElementById('node-book-group').style.display = 'block';
      document.getElementById('node-book').value = obj.bookUrl || '';
    } else {
      document.getElementById('node-book-group').style.display = 'none';
      document.getElementById('node-book').value = '';
    }

    document.getElementById('basic-node-modal').classList.add('active');
  }

  function saveBasicNode() {
    if(!currentEditingNode) return;
    
    const idInput = document.getElementById('node-id');
    if (!validateIdInput(idInput, document.getElementById('node-id-feedback'), currentEditingNode)) {
       alert("الرجاء تصحيح المعرف (ID) قبل الحفظ");
       return;
    }
    
    currentEditingNode.id = idInput.value.trim();
    currentEditingNode.name = document.getElementById('node-name').value;
    
    if (currentEditingLevel === 'grade' || currentEditingLevel === 'subject') {
      currentEditingNode.icon = document.getElementById('node-icon').value;
    }
    
    // Manage bookUrl precisely at the subject level
    if (currentEditingLevel === 'subject') {
      const bUrl = document.getElementById('node-book').value.trim();
      if (bUrl) currentEditingNode.bookUrl = bUrl; else delete currentEditingNode.bookUrl;
    }

    closeModal('basic-node-modal');
    renderCurriculumTree();
  }

  // -- Lesson Modal --
  function openLessonModal(lesson, parentArr) {
    currentEditingNode = lesson;
    
    // reset tabs
    document.querySelectorAll('.lesson-tab-btn')[0].click();

    document.getElementById('lesson-id').value = lesson.id;
    document.getElementById('lesson-id').className = 'id-input';
    document.getElementById('lesson-id-feedback').innerText = '';

    document.getElementById('lesson-title').value = lesson.title || '';
    document.getElementById('lesson-video').value = lesson.videoUrl || '';
    document.getElementById('lesson-summary').value = lesson.summaryUrl || '';
    document.getElementById('lesson-exams').value = lesson.pastExamsUrl || '';

    renderQuizManager();

    document.getElementById('lesson-modal').classList.add('active');
  }

  function renderQuizManager() {
    const container = document.getElementById('quiz-questions-container');
    container.innerHTML = '';
    
    const questions = currentEditingNode.quiz || [];
    
    if (questions.length === 0) {
      container.innerHTML = '<p class="loading-msg">لا يوجد أسئلة. أضف سؤالاً جديداً.</p>';
      return;
    }

    questions.forEach((q, qIdx) => {
      const qBox = document.createElement('div');
      qBox.className = 'quiz-question-box';

      // Delete Question Btn
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-question-btn';
      delBtn.innerText = 'حذف';
      delBtn.onclick = () => {
        questions.splice(qIdx, 1);
        renderQuizManager();
      };
      qBox.appendChild(delBtn);

      // Question Text
      const qLabel = document.createElement('label');
      qLabel.innerText = 'نص السؤال:';
      const qInput = document.createElement('input');
      qInput.type = 'text';
      qInput.className = 'q-text-input';
      qInput.value = q.question || '';
      qInput.onchange = (e) => q.question = e.target.value;
      
      const formGroup1 = document.createElement('div');
      formGroup1.className = 'form-group';
      formGroup1.appendChild(qLabel);
      formGroup1.appendChild(qInput);
      qBox.appendChild(formGroup1);

      // Options
      const optionsTitle = document.createElement('strong');
      optionsTitle.innerText = 'الخيارات:';
      qBox.appendChild(optionsTitle);

      const optsList = document.createElement('div');
      optsList.className = 'options-list';
      
      if (!q.options) q.options = [];
      if (q.options.length === 0) {
        q.options = ["الخيار 1", "الخيار 2"]; // Default min 2 options
      }
      
      q.options.forEach((optStr, optIdx) => {
        const item = document.createElement('div');
        item.className = 'option-item';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `correct_q_${qIdx}`;
        radio.checked = (q.correctAnswer === optIdx);
        radio.onchange = () => { q.correctAnswer = optIdx; renderQuizManager(); };

        const optInput = document.createElement('input');
        optInput.type = 'text';
        optInput.value = optStr;
        optInput.onchange = (e) => { q.options[optIdx] = e.target.value; };

        const delOpt = document.createElement('button');
        delOpt.innerText = '✕';
        delOpt.onclick = () => {
          q.options.splice(optIdx, 1);
          if(q.correctAnswer === optIdx) q.correctAnswer = 0;
          renderQuizManager();
        };

        item.appendChild(radio);
        item.appendChild(optInput);
        item.appendChild(delOpt);
        optsList.appendChild(item);
      });

      // Add Option Btn
      const addOptBtn = document.createElement('button');
      addOptBtn.className = 'btn-add';
      addOptBtn.style.marginTop = '10px';
      addOptBtn.innerText = '+ أضف خيار';
      addOptBtn.onclick = () => {
        q.options.push("خيار جديد");
        renderQuizManager();
      };
      
      optsList.appendChild(addOptBtn);
      qBox.appendChild(optsList);
      
      // Note
      const note = document.createElement('p');
      note.style.fontSize = '0.8rem';
      note.style.color = '#ccc';
      note.innerText = '* اختر الزر الدائري (Radio) لتحديد الإجابة الصحيحة الجاهزة.';
      qBox.appendChild(note);

      container.appendChild(qBox);
    });
  }

  function addQuestionToCurrentLesson() {
    if(!currentEditingNode.quiz) currentEditingNode.quiz = [];
    currentEditingNode.quiz.push({
      question: "سؤال جديد؟",
      options: ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
      correctAnswer: 0
    });
    renderQuizManager();
  }

  function saveLesson() {
    if(!currentEditingNode) return;
    
    const idInput = document.getElementById('lesson-id');
    if (!validateIdInput(idInput, document.getElementById('lesson-id-feedback'), currentEditingNode)) {
       alert("الرجاء تصحيح المعرف (ID) للدرس قبل الحفظ");
       return;
    }
    
    currentEditingNode.id = idInput.value.trim();
    currentEditingNode.title = document.getElementById('lesson-title').value;
    
    // Clean Empty URLs
    const v = document.getElementById('lesson-video').value.trim();
    if(v) currentEditingNode.videoUrl = v; else delete currentEditingNode.videoUrl;

    const s = document.getElementById('lesson-summary').value.trim();
    if(s) currentEditingNode.summaryUrl = s; else delete currentEditingNode.summaryUrl;

    const eUrl = document.getElementById('lesson-exams').value.trim();
    if(eUrl) currentEditingNode.pastExamsUrl = eUrl; else delete currentEditingNode.pastExamsUrl;

    // Clean empty quiz
    if(currentEditingNode.quiz && currentEditingNode.quiz.length === 0) {
      delete currentEditingNode.quiz;
    }

    closeModal('lesson-modal');
    renderCurriculumTree();
  }

  // ==========================================
  // PUZZLES MANAGER
  // ==========================================
  function renderPuzzlesList() {
    const container = document.getElementById('puzzles-list-container');
    container.innerHTML = '';
    
    if (state.puzzles.length === 0) {
      container.innerHTML = '<p class="loading-msg">لا توجد ألغاز.</p>';
      return;
    }

    state.puzzles.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'puzzle-card';
      
      card.innerHTML = `
        <div class="puzzle-card-date">📅 ${p.date}</div>
        <div class="puzzle-card-q">${p.question}</div>
        <div class="puzzle-card-a">الحل: ${p.answer}</div>
        ${p.explanation ? `<div style="font-size:0.8rem; color:#aaa; margin-top:5px;">شرح: ${p.explanation}</div>` : ''}
      `;

      const actions = document.createElement('div');
      actions.className = 'puzzle-card-actions node-actions';
      
      const eBtn = document.createElement('button');
      eBtn.className = 'btn-edit';
      eBtn.innerText = 'تعديل';
      eBtn.onclick = () => openPuzzleModal(idx);
      
      const dBtn = document.createElement('button');
      dBtn.className = 'btn-delete';
      dBtn.innerText = 'حذف';
      dBtn.onclick = () => {
        if(confirm('حذف هذا اللغز؟')) {
          state.puzzles.splice(idx, 1);
          renderPuzzlesList();
        }
      };

      actions.appendChild(eBtn);
      actions.appendChild(dBtn);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  function openPuzzleModal(idx = -1) {
    editingPuzzleIndex = idx;
    if (idx > -1) {
      const p = state.puzzles[idx];
      document.getElementById('puzzle-date').value = p.date || '';
      document.getElementById('puzzle-question').value = p.question || '';
      document.getElementById('puzzle-answer').value = p.answer || '';
    } else {
      document.getElementById('puzzle-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('puzzle-question').value = '';
      document.getElementById('puzzle-answer').value = '';
    }
    document.getElementById('puzzle-modal').classList.add('active');
  }

  function savePuzzle() {
    const p = {
      date: document.getElementById('puzzle-date').value,
      question: document.getElementById('puzzle-question').value,
      answer: document.getElementById('puzzle-answer').value
    };

    if (editingPuzzleIndex > -1) {
      state.puzzles[editingPuzzleIndex] = p;
    } else {
      state.puzzles.push(p);
    }

    closeModal('puzzle-modal');
    renderPuzzlesList();
  }

  // ==========================================
  // EXPORT
  // ==========================================
  function validateAllIds() {
    const ids = new Set();
    const duplicates = new Set();

    function collectIds(arr) {
      if (!arr) return;
      for (const item of arr) {
        if (item.id) {
          if (ids.has(item.id)) {
            duplicates.add(item.id);
          } else {
            ids.add(item.id);
          }
        }
        if (item.subjects) collectIds(item.subjects);
        if (item.semesters) collectIds(item.semesters);
        if (item.units) collectIds(item.units);
        if (item.lessons) collectIds(item.lessons);
      }
    }
    
    collectIds(state.curriculum.grades);
    
    if (duplicates.size > 0) {
       alert("فشل التصدير! عُثر على معرفات مكررة في المنهج:\n" + Array.from(duplicates).join(', '));
       return false;
    }
    return true;
  }

  function setupExportButtons() {
    document.getElementById('export-curriculum-btn').addEventListener('click', () => {
      if (validateAllIds()) {
        downloadJSON(state.curriculum, 'curriculum.json');
      }
    });

    document.getElementById('export-puzzles-btn').addEventListener('click', () => {
      downloadJSON(state.puzzles, 'puzzles.json');
    });
    
    // Setup Live Validation Listeners
    document.getElementById('node-id').addEventListener('input', (e) => {
      validateIdInput(e.target, document.getElementById('node-id-feedback'), currentEditingNode);
    });
    document.getElementById('lesson-id').addEventListener('input', (e) => {
      validateIdInput(e.target, document.getElementById('lesson-id-feedback'), currentEditingNode);
    });
  }

  function downloadJSON(data, filename) {
    // Stringify with 2 spaces for formatting
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Expose API
  return {
    init,
    addGrade,
    openBasicNodeModal,
    saveBasicNode,
    closeModal,
    openPuzzleModal,
    savePuzzle,
    openLessonModal,
    saveLesson,
    addQuestionToCurrentLesson
  };

})();

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', adminApp.init);
