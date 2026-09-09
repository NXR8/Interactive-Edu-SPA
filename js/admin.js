/**
 * admin.js — لوحة التحكم المؤمنة والمربوطة بالباك إند (مبسطة وبدون ميزة رفع الملفات)
 */
const adminApp = (function () {
  // === الحالة الداخلية ===
  let state = { curriculum: { grades: [] }, puzzles: [] };
  let openTreeNodes = new Set();
  let currentEditingNode = null;
  let currentEditingLevel = null;
  let editingPuzzleIndex = -1;

  const API = '';
  const getToken = () => localStorage.getItem('admin_token');

  // === دوال مساعدة ===
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  // === دالة مساعدة للطلبات المؤمنة ===
  async function authFetch(url, opts = {}) {
    const token = getToken();
    if (!token) { handleLogout(); throw new Error('لا يوجد توكن'); }
    opts.headers = { 
      ...(opts.headers || {}), 
      'Authorization': 'Bearer ' + token 
    };
    const res = await fetch(API + url, opts);
    if (res.status === 401 || res.status === 403) { handleLogout(); throw new Error('جلسة منتهية'); }
    return res;
  }

  // === إشعارات Toast ===
  function showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { 
      t.classList.add('toast--hide'); 
      setTimeout(() => t.remove(), 400); 
    }, 3000);
  }

  // === المصادقة ===
  function checkAuth() {
    if (getToken()) { showDashboard(); } else { showLogin(); }
  }

  // إظهار شاشة الدخول
  function showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
  }

  // إظهار لوحة التحكم بعد التحقق
  function showDashboard() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    loadData();
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    showLogin();
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit-btn');
    
    errEl.style.display = 'none';
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loader').style.display = 'inline';

    try {
      const body = new URLSearchParams({ username: email, password: pass });
      const res = await fetch(API + '/api/auth/login', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      localStorage.setItem('admin_token', data.access_token);
      const meRes = await authFetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.role !== 'admin') {
        localStorage.removeItem('admin_token');
        throw new Error('ليس لديك صلاحية الوصول إلى لوحة التحكم');
      }
      showDashboard();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.querySelector('.btn-text').style.display = 'inline';
      btn.querySelector('.btn-loader').style.display = 'none';
    }
  }

  // === تحميل البيانات من السيرفر ===
  async function loadData() {
    try {
      const cRes = await fetch(API + '/api/curriculum');
      if (cRes.ok) {
        const raw = await cRes.json();
        state.curriculum = convertFromDB(raw);
      }
    } catch (e) { console.warn('فشل تحميل المنهج:', e); }
    
    try {
      const pRes = await fetch('data/puzzles.json');
      if (pRes.ok) state.puzzles = await pRes.json();
    } catch (e) { console.warn('فشل تحميل الألغاز:', e); }
    
    try {
      renderCurriculumTree();
    } catch (e) {
      console.error('فشل رسم الشجرة:', e);
      showToast('❌ فشل تحميل الشجرة', 'error');
    }
    try {
      renderPuzzlesList();
    } catch (e) {
      console.error('فشل رسم الألغاز:', e);
    }
  }

  // تحويل البيانات من الهيكل العلائقي لقاعدة البيانات إلى الشكل المطلوب للشجرة في الـ UI
  function convertFromDB(raw) {
    if (!raw || !Array.isArray(raw.grades)) return { grades: [] };
    const grades = raw.grades.filter(Boolean).map(g => ({
      id: g.id, name: g.name || '', icon: g.icon || '',
      subjects: (g.subjects || []).filter(Boolean).map(s => ({
        id: s.id, name: s.name || '', icon: s.icon || '', bookUrl: s.bookUrl || s.book_url || '',
        semesters: (s.semesters || []).filter(Boolean).map(sem => ({
          id: sem.id, name: sem.name || '', bookUrl: sem.bookUrl || sem.book_url || '',
          units: (sem.units || []).filter(Boolean).map(u => ({
            id: u.id, name: u.name || '',
            lessons: (u.lessons || []).filter(Boolean).map(l => {
              const lesson = {
                id: l.id, title: l.title || '',
                is_private: !!l.is_private,
                quiz: Array.isArray(l.quiz) ? l.quiz : [],
                resources: Array.isArray(l.resources) ? l.resources.map(r => ({
                  type: r.type || 'link', url: r.url || '', title: r.title || ''
                })).filter(r => r.url) : []
              };
              return lesson;
            })
          }))
        }))
      }))
    }));
    return { grades };
  }

  // === التبويبات ===
  function setupTabs() {
    document.querySelectorAll('.admin-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-tabs .tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-main .tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'analytics-tab') loadAnalytics();
        if (btn.dataset.tab === 'users-tab') loadUsers();
      });
    });
    
    document.querySelectorAll('.lesson-tabs .lesson-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lesson-tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.lesson-tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.ltab).classList.add('active');
      });
    });
  }

  // === Modals ===
  function setupModals() {
    window.onclick = e => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };
  }
  function closeModal(id) { document.getElementById(id).classList.remove('active'); }

  // === أدوات مساعدة ===
  function generateId(prefix) { return prefix + '-' + Math.random().toString(36).substr(2, 6); }

  // === شجرة المنهج ===
  function renderCurriculumTree() {
    const c = document.getElementById('curriculum-tree-container');
    c.innerHTML = '';
    if (!state.curriculum.grades?.length) { c.innerHTML = '<p class="loading-msg">لا يوجد مناهج حالياً.</p>'; return; }
    state.curriculum.grades.forEach(g => c.appendChild(createNodeEl(g, 'grade', state.curriculum.grades, 'مادة', {})));
  }

  function createNodeEl(obj, level, parentArr, childLabel, context) {
    const div = document.createElement('div');
    div.className = 'tree-node level-' + level;
    const header = document.createElement('div');
    header.className = 'tree-node-header';

    if (level !== 'lesson') {
      const tog = document.createElement('span');
      tog.className = 'tree-node-toggle' + (openTreeNodes.has(obj.id) ? ' open' : '');
      tog.innerText = '▶';
      tog.onclick = function(ev) {
        ev.stopPropagation();
        try {
          const childrenDiv = div.querySelector('.tree-children');
          if (childrenDiv) {
            childrenDiv.classList.toggle('open');
            tog.classList.toggle('open');
            if (childrenDiv.classList.contains('open')) {
              openTreeNodes.add(obj.id);
            } else {
              openTreeNodes.delete(obj.id);
            }
          }
        } catch (e) {
          console.error('Toggle error:', e);
        }
      };
      header.appendChild(tog);
    }

    const title = document.createElement('div');
    title.className = 'tree-node-title';
    title.innerText = (obj.icon ? obj.icon + ' ' : '') + (obj.name || obj.title);
    if (level === 'lesson' && obj.is_private) {
      title.innerHTML += ' <span style="font-size:11px;color:#fdcb6e;">🔒</span>';
    }

    const acts = document.createElement('div');
    acts.className = 'node-actions';

    // بناء سياق المسار للرفع
    const childContext = Object.assign({}, context);
    if (level === 'grade') childContext.gradeName = obj.name || '';
    else if (level === 'subject') childContext.subjectName = obj.name || '';
    else if (level === 'semester') childContext.semesterName = obj.name || '';
    else if (level === 'unit') childContext.unitName = obj.name || '';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit'; editBtn.innerText = 'تعديل';
    editBtn.onclick = function(ev) {
      ev.stopPropagation();
      try {
        if (typeof obj === 'object' && obj) obj._uploadContext = childContext;
        if (level === 'lesson') {
          openLessonModal(obj, parentArr);
        } else {
          openBasicNodeModal(obj, level, childContext);
        }
      } catch (e) {
        console.error('Edit click error:', e);
        showToast('❌ تعذر فتح نافذة التعديل: ' + e.message, 'error');
      }
    };
    acts.appendChild(editBtn);

    if (level !== 'lesson') {
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-add'; addBtn.innerText = '+ ' + childLabel;
      addBtn.onclick = function(ev) {
        ev.stopPropagation();
        try {
          addChildToNode(obj, level);
        } catch (e) {
          console.error('Add error:', e);
        }
      };
      acts.appendChild(addBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete'; delBtn.innerText = 'حذف';
    delBtn.onclick = function(ev) {
      ev.stopPropagation();
      try {
        if (confirm('هل أنت متأكد من حذف "' + (obj.name || obj.title) + '"؟')) {
          const i = parentArr.indexOf(obj);
          if (i > -1) parentArr.splice(i, 1);
          renderCurriculumTree();
        }
      } catch (e) {
        console.error('Delete error:', e);
      }
    };
    acts.appendChild(delBtn);

    header.appendChild(title);
    header.appendChild(acts);
    div.appendChild(header);

    const children = document.createElement('div');
    children.className = 'tree-children' + (openTreeNodes.has(obj.id) ? ' open' : '');
    const map = { grade: ['subjects', 'subject', 'فصل دراسي'], subject: ['semesters', 'semester', 'وحدة'], semester: ['units', 'unit', 'درس'], unit: ['lessons', 'lesson', ''] };
    if (map[level] && obj[map[level][0]]) {
      obj[map[level][0]].forEach(ch => children.appendChild(createNodeEl(ch, map[level][1], obj[map[level][0]], map[level][2], childContext)));
    }
    if (children.hasChildNodes()) div.appendChild(children);
    return div;
  }

  function addGrade() {
    if (!state.curriculum.grades) state.curriculum.grades = [];
    state.curriculum.grades.push({ id: generateId('grade'), name: 'صف جديد', icon: '📚', subjects: [] });
    renderCurriculumTree();
  }

  function addChildToNode(obj, level) {
    const defs = {
      grade: ['subjects', { id: generateId('subj'), name: 'مادة جديدة', icon: '📘', semesters: [] }],
      subject: ['semesters', { id: generateId('sem'), name: 'فصل دراسي جديد', units: [] }],
      semester: ['units', { id: generateId('unit'), name: 'وحدة جديدة', lessons: [] }],
      unit: ['lessons', { id: generateId('les'), title: 'درس جديد', quiz: [], resources: [] }]
    };
    const [key, def] = defs[level];
    if (!obj[key]) obj[key] = [];
    obj[key].push(def);
    openTreeNodes.add(obj.id);
    renderCurriculumTree();
  }

  // === Modal العنصر الأساسي (صف، مادة، فصل، وحدة) ===
  function openBasicNodeModal(obj, level, context) {
    currentEditingNode = obj;
    currentEditingLevel = level;
    if (context) obj._uploadContext = context;
    document.getElementById('node-name').value = obj.name;
    if (level === 'grade' || level === 'subject') {
      document.getElementById('node-icon-group').style.display = 'block';
      document.getElementById('node-icon').value = obj.icon || '';
    } else {
      document.getElementById('node-icon-group').style.display = 'none';
    }
    if (level === 'subject') {
      document.getElementById('node-book-group').style.display = 'block';
      document.getElementById('node-book').value = obj.bookUrl || '';
      document.getElementById('node-book-upload-btn').style.display = '';
    } else {
      document.getElementById('node-book-group').style.display = 'none';
      document.getElementById('node-book-upload-btn').style.display = 'none';
    }
    if (level === 'semester') {
      console.log('DOM - Opening Modal. Node data:', obj);
      document.getElementById('node-semester-book-group').style.display = 'block';
      document.getElementById('node-semester-book').value = obj.bookUrl || '';
    } else {
      document.getElementById('node-semester-book-group').style.display = 'none';
    }
    document.getElementById('basic-node-modal').classList.add('active');
  }

  function saveBasicNode() {
    if (!currentEditingNode) return;
    currentEditingNode.name = document.getElementById('node-name').value;
    if (currentEditingLevel === 'grade' || currentEditingLevel === 'subject')
      currentEditingNode.icon = document.getElementById('node-icon').value;
    if (currentEditingLevel === 'subject') {
      const typed = document.getElementById('node-book').value.trim();
      if (typed) currentEditingNode.bookUrl = typed;
      else delete currentEditingNode.bookUrl;
    }
    if (currentEditingLevel === 'semester') {
      currentEditingNode.bookUrl = document.getElementById('node-semester-book').value;
    }
    closeModal('basic-node-modal');
    renderCurriculumTree();
  }

  // === Modal الدرس ===
  function openLessonModal(lesson, parentArr) {
    currentEditingNode = lesson;
    // التأكد من وجود البيانات الأساسية
    if (!lesson.resources) lesson.resources = [];
    if (!lesson.quiz) lesson.quiz = [];
    // تفعيل التبويب الأول
    var firstTab = document.querySelectorAll('.lesson-tab-btn')[0];
    if (firstTab) firstTab.click();
    // تعبئة الحقول
    var titleEl = document.getElementById('lesson-title');
    if (titleEl) titleEl.value = lesson.title || '';
    var privateEl = document.getElementById('lesson-private');
    if (privateEl) privateEl.checked = lesson.is_private || false;
    // عرض المحتوى الديناميكي
    try {
      renderResourcesManager();
    } catch (e) {
      console.error('renderResourcesManager error:', e);
    }
    try {
      renderQuizManager();
    } catch (e) {
      console.error('renderQuizManager error:', e);
    }
    // إظهار النافذة
    var modal = document.getElementById('lesson-modal');
    if (modal) modal.classList.add('active');
  }

  function saveLesson() {
    if (!currentEditingNode) return;
    currentEditingNode.title = document.getElementById('lesson-title').value;
    currentEditingNode.is_private = document.getElementById('lesson-private').checked;
    // تنظيف المصادر: إزالة المصادر الفارغة والقديمة
    currentEditingNode.resources = (currentEditingNode.resources || []).filter(r => r.url && r.url.trim().length > 0);
    // إزالة الحقول المسطحة القديمة إن وجدت
    delete currentEditingNode.videoUrl;
    delete currentEditingNode.summaryUrl;
    delete currentEditingNode.pastExamsUrl;
    // التحقق من صحة الأسئلة: كل سؤال يجب أن يحتوي على خيارين مختلفين على الأقل
    if (currentEditingNode.quiz) {
      for (let i = 0; i < currentEditingNode.quiz.length; i++) {
        const q = currentEditingNode.quiz[i];
        const validOptions = (q.options || []).filter(o => o && o.trim().length > 0);
        if (validOptions.length < 2) {
          showToast(`❌ السؤال ${i + 1} يجب أن يحتوي على خيارين مختلفين على الأقل`, 'error');
          return;
        }
      }
    }
    if (currentEditingNode.quiz?.length === 0) delete currentEditingNode.quiz;
    closeModal('lesson-modal');
    renderCurriculumTree();
  }

  // === إدارة الكويزات (Quiz Manager) ===
  function renderQuizManager() {
    const c = document.getElementById('quiz-questions-container');
    c.innerHTML = '';
    const questions = currentEditingNode.quiz || [];
    if (!questions.length) { c.innerHTML = '<p class="loading-msg">لا يوجد أسئلة. أضف سؤالاً جديداً.</p>'; return; }

    questions.forEach((q, qi) => {
      const box = document.createElement('div');
      box.className = 'quiz-question-box';

      const del = document.createElement('button');
      del.className = 'delete-question-btn'; del.innerText = 'حذف';
      del.onclick = () => { questions.splice(qi, 1); renderQuizManager(); };
      box.appendChild(del);

      const fg = document.createElement('div');
      fg.className = 'form-group';
      const lbl = document.createElement('label'); lbl.innerText = 'نص السؤال:';
      const inp = document.createElement('input'); inp.type = 'text'; inp.value = q.question || '';
      inp.onchange = e => q.question = e.target.value;
      fg.appendChild(lbl); fg.appendChild(inp); box.appendChild(fg);

      const ot = document.createElement('strong'); ot.innerText = 'الخيارات:';
      box.appendChild(ot);

      const ol = document.createElement('div'); ol.className = 'options-list';
      if (!q.options) q.options = [];
      if (!q.options.length) q.options = ['الخيار 1', 'الخيار 2'];

      q.options.forEach((opt, oi) => {
        const item = document.createElement('div'); item.className = 'option-item';
        const radio = document.createElement('input'); radio.type = 'radio';
        radio.name = 'cq_' + qi; radio.checked = q.correctAnswer === oi;
        radio.onchange = () => { q.correctAnswer = oi; };
        const oinp = document.createElement('input'); oinp.type = 'text'; oinp.value = opt;
        oinp.onchange = e => { q.options[oi] = e.target.value; };
        const dx = document.createElement('button'); dx.innerText = '✕';
        dx.onclick = () => { q.options.splice(oi, 1); if (q.correctAnswer === oi) q.correctAnswer = 0; renderQuizManager(); };
        item.appendChild(radio); item.appendChild(oinp); item.appendChild(dx); ol.appendChild(item);
      });

      const addO = document.createElement('button');
      addO.className = 'btn-add'; addO.style.marginTop = '10px'; addO.innerText = '+ خيار';
      addO.onclick = () => { q.options.push('خيار جديد'); renderQuizManager(); };
      ol.appendChild(addO); box.appendChild(ol); c.appendChild(box);
    });
  }

  function addQuestionToCurrentLesson() {
    if (!currentEditingNode.quiz) currentEditingNode.quiz = [];
    currentEditingNode.quiz.push({ question: 'سؤال جديد؟', options: ['خيار 1', 'خيار 2', 'خيار 3', 'خيار 4'], correctAnswer: 0 });
    renderQuizManager();
  }

  // === إدارة المصادر التعليمية الديناميكية ===
  function renderResourcesManager() {
    const container = document.getElementById('lesson-resources-container');
    container.innerHTML = '';
    const resources = currentEditingNode.resources || [];
    if (!resources.length) {
      container.innerHTML = '<p class="loading-msg">لا توجد مصادر. أضف مصدراً جديداً.</p>';
      return;
    }
    resources.forEach((res, idx) => {
      const item = document.createElement('div');
      item.className = 'resource-item';

      const typeSel = document.createElement('select');
      typeSel.className = 'resource-type-select';
      ['video', 'pdf', 'link'].forEach(t => {
        const o = document.createElement('option');
        o.value = t;
        o.textContent = { video: '🎬 فيديو', pdf: '📄 PDF', link: '🔗 رابط' }[t] || t;
        if (res.type === t) o.selected = true;
        typeSel.appendChild(o);
      });
      const uploadBtn = document.createElement('button');
      uploadBtn.type = 'button';
      uploadBtn.className = 'upload-btn';
      uploadBtn.textContent = '📤 رفع';
      uploadBtn.title = 'رفع ملف PDF';
      uploadBtn.onclick = () => triggerResourceUpload(idx);

      function updateUploadBtnVisibility() {
        uploadBtn.style.display = res.type === 'pdf' ? '' : 'none';
      }

      typeSel.onchange = e => { res.type = e.target.value; updateUploadBtnVisibility(); };

      const titleInp = document.createElement('input');
      titleInp.type = 'text';
      titleInp.className = 'resource-title-input';
      titleInp.value = res.title || '';
      titleInp.placeholder = 'عنوان المصدر (مثال: شرح الأستاذ أحمد)';
      titleInp.onchange = e => { res.title = e.target.value; };

      const urlInp = document.createElement('input');
      urlInp.type = 'url';
      urlInp.className = 'resource-url-input';
      urlInp.value = res.url || '';
      urlInp.placeholder = 'رابط المصدر';
      urlInp.onchange = e => { res.url = e.target.value; };

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete resource-del-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'حذف المصدر';
      delBtn.onclick = () => { resources.splice(idx, 1); renderResourcesManager(); };

      updateUploadBtnVisibility();

      item.appendChild(typeSel);
      item.appendChild(titleInp);
      item.appendChild(urlInp);
      item.appendChild(uploadBtn);
      item.appendChild(delBtn);
      container.appendChild(item);
    });
  }

  function addResource() {
    if (!currentEditingNode.resources) currentEditingNode.resources = [];
    currentEditingNode.resources.push({ type: 'pdf', url: '', title: '' });
    renderResourcesManager();
  }

  let pendingUploadIdx = -1;
  function triggerResourceUpload(idx) {
    pendingUploadIdx = idx;
    document.getElementById('resource-upload-input').click();
  }

  async function handleResourceUpload() {
    const input = document.getElementById('resource-upload-input');
    const file = input.files[0];
    if (!file || pendingUploadIdx < 0) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('❌ يرجى اختيار ملف PDF فقط', 'error');
      input.value = '';
      pendingUploadIdx = -1;
      return;
    }
    const ctx = currentEditingNode._uploadContext || {};
    if (!ctx.gradeName || !ctx.subjectName || !ctx.semesterName || !ctx.unitName) {
      showToast('❌ لم يتم تحديد المسار الكامل للدرس. احفظ الدرس في الشجرة أولاً.', 'error');
      input.value = '';
      pendingUploadIdx = -1;
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('grade', ctx.gradeName);
    fd.append('subject', ctx.subjectName);
    fd.append('semester', ctx.semesterName);
    fd.append('unit', ctx.unitName);
    try {
      const res = await authFetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل رفع الملف');
      const resObj = (currentEditingNode.resources || [])[pendingUploadIdx];
      if (resObj) {
        resObj.url = data.url;
        resObj.type = 'pdf';
        showToast('✅ تم رفع الملف: ' + data.filename);
        renderResourcesManager();
      }
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
    input.value = '';
    pendingUploadIdx = -1;
  }

  // === رفع كتاب المادة / الفصل الدراسي ===
  async function handleBookUpload() {
    const fileInput = document.getElementById('semester-book-upload-input');
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('❌ يرجى اختيار ملف PDF فقط', 'error');
      fileInput.value = '';
      return;
    }
    const isSemester = currentEditingLevel === 'semester';
    const ctx = currentEditingNode?._uploadContext || {};
    console.log('handleBookUpload | level:', currentEditingLevel, 'isSemester:', isSemester, 'nodeId:', currentEditingNode?.id, 'ctx:', JSON.stringify(ctx));
    if (!ctx.gradeName || !ctx.subjectName) {
      showToast('❌ لم يتم تحديد المسار الكامل. احفظ العنصر في الشجرة أولاً.', 'error');
      fileInput.value = '';
      return;
    }
    if (isSemester && !ctx.semesterName) {
      showToast('❌ لم يتم تحديد اسم الفصل. احفظ العنصر في الشجرة أولاً.', 'error');
      fileInput.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('grade', ctx.gradeName);
    fd.append('subject', ctx.subjectName);
    fd.append('semester', ctx.semesterName || '');
    try {
      const res = await authFetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل رفع الملف');
      if (!currentEditingNode) {
        showToast('⚠️ لم يتم تحديد العنصر الحالي', 'error');
        fileInput.value = '';
        return;
      }
      const returnedUrl = data.url;
      console.log('DOM - Upload Success. Returned URL:', returnedUrl);
      console.log('DOM - Is Semester Condition:', isSemester);
      const targetId = isSemester ? 'node-semester-book' : 'node-book';
      console.log('DOM - Target Element ID determined:', targetId);
      console.log('DOM - Target Element found in DOM:', document.getElementById(targetId));
      // 1. تحديث كائن البيانات في الذاكرة (State) — هذا هو المصدر الأساسي
      currentEditingNode.bookUrl = returnedUrl;
      // 2. تحديث الحقل النصي بصرياً — DOM
      const inputEl = document.getElementById(targetId);
      if (inputEl) {
        inputEl.value = returnedUrl;
        console.log('   ✓ DOM updated:', targetId, '=', returnedUrl);
      } else {
        console.error('   ✗ DOM element not found:', targetId);
      }
      // 3. تحديث رسالة التأكيد
      showToast('✅ تم رفع الملف: ' + data.filename);
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
    fileInput.value = '';
  }

  // === نشر وحفظ البيانات (Publish Changes) ===
  async function publishCurriculum() {
    if (!confirm('هل أنت متأكد من نشر وحفظ جميع التغييرات على قاعدة البيانات؟')) return;
    try {
      const res = await authFetch('/api/admin/curriculum/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.curriculum)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل نشر التغييرات');
      showToast('✅ ' + data.message);
      await loadData(); // إعادة التحميل للتزامن
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  }

  // === الإحصائيات (Analytics) ===
  async function loadAnalytics() {
    try {
      const res = await authFetch('/api/admin/analytics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'فشل تحميل الإحصائيات');

      document.getElementById('stat-students').textContent = data.total_students;
      document.getElementById('stat-admins').textContent = data.total_admins;
      document.getElementById('stat-lessons').textContent = data.total_lessons;
      document.getElementById('stat-reads').textContent = data.total_reads;

      const container = document.getElementById('top-lessons-container');
      if (!data.top_lessons?.length) {
        container.innerHTML = '<p class="loading-msg">لا توجد بيانات قراءة بعد.</p>';
        return;
      }

      const maxCount = data.top_lessons[0].read_count;
      container.innerHTML = data.top_lessons.map((l, i) => {
        const pct = Math.max(5, (l.read_count / maxCount) * 100);
        return `<div class="top-lesson-item">
          <div class="top-lesson-rank">#${i + 1}</div>
          <div class="top-lesson-info">
            <div class="top-lesson-title">${l.breadcrumb || l.title}</div>
            <div class="top-lesson-bar-wrap">
              <div class="top-lesson-bar" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="top-lesson-count">${l.read_count} قراءة</div>
        </div>`;
      }).join('');
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  }

  // === إدارة الألغاز (Puzzles) ===
  function renderPuzzlesList() {
    const c = document.getElementById('puzzles-list-container');
    c.innerHTML = '';
    if (!state.puzzles.length) { c.innerHTML = '<p class="loading-msg">لا توجد ألغاز.</p>'; return; }
    state.puzzles.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = 'puzzle-card';
      card.innerHTML = `<div class="puzzle-card-date">📅 ${p.date}</div><div class="puzzle-card-q">${p.question}</div><div class="puzzle-card-a">الحل: ${p.answer}</div>`;
      const acts = document.createElement('div'); acts.className = 'puzzle-card-actions node-actions';
      const eB = document.createElement('button'); eB.className = 'btn-edit'; eB.innerText = 'تعديل'; eB.onclick = () => openPuzzleModal(idx);
      const dB = document.createElement('button'); dB.className = 'btn-delete'; dB.innerText = 'حذف';
      dB.onclick = () => { if (confirm('هل تريد حذف هذا اللغز؟')) { state.puzzles.splice(idx, 1); renderPuzzlesList(); } };
      acts.appendChild(eB); acts.appendChild(dB); card.appendChild(acts); c.appendChild(card);
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
    const p = { date: document.getElementById('puzzle-date').value, question: document.getElementById('puzzle-question').value, answer: document.getElementById('puzzle-answer').value };
    if (editingPuzzleIndex > -1) state.puzzles[editingPuzzleIndex] = p; else state.puzzles.push(p);
    closeModal('puzzle-modal');
    renderPuzzlesList();
  }

  // === تصدير البيانات إلى ملف JSON محلي ===
  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function savePuzzlesToServer() {
    fetch('/api/admin/puzzles/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || localStorage.getItem('edu_token'))
      },
      body: JSON.stringify({ puzzles: state.puzzles })
    })
    .then(function(res) {
      if (!res.ok) throw new Error('فشل الحفظ');
      return res.json();
    })
    .then(function(data) {
      showToast('✅ ' + data.message, 'success');
    })
    .catch(function(err) {
      showToast('❌ فشل حفظ الألغاز: ' + err.message, 'error');
    });
  }

  function setupExportButtons() {
    document.getElementById('export-curriculum-btn')?.addEventListener('click', () => downloadJSON(state.curriculum, 'curriculum.json'));
    document.getElementById('export-puzzles-btn')?.addEventListener('click', () => downloadJSON(state.puzzles, 'puzzles.json'));
    document.getElementById('save-puzzles-btn')?.addEventListener('click', savePuzzlesToServer);
    document.getElementById('publish-curriculum-btn')?.addEventListener('click', publishCurriculum);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('refresh-users-btn')?.addEventListener('click', loadUsers);
  }

  // === إدارة المستخدمين ===
  async function loadUsers() {
    const container = document.getElementById('users-list-container');
    container.innerHTML = '<p class="loading-msg">جاري تحميل المستخدمين...</p>';
    try {
      const res = await authFetch('/api/admin/users');
      const data = await res.json();
      renderUsers(data.users);
    } catch (e) {
      container.innerHTML = '<p class="loading-msg" style="color:#ff7675;">فشل تحميل المستخدمين</p>';
    }
  }

  function renderUsers(users) {
    const container = document.getElementById('users-list-container');
    if (!users || users.length === 0) {
      container.innerHTML = '<p class="loading-msg">لا يوجد مستخدمين</p>';
      return;
    }
    let html =
      '<div class="users-table-wrap"><table class="users-table">' +
      '<thead><tr>' +
      '<th>المعرف</th><th>البريد</th><th>الاسم الأول</th><th>الاسم الأخير</th><th>تاريخ الميلاد</th><th>الصلاحية</th><th>الإجراءات</th>' +
      '</tr></thead><tbody>';
    users.forEach((u, i) => {
      const badgeClass = u.role === 'admin' ? 'user-badge admin' : 'user-badge';
      const badgeLabel = u.role === 'admin' ? 'مسؤول' : 'طالب';
      html +=
        '<tr>' +
        '<td>' + escapeHtml(String(u.id)) + '</td>' +
        '<td>' + escapeHtml(u.email) + '</td>' +
        '<td>' + escapeHtml(u.first_name) + '</td>' +
        '<td>' + escapeHtml(u.last_name) + '</td>' +
        '<td>' + escapeHtml(u.birth_date || '—') + '</td>' +
        '<td><span class="' + badgeClass + '">' + badgeLabel + '</span></td>' +
        '<td><div class="actions-cell">' +
        '<button class="btn-edit-user" data-id="' + u.id + '" data-first="' + escapeHtml(u.first_name) + '" data-last="' + escapeHtml(u.last_name) + '" data-role="' + u.role + '" data-email="' + escapeHtml(u.email) + '">✏️</button>' +
        '<button class="btn-delete-user" data-id="' + u.id + '" data-name="' + escapeHtml(u.first_name + ' ' + u.last_name) + '">🗑️</button>' +
        '</div></td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    container.querySelectorAll('.btn-edit-user').forEach(b => b.addEventListener('click', () => openEditUserModal(b.dataset)));
    container.querySelectorAll('.btn-delete-user').forEach(b => b.addEventListener('click', () => openDeleteUserModal(b.dataset)));
  }

  function openEditUserModal(data) {
    document.getElementById('edit-user-id').value = data.id;
    document.getElementById('edit-user-email').value = data.email;
    document.getElementById('edit-user-first-name').value = data.first;
    document.getElementById('edit-user-last-name').value = data.last;
    document.getElementById('edit-user-role').value = data.role;
    document.getElementById('edit-user-password').value = '';
    document.getElementById('edit-user-modal').classList.add('active');
  }

  async function saveEditUser() {
    const id = document.getElementById('edit-user-id').value;
    const payload = {
      first_name: document.getElementById('edit-user-first-name').value.trim(),
      last_name: document.getElementById('edit-user-last-name').value.trim(),
      role: document.getElementById('edit-user-role').value,
    };
    if (!payload.first_name || !payload.last_name) {
      showToast('❌ الاسم الأول والاسم الأخير مطلوبان', 'error');
      return;
    }
    try {
      const res = await authFetch('/api/admin/users/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { const err = await res.json(); showToast('❌ ' + (err.detail || 'فشل التحديث'), 'error'); return; }
      // تغيير كلمة المرور إن وجدت
      const pwd = document.getElementById('edit-user-password').value;
      if (pwd.length >= 8) {
        await authFetch('/api/admin/users/' + id + '/password', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_password: pwd })
        });
      }
      showToast('✅ تم تحديث المستخدم بنجاح');
      closeModal('edit-user-modal');
      loadUsers();
    } catch (e) { showToast('❌ فشل الاتصال بالخادم', 'error'); }
  }

  function openChangePasswordModal(data) {
    document.getElementById('cp-user-id').value = data.id;
    document.getElementById('cp-user-label').textContent = 'المستخدم: ' + data.name;
    document.getElementById('cp-new-password').value = '';
    document.getElementById('change-password-modal').classList.add('active');
  }

  async function saveChangePassword() {
    const id = document.getElementById('cp-user-id').value;
    const new_password = document.getElementById('cp-new-password').value;
    if (new_password.length < 8) {
      showToast('❌ كلمة المرور يجب أن تكون 8 أحرف على الأقل', 'error');
      return;
    }
    try {
      const res = await authFetch('/api/admin/users/' + id + '/password', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password })
      });
      if (!res.ok) { const err = await res.json(); showToast('❌ ' + (err.detail || 'فشل التغيير'), 'error'); return; }
      showToast('✅ تم تغيير كلمة المرور بنجاح');
      closeModal('change-password-modal');
    } catch (e) { showToast('❌ فشل الاتصال بالخادم', 'error'); }
  }

  function openDeleteUserModal(data) {
    document.getElementById('delete-user-id').value = data.id;
    document.getElementById('delete-user-label').textContent = 'هل أنت متأكد من حذف "' + data.name + '"؟ لا يمكن التراجع عن هذا الإجراء.';
    document.getElementById('delete-user-modal').classList.add('active');
  }

  async function confirmDeleteUser() {
    const id = document.getElementById('delete-user-id').value;
    try {
      const res = await authFetch('/api/admin/users/' + id, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json(); showToast('❌ ' + (err.detail || 'فشل الحذف'), 'error'); return; }
      showToast('✅ تم حذف المستخدم بنجاح');
      closeModal('delete-user-modal');
      loadUsers();
    } catch (e) { showToast('❌ فشل الاتصال بالخادم', 'error'); }
  }

  // === التهيئة ===
  async function init() {
    // معالجة الأخطاء العامة
    window.addEventListener('error', function(e) {
      console.error('[Admin Error]', e.filename, e.lineno, e.message);
      showToast('❌ حدث خطأ: ' + (e.message || 'غير معروف'), 'error');
    });
    try {
      setupTabs();
      setupModals();
      setupExportButtons();
      document.getElementById('login-form')?.addEventListener('submit', handleLogin);
      var uploadInput = document.getElementById('resource-upload-input');
      if (uploadInput) uploadInput.addEventListener('change', handleResourceUpload);
      document.getElementById('node-semester-book-upload-btn')?.addEventListener('click', function() {
        document.getElementById('semester-book-upload-input').click();
      });
      document.getElementById('semester-book-upload-input')?.addEventListener('change', handleBookUpload);
      document.getElementById('node-book-upload-btn')?.addEventListener('click', function() {
        document.getElementById('semester-book-upload-input').click();
      });
      checkAuth();
    } catch (e) {
      console.error('Init error:', e);
    }
  }

  return {
    init, addGrade, saveBasicNode, closeModal,
    openPuzzleModal, savePuzzle, saveLesson,
    addQuestionToCurrentLesson, addResource, loadAnalytics,
    loadUsers, saveEditUser, saveChangePassword, confirmDeleteUser
  };
})();

document.addEventListener('DOMContentLoaded', adminApp.init);
