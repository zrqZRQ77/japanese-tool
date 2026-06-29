// ===== 全局错误处理 =====
window.onerror = function(msg, url, line, col, error) {
  console.error('Global error:', {msg, url, line, col, error});
  showToast('发生了一个错误，请刷新页面重试', 'error');
  return false;
};

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);
  showToast('操作失败，请重试', 'error');
});

// 资源加载失败处理
window.addEventListener('error', function(e) {
  if (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK') {
    console.error('Resource failed to load:', e.target.src || e.target.href);
    showToast('部分资源加载失败，功能可能受限', 'warning');
  }
}, true);

// Toast通知函数
function showToast(message, type = 'info') {
  if(!document.body) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 安全的localStorage操作
const safeStorage = {
  setItem: function(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('localStorage空间已满:', e);
        showToast('存储空间不足，部分数据可能无法保存', 'warning');
      } else {
        console.error('localStorage写入失败:', e);
      }
      return false;
    }
  },
  getItem: function(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('localStorage读取失败:', e);
      return null;
    }
  },
  removeItem: function(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('localStorage删除失败:', e);
      return false;
    }
  }
};

// ===== Hero首屏逻辑 =====
function analyzeFromHero() {
  const text = document.getElementById('heroInputText').value.trim();
  if (!text) {
    alert('请先粘贴日语文本或文章链接');
    return;
  }
  document.body.classList.remove('first-visit');
  document.getElementById('inputText').value = text;
  safeStorage.setItem('hasUsedApp', 'true');
  analyzeSourceInput();
}

function loadSampleFromHero() {
  document.body.classList.remove('first-visit');
  safeStorage.setItem('hasUsedApp', 'true');
  loadSample();
}

function resetToHero() {
  if (confirm('返回首页将清空当前内容，确定吗？')) {
    document.body.classList.add('first-visit');
    document.getElementById('heroInputText').value = '';
    document.getElementById('output').innerHTML = '<span style="color:var(--ainezumi);font-size:14.5px;">点击「用示例开始」查看效果</span>';
    document.body.classList.remove('has-reading');
  }
}

// ===== 生词本面板逻辑 =====
function openVocabPanel() {
  document.getElementById('vocabPanelSlide').classList.add('active');
  syncVocabPanelData();
}

function closeVocabPanel() {
  document.getElementById('vocabPanelSlide').classList.remove('active');
}

function getAllVocab() {
  return Array.isArray(vocabData) ? vocabData : [];
}

function isDue(vocabItem) {
  return Number(vocabItem?.dueAt || 0) <= Date.now();
}

function syncVocabPanelData() {
  const vocab = getAllVocab();
  ['vocabCountPanel', 'vocabCountPage'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = vocab.length;
  });
  ['totalVocabCountPanel'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = vocab.length;
  });

  const vocabListPanel = document.getElementById('vocabListPanel');
  const vocabEmptyPanel = document.getElementById('vocabEmptyPanel');
  const vocabListPage = document.getElementById('vocabListPage');
  const vocabEmptyPage = document.getElementById('vocabEmptyPage');
  const listMarkup = vocab.map(v => `
      <li class="vocab-item">
        <div>
          <div class="vocab-word">${escapeHtml(v.word)}${vocabPracticeTag(v)}</div>
          <div class="vocab-meta">${escapeHtml(v.reading || '')}${v.reading && v.meaning ? ' · ' : ''}${escapeHtml(v.meaning || '')}</div>
        </div>
        <button class="vocab-remove" onclick="removeFromVocab('${encodeURIComponent(v.word)}')" aria-label="移除 ${escapeHtml(v.word)}">×</button>
      </li>
    `).join('');

  if(vocab.length === 0) {
    if(vocabListPanel) vocabListPanel.style.display = 'none';
    if(vocabEmptyPanel) vocabEmptyPanel.style.display = 'block';
    if(vocabListPage) vocabListPage.style.display = 'none';
    if(vocabEmptyPage) vocabEmptyPage.style.display = 'block';
  } else {
    if(vocabListPanel) {
      vocabListPanel.style.display = 'block';
      vocabListPanel.innerHTML = listMarkup;
    }
    if(vocabEmptyPanel) vocabEmptyPanel.style.display = 'none';
    if(vocabListPage) {
      vocabListPage.style.display = 'block';
      vocabListPage.innerHTML = listMarkup;
    }
    if(vocabEmptyPage) vocabEmptyPage.style.display = 'none';
  }

  const dueCount = vocab.filter(v => isDue(v)).length;
  ['dueCountPanel', 'dueCountPage'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = dueCount;
  });
  refreshPracticeStatus();
  renderVocabPractice();
  renderDailyPlan();
}

// ===== 菜单面板逻辑 =====
function openMenu() {
  document.getElementById('menuPanel').classList.add('active');
}

function closeMenu() {
  document.getElementById('menuPanel').classList.remove('active');
}

// ===== 检测首次访问 =====
window.addEventListener('DOMContentLoaded', () => {
  const hasUsedBefore = safeStorage.getItem('hasUsedApp');
  if (hasUsedBefore) {
    document.body.classList.remove('first-visit');
  }
});

// ---------------- 数据 ----------------
// 词库、示例文本、练习题和语法点从 data/*.json 加载，便于非代码方式维护。
let DICT = {};
let SAMPLE_TEXT = '';
let TYPING_PROMPTS = [];
let GRAMMAR_POINTS = [];
let DATA_READY = null;

const DATA_FILES = {
  dictionary: 'data/dictionary.json',
  sample: 'data/sample.json',
  typingPrompts: 'data/typing-prompts.json',
  grammarPoints: 'data/grammar-points.json'
};

async function fetchJson(path){
  const response = await fetch(path, { cache:'no-cache' });
  if(!response.ok) throw new Error(`${path} 加载失败（HTTP ${response.status}）`);
  return response.json();
}

async function loadLearningData(){
  const [dictionary, sample, typingPrompts, grammarPoints] = await Promise.all([
    fetchJson(DATA_FILES.dictionary),
    fetchJson(DATA_FILES.sample),
    fetchJson(DATA_FILES.typingPrompts),
    fetchJson(DATA_FILES.grammarPoints)
  ]);
  DICT = dictionary || {};
  SAMPLE_TEXT = sample?.text || '';
  TYPING_PROMPTS = Array.isArray(typingPrompts) ? typingPrompts : [];
  GRAMMAR_POINTS = Array.isArray(grammarPoints) ? grammarPoints : [];
}

function showDataLoadError(error){
  const message = '学习数据没有加载成功。请通过本地网页服务或正式部署地址打开页面，然后刷新重试。';
  const output = document.getElementById('output');
  if(output){
    output.innerHTML = `<span style="color:var(--trap);font-size:14.5px;">${escapeHtml(message)}</span>`;
  }
  const grammar = document.getElementById('grammarGrid');
  if(grammar){
    grammar.innerHTML = `<div class="grammar-empty">${escapeHtml(message)}</div>`;
  }
  setTokenizerStatus('学习数据未加载，暂时不能分析文本', '');
  setImportStatus(`${message}${error?.message ? ' 浏览器提示: ' + error.message : ''}`, 'error');
}

function ensureLearningData(){
  if(!DATA_READY) DATA_READY = loadLearningData();
  return DATA_READY;
}

let currentTypingIndex = 0;
let currentVocabPracticeIndex = 0;
let vocabPracticeAnswerVisible = false;
let articlePracticeMode = 'cloze';
let PRACTICE_STATS = loadPracticeStats();
let PRACTICE_HISTORY = loadPracticeHistory();
syncPracticeHistory();
let CURRENT_ARTICLE_TEXT = '';
let CLOZE_ITEMS = [];
let RETELL_RECOGNITION = null;
let RETELL_RECORDING = false;
let RETELL_MEDIA_RECORDER = null;
let RETELL_AUDIO_CHUNKS = [];
let RETELL_AUDIO_URL = null;

let KUROMOJI_TOKENIZER = null;
let KUROMOJI_LOADING = null;
window.KUROMOJI_TOKEN_CACHE = [];
let RUBY_OVERRIDES = {};
try{ RUBY_OVERRIDES = JSON.parse(safeStorage.getItem('reading_ruby_overrides') || '{}'); }catch{}
let IS_ANNOTATION_EDITING = false;
let CURRENT_FOOTNOTES = [];
let READING_HISTORY = [];

function practiceDateKey(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function defaultPracticeStats(){
  return {
    date: practiceDateKey(),
    total: 0,
    vocab: { again:0, hard:0, easy:0 },
    typing: { count:0, lastScore:null },
    cloze: { count:0, lastCorrect:null, lastTotal:null }
  };
}

function loadPracticeStats(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_practice_stats') || 'null');
    if(stored && stored.date === practiceDateKey()){
      return {
        ...defaultPracticeStats(),
        ...stored,
        vocab: { again:0, hard:0, easy:0, ...(stored.vocab || {}) },
        typing: { count:0, lastScore:null, ...(stored.typing || {}) },
        cloze: { count:0, lastCorrect:null, lastTotal:null, ...(stored.cloze || {}) }
      };
    }
  }catch{}
  return defaultPracticeStats();
}

function savePracticeStats(){
  safeStorage.setItem('reading_practice_stats', JSON.stringify(PRACTICE_STATS));
}

function normalizePracticeStats(stats, date = practiceDateKey()){
  return {
    ...defaultPracticeStats(),
    ...(stats || {}),
    date,
    vocab: { again:0, hard:0, easy:0, ...(stats?.vocab || {}) },
    typing: { count:0, lastScore:null, ...(stats?.typing || {}) },
    cloze: { count:0, lastCorrect:null, lastTotal:null, ...(stats?.cloze || {}) }
  };
}

function loadPracticeHistory(){
  try{
    const stored = JSON.parse(safeStorage.getItem('reading_practice_history') || '[]');
    if(!Array.isArray(stored)) return [];
    return stored
      .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item?.date || ''))
      .map(item => normalizePracticeStats(item, item.date))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
  }catch{
    return [];
  }
}

function syncPracticeHistory(){
  const normalized = normalizePracticeStats(PRACTICE_STATS, PRACTICE_STATS.date);
  const remaining = PRACTICE_HISTORY.filter(item => item.date !== normalized.date);
  PRACTICE_HISTORY = [normalized, ...remaining]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
  safeStorage.setItem('reading_practice_history', JSON.stringify(PRACTICE_HISTORY));
}

function recordPracticeResult(type, payload = {}){
  if(PRACTICE_STATS.date !== practiceDateKey()) PRACTICE_STATS = defaultPracticeStats();
  PRACTICE_STATS.total += 1;
  if(type === 'typing'){
    PRACTICE_STATS.typing.count += 1;
    PRACTICE_STATS.typing.lastScore = payload.score;
  }
  if(type === 'cloze'){
    PRACTICE_STATS.cloze.count += 1;
    PRACTICE_STATS.cloze.lastCorrect = payload.correct;
    PRACTICE_STATS.cloze.lastTotal = payload.total;
  }
  if(type === 'vocab'){
    const rating = payload.rating || 'hard';
    PRACTICE_STATS.vocab[rating] = (PRACTICE_STATS.vocab[rating] || 0) + 1;
  }
  savePracticeStats();
  syncPracticeHistory();
  renderPracticeSummary();
  renderLearningProgress();
  renderDailyPlan();
}

function renderPracticeSummary(){
  const grid = document.getElementById('practiceSummaryGrid');
  if(!grid) return;
  const typingScore = PRACTICE_STATS.typing.lastScore === null ? '未练习' : `${PRACTICE_STATS.typing.lastScore}%`;
  const clozeScore = PRACTICE_STATS.cloze.lastTotal === null ? '未练习' : `${PRACTICE_STATS.cloze.lastCorrect}/${PRACTICE_STATS.cloze.lastTotal}`;
  grid.innerHTML = `
    <div><b>${PRACTICE_STATS.total}</b><span>今日练习</span></div>
    <div><b>${PRACTICE_STATS.vocab.easy}</b><span>认识</span></div>
    <div><b>${PRACTICE_STATS.vocab.hard}</b><span>模糊</span></div>
    <div><b>${PRACTICE_STATS.vocab.again}</b><span>不认识</span></div>
    <div><b>${typingScore}</b><span>打字最近</span></div>
    <div><b>${clozeScore}</b><span>挖空最近</span></div>
  `;
}

function recentPracticeDays(count = 7){
  const byDate = new Map(PRACTICE_HISTORY.map(item => [item.date, item]));
  return Array.from({length:count}, (_, offset) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (count - 1 - offset));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return byDate.get(key) || normalizePracticeStats(null, key);
  });
}

function practiceStreak(){
  const practiced = new Set(PRACTICE_HISTORY.filter(item => item.total > 0).map(item => item.date));
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if(!practiced.has(practiceDateKey())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while(streak < 365){
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if(!practiced.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderLearningProgress(){
  const summary = document.getElementById('weeklyProgressSummary');
  const chart = document.getElementById('weeklyPracticeChart');
  if(!summary || !chart) return;
  const days = recentPracticeDays();
  const total = days.reduce((sum, day) => sum + Number(day.total || 0), 0);
  const activeDays = days.filter(day => day.total > 0).length;
  const needsReview = days.reduce((sum, day) => sum + Number(day.vocab.again || 0), 0);
  const maxTotal = Math.max(1, ...days.map(day => Number(day.total || 0)));
  summary.innerHTML = `
    <div><b>${total}</b><span>7 天练习</span></div>
    <div><b>${activeDays}</b><span>练习天数</span></div>
    <div><b>${practiceStreak()}</b><span>连续天数</span></div>
    <div><b>${needsReview}</b><span>需加强词汇</span></div>
  `;
  chart.innerHTML = days.map(day => {
    const date = new Date(`${day.date}T12:00:00`);
    const label = date.toLocaleDateString('zh-CN', {weekday:'short'}).replace('周', '');
    const height = day.total ? Math.max(14, Math.round(day.total / maxTotal * 100)) : 4;
    return `<div class="weekly-practice-day" title="${day.date}：${day.total} 次练习">
      <span class="weekly-practice-value">${day.total || ''}</span>
      <span class="weekly-practice-bar${day.total ? ' is-active' : ''}" style="height:${height}%"></span>
      <span class="weekly-practice-label">${label}</span>
    </div>`;
  }).join('');
}

function isDateToday(value){
  const date = new Date(value);
  const today = new Date();
  if(Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function dailyTaskState(){
  const vocab = getAllVocab();
  const dueCount = vocab.filter(item => isDue(item)).length;
  const vocabPracticeCount = Object.values(PRACTICE_STATS.vocab).reduce((sum, count) => sum + Number(count || 0), 0);
  const exerciseCount = Number(PRACTICE_STATS.typing.count || 0) + Number(PRACTICE_STATS.cloze.count || 0);
  const hasReadToday = READING_HISTORY.some(item => isDateToday(item.date));
  return [
    {
      type:'reading',
      title:'阅读一篇文章',
      detail:hasReadToday ? '今天已经完成阅读' : '导入文章并完成一次分析',
      done:hasReadToday,
      action:'去阅读'
    },
    {
      type:'vocab',
      title:'复习到期生词',
      detail:!vocab.length ? '先从阅读中收藏生词' : dueCount ? `${dueCount} 个词等待复习` : vocabPracticeCount ? '今日到期词已复习' : '今天没有到期词',
      done:vocab.length > 0 && dueCount === 0,
      action:!vocab.length ? '去收藏' : dueCount ? '去复习' : '再练一组'
    },
    {
      type:'practice',
      title:'完成一次练习',
      detail:exerciseCount ? '今天已经完成练习' : '文章理解或基础句型任选一种',
      done:exerciseCount > 0,
      action:'去练习'
    }
  ];
}

function renderDailyPlan(){
  const list = document.getElementById('dailyTaskList');
  const progress = document.getElementById('dailyPlanProgress');
  if(!list || !progress) return;
  const tasks = dailyTaskState();
  const completed = tasks.filter(task => task.done).length;
  progress.textContent = `${completed} / ${tasks.length}`;
  progress.classList.toggle('is-complete', completed === tasks.length);
  list.innerHTML = tasks.map((task, index) => `
    <button class="daily-task${task.done ? ' is-done' : ''}" type="button" onclick="openDailyTask('${task.type}')">
      <span class="daily-task-status" aria-hidden="true">${task.done ? '✓' : index + 1}</span>
      <span class="daily-task-copy"><b>${task.title}</b><small>${task.detail}</small></span>
      <span class="daily-task-action">${task.done ? '已完成' : task.action}</span>
    </button>
  `).join('');
}

function openDailyTask(type){
  if(type === 'reading'){
    switchWorkspace('reading');
    document.getElementById('sourceComposer')?.scrollIntoView({behavior:'smooth', block:'start'});
    return;
  }
  if(type === 'vocab'){
    const vocab = getAllVocab();
    if(!vocab.length){
      switchWorkspace('reading');
      document.getElementById('output')?.scrollIntoView({behavior:'smooth', block:'start'});
    } else if(vocab.some(item => isDue(item))){
      startReview();
    } else {
      reviewAllVocab();
    }
    return;
  }
  switchWorkspace('retell');
  document.querySelector('.practice-hero')?.scrollIntoView({behavior:'smooth', block:'start'});
}

const READING_SOURCES = [
  {level:'N5-N4', title:'NHK NEWS WEB EASY', url:'https://www3.nhk.or.jp/news/easy/', note:'简明新闻，适合入门到初中级。'},
  {level:'N5-N3', title:'つながるひろがる 日本語でのくらし', url:'https://tsunagarujp.bunka.go.jp/', note:'生活日语场景，适合建立基础表达。'},
  {level:'N4-N3', title:'やさしい日本語ニュース', url:'https://www3.nhk.or.jp/news/easy/', note:'每天更新，适合做稳定阅读练习。'},
  {level:'N3-N2', title:'MATCHA 日本語', url:'https://matcha-jp.com/jp', note:'旅游文化文章，词汇相对生活化。'},
  {level:'N2-N1', title:'Nippon.com 日本語', url:'https://www.nippon.com/ja/', note:'社会文化主题，适合进阶阅读。'},
  {level:'N1', title:'青空文庫', url:'https://www.aozora.gr.jp/', note:'文学作品，句式和词汇更难。'}
];

const LEVEL_TEST_QUESTIONS = [
  {level:'N5', q:'「私は学生です。」的意思是？', options:['我是学生。','我去学校。','这是学校。'], answer:0},
  {level:'N5', q:'「昨日、パンを食べました。」里「食べました」表示？', options:['吃了','正在吃','想吃'], answer:0},
  {level:'N4', q:'「雨が降っているので、出かけません。」最自然的理解是？', options:['因为在下雨，所以不出门。','虽然下雨，但要出门。','为了下雨而出门。'], answer:0},
  {level:'N4', q:'「この本は読みやすいです。」里的「やすい」表示？', options:['容易读','便宜地读','安静地读'], answer:0},
  {level:'N3', q:'「電車が遅れたため、会議に間に合わなかった。」的重点是？', options:['因为电车晚点，没赶上会议。','为了会议，电车晚点了。','会议结束后电车来了。'], answer:0},
  {level:'N3', q:'「彼は忙しいにもかかわらず、手伝ってくれた。」里的「にもかかわらず」接近？', options:['尽管如此','正因为如此','如果这样'], answer:0},
  {level:'N2', q:'「努力したからといって、必ず成功するとは限らない。」的意思是？', options:['即使努力，也不一定成功。','只要努力就一定成功。','因为努力所以不能成功。'], answer:0},
  {level:'N2', q:'「この問題は専門家でさえ解けない。」里的「でさえ」表示？', options:['连……都','只有……才','为了……'], answer:0},
  {level:'N1', q:'「彼の発言は、誤解を招きかねない。」里的「かねない」表示？', options:['有可能导致','绝不会导致','已经导致'], answer:0},
  {level:'N1', q:'「知れば知るほど、奥深さを思い知らされる。」最接近？', options:['越了解，越感到其深奥。','知道以后就忘了。','因为深奥所以不需要了解。'], answer:0}
];

function setTokenizerStatus(text, state){
  const el = document.getElementById('tokenizerStatus');
  if(!el) return;
  el.textContent = text;
  el.className = `engine-status ${state || ''}`.trim();
}

function showFallbackNotice(){
  const out = document.getElementById('output');
  if(!out || out.querySelector('.fallback-notice')) return;
  const notice = document.createElement('div');
  notice.className = 'fallback-notice';
  notice.style.cssText = 'background:#fff4e5;border:1px solid #f0c36d;color:#8a5a00;padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:10px;';
  notice.textContent = '⚠️ 智能分词加载失败，当前只用内置小词库标注，覆盖的词会比平时少很多。可以刷新页面重试。';
  out.prepend(notice);
}

function initKuromoji(){
  if(KUROMOJI_TOKENIZER) return Promise.resolve(KUROMOJI_TOKENIZER);
  if(KUROMOJI_LOADING) return KUROMOJI_LOADING;
  if(!window.kuromoji){
    setTokenizerStatus('自动标假名组件未加载，当前使用基础词库匹配', '');
    return Promise.resolve(null);
  }
  setTokenizerStatus('自动标假名加载中……', 'loading');
  KUROMOJI_LOADING = new Promise(resolve=>{
    window.kuromoji
      .builder({ dicPath: 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/' })
      .build((err, tokenizer)=>{
        if(err || !tokenizer){
          console.warn('kuromoji 初始化失败,已退回内置词库', err);
          setTokenizerStatus('自动标假名加载失败，当前使用基础词库匹配', '');
          resolve(null);
          return;
        }
        KUROMOJI_TOKENIZER = tokenizer;
        setTokenizerStatus('自动标假名已启用：会先切分词语，再补充读音和释义', 'ready');
        resolve(tokenizer);
      });
  });
  return KUROMOJI_LOADING;
}

async function loadSample(){
  await ensureLearningData();
  document.getElementById('inputText').value = SAMPLE_TEXT;
  switchWorkspace('reading');
  await renderText();
}

function sourceInputValue(){
  return document.getElementById('inputText')?.value.trim() || '';
}

function isArticleUrl(value){
  return /^https?:\/\/\S+$/i.test(String(value || '').trim());
}

async function analyzeSourceInput(){
  const value = sourceInputValue();
  if(!value){
    setImportStatus('请先粘贴日语原文、文章链接，或上传 PDF / Word / TXT。', 'error');
    document.getElementById('inputText')?.focus();
    return;
  }
  if(isArticleUrl(value)){
    await extractArticleUrl(value);
    return;
  }
  setImportStatus('正在分析文本……');
  await renderText();
  setImportStatus('已生成可点击阅读材料。', 'ok');
}

function setPostAnalysisActionsVisible(visible){
  document.getElementById('annotationEditBtn')?.classList.toggle('is-hidden', !visible);
  document.getElementById('exportTriggerBtn')?.classList.toggle('is-hidden', !visible);
  const nextStepBar = document.getElementById('nextStepBar');
  if(nextStepBar) nextStepBar.style.display = visible ? 'flex' : 'none';
}

function setReadingReady(ready){
  document.body.classList.toggle('has-reading', !!ready);
  const composer = document.getElementById('sourceComposer');
  if(composer && ready) composer.classList.remove('is-open');
}

function editSourceText(){
  const composer = document.getElementById('sourceComposer');
  if(!composer) return;
  composer.classList.add('is-open');
  document.getElementById('inputText')?.focus();
}

function openRecommendedSource(url){
  window.open(url, '_blank', 'noopener,noreferrer');
  const input = document.getElementById('inputText');
  if(input) input.focus();
  setImportStatus('打开来源后，复制具体文章页链接并粘贴到资料框。');
}

function setImportStatus(message, type = ''){
  const status = document.getElementById('importStatus');
  if(!status) return;
  status.textContent = message;
  status.className = `import-status ${type}`.trim();
}

let pendingImportMeta = null;
function switchWorkspace(view){
  if(!['reading','typing','grammar','retell','discover','test','history','vocab'].includes(view)) return;
  if(view === 'typing') view = 'retell';
  closeVocabPanel();
  document.body.dataset.view = view;
  document.querySelectorAll('.app-sidebar .nav-item').forEach(button=>{
    const navView = button.dataset.view;
    const isPractice = (view === 'typing' || view === 'retell') && navView === 'retell';
    button.classList.toggle('active', navView === view || isPractice);
  });
  document.querySelectorAll('.workspace-tab').forEach(button=>{
    button.classList.toggle('active', button.dataset.view === view);
  });
  safeStorage.setItem('reading_workspace', view);
  if(view === 'retell'){
    refreshRetellAdvice();
    renderTypingPractice();
    renderVocabPractice();
    renderPracticeSummary();
  }
  if(view === 'discover') renderSourceDirectory();
  if(view === 'history') renderReadingHistory();
  if(view === 'vocab') syncVocabPanelData();
  if(view === 'reading') renderDailyPlan();
}

function openImportPreview(text, meta = {}){
  pendingImportMeta = meta;
  const editor = document.getElementById('importPreviewText');
  editor.value = cleanImportedText(String(text || ''), meta).trim();
  updateImportPreviewSummary();
  document.getElementById('importPreviewModal').classList.add('active');
}

function closeImportPreview(){
  document.getElementById('importPreviewModal')?.classList.remove('active');
}

function cleanImportedText(text, meta = {}){
  const isPdf = meta.type === 'pdf' || /\.pdf$/i.test(meta.title || '');
  let value = stripUnrenderableSymbols(String(text || '').replace(/\r\n?/g, '\n'));
  if(isPdf) value = cleanPdfImportedText(value);
  if(meta.cleanupMode === 'web-article') value = cleanWebArticlePdfText(value);
  return value.trim();
}

function stripUnrenderableSymbols(text){
  // Icon/bullet glyphs from web pages often have no matching glyph in the export font
  // and render as a tofu box. Strip these symbol/private-use/emoji ranges on import.
  return String(text || '')
    .replace(/[\u2190-\u27bf]/g, '')
    .replace(/[\u2b00-\u2bff]/g, '')
    .replace(/[\ue000-\uf8ff]/g, '')
    .replace(/[\u{1f300}-\u{1faff}]/gu, '');
}

function cleanPdfImportedText(text){
  const lines = String(text || '').split('\n');
  const cleaned = [];
  for(const line of lines){
    const trimmed = line.trim();
    if(!trimmed){
      cleaned.push('');
      continue;
    }
    if(isPdfNoiseLine(trimmed)) continue;
    if(isPdfAnnotationLine(trimmed)) continue;
    cleaned.push(stripPdfInlineAnnotationMarkers(line));
  }
  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanWebArticlePdfText(text){
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const cleaned = [];
  const seen = new Set();
  for(const rawLine of lines){
    const line = rawLine.replace(/[ \t]+/g, ' ').trim();
    if(!line){
      if(cleaned.length && cleaned[cleaned.length - 1] !== '') cleaned.push('');
      continue;
    }
    if(isWebArticleNoiseLine(line)) continue;
    const normalized = line.replace(/\s+/g, '');
    if(seen.has(normalized)) continue;
    seen.add(normalized);
    cleaned.push(line);
  }
  return joinJapaneseArticleLines(cleaned).replace(/\n{3,}/g, '\n\n').trim();
}

function isWebArticleNoiseLine(line){
  const compact = line.replace(/\s+/g, '');
  const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/.test(line);
  const japaneseCount = (line.match(/[\u3040-\u30ff\u3400-\u9fff]/g) || []).length;
  if(isPdfNoiseLine(line)) return true;
  if(/https?:\/\/|www\.|nhk\.or\.jp|www3\.nhk\.or\.jp|\.html?|\.pdf/i.test(line)) return true;
  if(/^(NHK|NEWS WEB EASY|NEWS|WEB|Easy Japanese|Japan|日本語|English|中文|한국어)$/i.test(line)) return true;
  if(/(?:シェア|共有|印刷|トップ|ホーム|メニュー|検索|ログイン|本文へ|戻る|前へ|次へ|一覧|関連|おすすめ|広告|PR|動画|音声|画像|写真|このページ|ページの先頭|利用規約|プライバシー|お問い合わせ|Copyright|All Rights Reserved|©)/i.test(line) && japaneseCount < 18) return true;
  if(/^\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}時\d{1,2}分)?$/.test(compact)) return true;
  if(/^\d{1,2}月\d{1,2}日(?:\s+\d{1,2}時\d{1,2}分)?$/.test(compact)) return true;
  if(!hasJapanese && line.length < 32) return true;
  if(hasJapanese && line.length <= 2) return true;
  return false;
}

function joinJapaneseArticleLines(lines){
  const output = [];
  for(const line of lines){
    if(!line){
      if(output.length && output[output.length - 1] !== '') output.push('');
      continue;
    }
    const prev = output[output.length - 1];
    // Headline-list pages (news portals) pack short, unrelated titles one per line with
    // no terminal punctuation - joining those onto the previous line mashes unrelated
    // headlines together. A genuine line-wrap from a printed PDF is consistently close to
    // the page's full width and rarely ends in an ellipsis (a common headline-truncation
    // marker), so only join lines that look like that.
    const looksLikeWrappedSentence = prev && prev.length >= 18 && !/[\u2026\u22ef]$/.test(prev);
    const shouldJoin = looksLikeWrappedSentence
      && !/[\u3002\uff01\uff1f!?\u300d\u300f\uff09)]$/.test(prev)
      && /^[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9\u300c\u300e\uff08(]/.test(line)
      && (prev.length + line.length) < 95;
    if(shouldJoin) output[output.length - 1] = `${prev}${line}`;
    else output.push(line);
  }
  return output.join('\n');
}

function isPdfNoiseLine(line){
  const noJapanese = !/[\u3040-\u30ff\u3400-\u9fff]/.test(line);
  const compact = line.replace(/\s+/g, '');
  if(/^[-–—•·・･\u2022.\u30fb\s\d]+$/.test(line) && noJapanese) return true;
  if(/^(?:[-–—•·・･\u2022]\s*)?\d{1,4}(?:\s*[-–—•·・･\u2022])?$/.test(line)) return true;
  if(/^[.…。．・･·•\u2022]{2,}$/.test(compact)) return true;
  if(/^(?:参考)?(?:图片|插图|图|圖|画像|写真|figure|fig\.?)\s*[:：]?\s*\d*$/i.test(line)) return true;
  if(/^(?:第\s*)?\d{1,4}\s*(?:页|頁|ページ|p\.)$/i.test(line)) return true;
  if(/^\d{1,3}\s*[.…。．・･·•\u2022]{2,}\s*\d{0,3}$/.test(line)) return true;
  return false;
}

function isPdfAnnotationLine(line){
  const markerCount = (line.match(/(?:^|[\s。．、,，])\d{1,2}(?=[\u3040-\u30ff\u3400-\u9fffA-Za-z])/g) || []).length;
  const hasManyDefinitions = markerCount >= 3 && line.length < 260;
  const hasAnnotationKeywords = /(?:注|註|脚注|参考|語注|語釈|用語|Sentimentalisme|figure|fig\.)/i.test(line);
  return hasManyDefinitions || (hasAnnotationKeywords && markerCount >= 1);
}

function stripPdfInlineAnnotationMarkers(line){
  return line
    .replace(/(^|[\s。．、,，])\d{1,2}(?=[\u3040-\u30ff\u3400-\u9fffA-Za-z])/g, '$1')
    .replace(/\d{1,3}\s*[.…。．・･·•\u2022]{2,}\s*\d{0,3}/g, '')
    .replace(/[.…。．・･·•\u2022]{3,}/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

function updateImportPreviewSummary(){
  const text = document.getElementById('importPreviewText')?.value || '';
  const lines = text ? text.split(/\n/).length : 0;
  document.getElementById('importPreviewSummary').innerHTML = `<span>${escapeHtml(pendingImportMeta?.title || '导入内容')}</span><span>${text.length.toLocaleString()} 字符</span><span>${lines} 行</span>`;
}

function cleanImportText(mode){
  const editor = document.getElementById('importPreviewText');
  let text = editor.value;
  if(mode === 'article') text = cleanWebArticlePdfText(cleanPdfImportedText(text));
  if(mode === 'blank') text = text.replace(/\n{3,}/g, '\n\n');
  if(mode === 'spaces') text = text.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n');
  if(mode === 'edges'){
    const lines = text.split(/\n/);
    while(lines.length > 1 && lines[0].trim().length < 8) lines.shift();
    while(lines.length > 1 && lines[lines.length - 1].trim().length < 8) lines.pop();
    text = lines.join('\n');
  }
  editor.value = text.trim();
  updateImportPreviewSummary();
}

async function confirmImportPreview(){
  const text = cleanImportedText(document.getElementById('importPreviewText').value, pendingImportMeta || {}).trim();
  if(!text) return;
  CURRENT_FOOTNOTES = Array.isArray(pendingImportMeta?.footnotes) ? pendingImportMeta.footnotes : [];
  document.getElementById('inputText').value = text;
  closeImportPreview();
  switchWorkspace('reading');
  setImportStatus(`已导入: ${pendingImportMeta?.title || '正文'}`, 'ok');
  await renderText();
}

function apiEndpoints(path){
  const configured = String(window.NIHONGO_CONFIG?.apiBaseUrl || '').trim().replace(/\/$/, '');
  if(configured) return [`${configured}${path}`];

  const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
  const isLocalDev = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  if(isHttp && !isLocalDev) return [`${location.origin}${path}`];

  const bases = [];
  if(isLocalDev){
    bases.push('http://127.0.0.1:3001', 'http://localhost:3001', 'http://127.0.0.1:3002', 'http://localhost:3002');
  }
  if(!bases.length) console.error('未配置 apiBaseUrl，且当前页面不是本地开发地址。请检查 config.js。');
  return [...new Set(bases)].map(base=>`${base}${path}`);
}

function hasConfiguredBackend(){
  const configured = String(window.NIHONGO_CONFIG?.apiBaseUrl || '').trim();
  const isLocalDev = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  return !!configured || isLocalDev;
}

function connectionHelp(){
  const configured = String(window.NIHONGO_CONFIG?.apiBaseUrl || '').trim();
  if(configured) return '请确认后端服务正在运行，并且 config.js 里的 API 地址可以访问。';
  if(location.protocol === 'file:') return '请不要直接双击 HTML 文件打开；请用本地网页服务或正式部署地址访问。';
  if(['localhost', '127.0.0.1', '::1'].includes(location.hostname)) return '请确认 backend 服务已经启动。';
  return '请在 config.js 里配置公开的后端 API 地址，或把前后端部署到同一个域名。';
}

async function readJsonResponse(response){
  try{
    return await response.json();
  }catch{
    return { ok:false, message:`服务返回了无法识别的内容（HTTP ${response.status}）。` };
  }
}

async function postExtractUrl(url){
  const endpoints = apiEndpoints('/api/extract-url');
  let lastError = null;
  for(const endpoint of endpoints){
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 5000);
    try{
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url}),
        signal:controller.signal
      });
      clearTimeout(timeout);
      const data = await readJsonResponse(response);
      return { response, data };
    }catch(error){
      clearTimeout(timeout);
      lastError = error;
    }
  }
  throw new Error(`无法连接后端服务。${connectionHelp()}${lastError?.message ? ' 浏览器提示: ' + lastError.message : ''}`);
}

async function extractArticleUrl(urlOverride = ''){
  await ensureLearningData();
  const input = document.getElementById('articleUrlInput');
  const url = String(urlOverride || input?.value || sourceInputValue()).trim();
  if(input) input.value = url;
  if(!url){
    setImportStatus('请先粘贴一个具体文章链接。', 'error');
    return;
  }

  if(!hasConfiguredBackend()){
    setImportStatus('URL 提取需要后端服务支持，当前公开前端暂不可用。请直接复制网页正文粘贴到资料框，或上传 PDF / Word / TXT。', 'error');
    return;
  }

  setImportStatus('正在提取网页……如果超过几秒没有结果，可以直接复制网页正文粘贴。');
  try{
    const { response, data } = await postExtractUrl(url);
    if(!response.ok || !data.ok){
      throw new Error(data.message || '提取失败。');
    }
    const text = (data.text || '').trim();
    if(!text){
      throw new Error('没有提取到正文。');
    }
    setImportStatus(`已提取: ${data.title || '文章正文'}，请检查内容`, 'ok');
    openImportPreview(text, {title:data.title || '文章正文', type:data.type || 'html'});
  }catch(error){
    const reason = error.message || '提取失败。';
    setImportStatus(`${reason} 下一步可以试试：确认链接是具体文章页；或把网页打印/导出为 PDF 后上传。`, 'error');
  }
}

async function extractUploadedFile(file){
  await ensureLearningData();
  const input = document.getElementById('documentFileInput');
  if(!file) return;

  // 基本验证
  if(file.size === 0){
    showToast('文件为空，请选择有效的文件', 'error');
    if(input) input.value = '';
    return;
  }

  document.body.classList.remove('first-visit');
  safeStorage.setItem('hasUsedApp', 'true');
  switchWorkspace('reading');
  const extension = (file.name.match(/\.[^.]+$/)?.[0] || '').toLowerCase();
  const limits = {'.pdf':20 * 1024 * 1024, '.docx':10 * 1024 * 1024, '.txt':2 * 1024 * 1024};
  if(!limits[extension]){
    setImportStatus('目前只支持 PDF、Word（DOCX）和 TXT 文件。', 'error');
    showToast('不支持的文件格式', 'error');
    if(input) input.value = '';
    return;
  }
  if(file.size > limits[extension]){
    const limitMB = Math.round(limits[extension] / 1024 / 1024);
    const fileMB = Math.round(file.size / 1024 / 1024);
    setImportStatus(`${extension.slice(1).toUpperCase()} 文件超过大小限制（${fileMB}MB > ${limitMB}MB）。`, 'error');
    showToast(`文件过大：${fileMB}MB（限制${limitMB}MB）`, 'error');
    if(input) input.value = '';
    return;
  }

  // TXT 不需要服务端解析，直接在浏览器里读取，避免依赖后端
  if(extension === '.txt'){
    setImportStatus(`正在读取 ${file.name}……`);
    try{
      const text = (await file.text()).trim();
      if(!text) throw new Error('文件中没有可提取的正文。');
      setImportStatus(`已读取 ${file.name}，请检查内容`, 'ok');
      openImportPreview(text, {title:file.name, type:'txt'});
      showToast('文件读取成功', 'success');
    }catch(error){
      setImportStatus(error.message || 'TXT 文件读取失败。', 'error');
      showToast('文件读取失败', 'error');
    }finally{
      if(input) input.value = '';
    }
    return;
  }

  setImportStatus(`正在读取 ${file.name}……`);
  try{
    const endpoints = apiEndpoints('/api/extract-file');
    let result = null;
    let lastError = null;
    for(const endpoint of endpoints){
      try{
        const response = await fetch(endpoint, {
          method:'POST',
          headers:{
            'Content-Type':file.type || 'application/octet-stream',
            'X-File-Name':encodeURIComponent(file.name),
            'X-File-Type':extension.slice(1),
            'X-Pdf-Mode':extension === '.pdf' ? (document.getElementById('pdfModeSelect')?.value || 'auto') : 'auto'
          },
          body:file
        });
        const data = await readJsonResponse(response);
        result = {response, data};
        break;
      }catch(error){
        lastError = error;
      }
    }
    if(!result){
      const errorMsg = `无法连接后端服务。${connectionHelp()}${lastError?.message ? ' 浏览器提示: ' + lastError.message : ''}`;
      throw new Error(errorMsg);
    }
    if(!result.response.ok || !result.data.ok) throw new Error(result.data.message || '文件提取失败。');
    const text = (result.data.text || '').trim();
    if(!text) throw new Error('文件中没有可提取的正文。');
    const cleanupMode = extension === '.pdf' ? (document.getElementById('pdfCleanupSelect')?.value || 'normal') : 'normal';
    const pageInfo = result.data.pageCount ? `，${result.data.pageCount} 页` : '';
    const layoutInfo = result.data.layoutMode === 'vertical-to-horizontal' ? '，已按竖版转横排处理' : '';
    const cleanupInfo = cleanupMode === 'web-article' ? '，已按网页文章清理' : '';
    setImportStatus(`已读取 ${file.name}${pageInfo}${layoutInfo}${cleanupInfo}，请检查内容`, 'ok');
    openImportPreview(text, {title:file.name, type:result.data.type, cleanupMode, footnotes:result.data.footnotes || [], layoutWarnings:result.data.layoutWarnings || []});
    showToast('文件读取成功', 'success');
  }catch(error){
    setImportStatus(`${error.message || '文件提取失败。'} 下一步可以试试：确认文件不是扫描图片版；PDF 可切换「普通资料 / 网页文章」后重新上传。`, 'error');
    showToast('文件处理失败，请查看提示', 'error');
  }finally{
    if(input) input.value = '';
  }
}

function escapeHtml(str){
  return String(str ?? '').replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function plainSelectedText(){
  const selection = window.getSelection();
  if(!selection || !selection.rangeCount) return '';
  const container = document.createElement('div');
  for(let i = 0; i < selection.rangeCount; i += 1){
    container.appendChild(selection.getRangeAt(i).cloneContents());
  }
  container.querySelectorAll('rt').forEach(node=>node.remove());
  return (container.textContent || selection.toString() || '').replace(/\s+/g, ' ').trim();
}

function shouldShowRuby(surface, reading){
  if(!reading || reading === '*' || surface === reading) return false;
  if(/^[。、！？「」『』（）\(\)、,.!?\s]+$/.test(surface)) return false;
  const hasKanji = /[\u4e00-\u9fff]/.test(surface);
  const hasKana = /[\u3040-\u309f\u30a0-\u30ffー]/.test(surface);
  if(hasKanji && hasKana) return true;
  if(/^[\u3040-\u309fー]+$/.test(surface)) return false;
  return hasKanji || /[\u30a0-\u30ff]/.test(surface);
}

function isMixedKanjiKana(surface){
  return /[\u4e00-\u9fff]/.test(surface) && /[\u3040-\u309f\u30a0-\u30ffー]/.test(surface);
}

function renderWordNode(surface, reading, cls, attrs, onClick){
  const override = RUBY_OVERRIDES[surface];
  if(override) reading = override.hidden ? '' : override.reading;
  const safeSurface = escapeHtml(surface);
  const safeReading = escapeHtml(reading || '');
  const attrText = Object.entries(attrs || {}).map(([key,value]) => `${key}="${escapeHtml(String(value))}"`).join(' ');
  const groupCls = isMixedKanjiKana(surface) ? ' w-grouped' : '';
  const content = shouldShowRuby(surface, reading)
    ? `${safeSurface}<rt>${safeReading}</rt>`
    : safeSurface;
  const label = `${surface}${reading ? '，读音 ' + reading : ''}。查看释义`;
  return `<ruby class="w ${cls}${groupCls}" ${attrText} role="button" tabindex="0" aria-label="${escapeHtml(label)}" onclick="${onClick}" onkeydown="activateWordNode(event,this)">${content}</ruby>`;
}

function activateWordNode(event, el){
  if(event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  el?.click();
}

function footnoteForId(id){
  return CURRENT_FOOTNOTES.find(note => String(note.id) === String(id));
}

function renderFootnoteRef(id){
  const safe = escapeHtml(String(id));
  return `<sup class="footnote-ref" role="button" tabindex="0" aria-label="查看脚注 ${safe}" onclick="showFootnoteDetail('${safe}')" onkeydown="activateWordNode(event,this)">${safe}</sup>`;
}

function renderPlainTextWithFootnotes(text){
  const value = String(text || '');
  if(!CURRENT_FOOTNOTES.length) return escapeHtml(value);
  return value.replace(/\d{1,2}/g, match => footnoteForId(match) ? renderFootnoteRef(match) : escapeHtml(match));
}

function renderRubyUnitNode(unit, index){
  const safeBase = escapeHtml(unit.base || '');
  const safeRuby = escapeHtml(unit.ruby || '');
  const cls = unit.cls || 'w-kuromoji';
  const content = shouldShowRuby(unit.base, unit.ruby)
    ? `${safeBase}<rt>${safeRuby}</rt>`
    : safeBase;
  return `<ruby class="w ${cls}" data-edited-unit="${index}">${content}</ruby>`;
}

async function renderText(){
  await ensureLearningData();
  const raw = normalizeReadingInput(document.getElementById('inputText').value).trim();
  const out = document.getElementById('output');
  const statsBar = document.getElementById('statsBar');
  if(!raw){
    out.innerHTML = '<span style="color:var(--ink-soft);font-size:14.5px;">请先粘贴文本，或点击「用示例开始」。</span>';
    statsBar.innerHTML = '';
    CURRENT_ARTICLE_TEXT = '';
    refreshRetellAdvice();
    setPostAnalysisActionsVisible(false);
    setReadingReady(false);
    return;
  }

  CURRENT_ARTICLE_TEXT = raw;
  CLOZE_ITEMS = [];
  refreshRetellAdvice();
  setPostAnalysisActionsVisible(true);
  setReadingReady(true);

  // 显示状态条和图例
  const statusBar = document.getElementById('statusBar');
  const legendInline = document.getElementById('legendInline');
  const readingHint = document.getElementById('readingHint');
  if(statusBar) statusBar.style.display = 'flex';
  if(legendInline) legendInline.style.display = 'flex';
  if(readingHint) readingHint.style.display = 'block';

  const useKuromoji = document.getElementById('useKuromoji')?.checked;
  if(useKuromoji){
    if(!KUROMOJI_TOKENIZER){
      out.innerHTML = '<span style="color:var(--ink-soft);font-size:14.5px;">正在加载分词引擎，第一次使用需要几秒钟……</span>';
    }
    const tokenizer = await initKuromoji();
    if(tokenizer){
      renderWithKuromoji(raw, tokenizer, out, statsBar);
      saveCurrentArticleToHistory();
      return;
    }
  }
  renderWithDictionary(raw, out, statsBar);
  if(useKuromoji) showFallbackNotice();
  saveCurrentArticleToHistory();
}

function normalizeReadingInput(text){
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map(paragraph => paragraph
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .join('')
    )
    .join('\n\n');
}

function renderWithDictionary(raw, out, statsBar){
  const words = Object.keys(DICT).sort((a,b)=>b.length-a.length);
  let segments = [{text: raw, matched:null}];

  words.forEach(word=>{
    const next = [];
    segments.forEach(seg=>{
      if(seg.matched){ next.push(seg); return; }
      const parts = seg.text.split(word);
      for(let i=0;i<parts.length;i++){
        if(parts[i]) next.push({text:parts[i], matched:null});
        if(i < parts.length-1) next.push({text:word, matched:word});
      }
    });
    segments = next;
  });

  let html = '';
  const counts = {N5:0,N4:0,N3:0,particle:0,trap:0};
  let matchedChars = 0;
  const totalChars = raw.replace(/[\s\n。、！？「」]/g,'').length;

  segments.forEach(seg=>{
    if(seg.matched){
      const info = DICT[seg.matched];
      counts[info.level] = (counts[info.level]||0) + 1;
      matchedChars += seg.matched.length;
      const cls = info.level === 'trap' ? 'w-trap' : (info.level === 'particle' ? 'w-particle' : 'w-'+info.level.toLowerCase());
      html += renderWordNode(seg.matched, info.reading, cls, {"data-word":seg.matched}, `showDetail('${seg.matched}', this)`);
    } else {
      html += renderPlainTextWithFootnotes(seg.text);
    }
  });

  out.innerHTML = html;

  const coverage = totalChars > 0 ? Math.round((matchedChars/totalChars)*100) : 0;
  statsBar.innerHTML = `
    <span class="stat-chip chip-cov">识别覆盖率 <span class="n">${coverage}%</span></span>
    <span class="stat-chip chip-n5">N5 <span class="n">${counts.N5}</span></span>
    <span class="stat-chip chip-n4">N4 <span class="n">${counts.N4}</span></span>
    <span class="stat-chip chip-n3">N3 <span class="n">${counts.N3}</span></span>
    <span class="stat-chip chip-particle">助词 <span class="n">${counts.particle}</span></span>
    <span class="stat-chip chip-trap">易误解词 <span class="n">${counts.trap}</span></span>
  `;
}

function katakanaToHiragana(str){
  return (str || '').replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function getTokenInfo(token){
  const surface = token.surface_form;
  const base = token.basic_form && token.basic_form !== '*' ? token.basic_form : surface;
  const dictInfo = DICT[surface] || DICT[base];
  if(dictInfo){
    const dictWord = DICT[surface] ? surface : base;
    return { ...dictInfo, dictWord, baseForm: base, lookupWord: dictWord, source:'DICT' };
  }
  const reading = katakanaToHiragana(token.reading && token.reading !== '*' ? token.reading : surface);
  const pos = [token.pos, token.pos_detail_1].filter(v=>v && v !== '*').join('・') || '已识别词';
  return {
    reading,
    level:'kuromoji',
    pos,
    meaning:`已识别为「${pos}」。当前内置词库还没有中文释义，可以用完整词典继续查询。`,
    dictWord: surface,
    baseForm: base,
    lookupWord: base,
    source:'kuromoji'
  };
}

function renderWithKuromoji(raw, tokenizer, out, statsBar){
  const rawTokens = tokenizer.tokenize(raw);
  const tokens = rawTokens;
  window.KUROMOJI_TOKEN_CACHE = [];
  const counts = {N5:0,N4:0,N3:0,particle:0,trap:0,kuromoji:0};
  let dictChars = 0;
  let tokenChars = 0;
  const html = tokens.map((token, i)=>{
    const surface = token.surface_form;
    if(/^\d{1,2}$/.test(surface) && footnoteForId(surface)) return renderFootnoteRef(surface);
    if(/^\s+$/.test(surface)) return escapeHtml(surface);
    if(/^[。、！？「」『』（）\(\)、,.!?]+$/.test(surface)) return escapeHtml(surface);

    const info = getTokenInfo(token);
    counts[info.level] = (counts[info.level] || 0) + 1;
    tokenChars += surface.length;
    if(info.source === 'DICT') dictChars += surface.length;

    const cls = info.level === 'trap'
      ? 'w-trap'
      : info.level === 'particle'
        ? 'w-particle'
        : info.level === 'kuromoji'
          ? 'w-kuromoji'
          : 'w-' + info.level.toLowerCase();
    window.KUROMOJI_TOKEN_CACHE[i] = { surface, info };
    return renderWordNode(surface, info.reading, cls, {"data-token-id":i}, `showTokenDetail(${i}, this)`);
  }).join('');

  out.innerHTML = html;
  const coverage = tokenChars > 0 ? Math.round((dictChars/tokenChars)*100) : 0;
  statsBar.innerHTML = `
    <span class="stat-chip chip-cov">可查释义 <span class="n">${coverage}%</span></span>
    <span class="stat-chip chip-km">已识别 <span class="n">${tokens.length}</span></span>
    <span class="stat-chip chip-n5">N5 <span class="n">${counts.N5}</span></span>
    <span class="stat-chip chip-n4">N4 <span class="n">${counts.N4}</span></span>
    <span class="stat-chip chip-n3">N3 <span class="n">${counts.N3}</span></span>
    <span class="stat-chip chip-particle">助词 <span class="n">${counts.particle}</span></span>
    <span class="stat-chip chip-trap">易误解词 <span class="n">${counts.trap}</span></span>
  `;
}

function collectRubyUnits(){
  const out = document.getElementById('output');
  const units = [];
  function visit(node){
    if(node.nodeType === Node.TEXT_NODE){
      [...node.textContent].forEach(ch=>units.push({base:ch, ruby:''}));
      return;
    }
    if(node.nodeType !== Node.ELEMENT_NODE) return;
    if(node.tagName.toLowerCase() === 'br'){
      units.push({base:'\n', ruby:''});
      return;
    }
    if(['div','p'].includes(node.tagName.toLowerCase()) && units.length && units[units.length - 1].base !== '\n'){
      units.push({base:'\n', ruby:''});
    }
    if(node.matches('ruby.w')){
      const rt = node.querySelector('rt');
      const ruby = rt ? rt.textContent : '';
      const base = [...node.childNodes]
        .filter(child=>!(child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'rt'))
        .map(child=>child.textContent)
        .join('');
      units.push({base, ruby});
      return;
    }
    node.childNodes.forEach(visit);
  }
  out.childNodes.forEach(visit);
  return units.filter(unit=>unit.base);
}

function toggleAnnotationEditMode(){
  if(IS_ANNOTATION_EDITING){
    finishAnnotationEditMode();
  } else {
    startAnnotationEditMode();
  }
}

function startAnnotationEditMode(){
  const out = document.getElementById('output');
  if(!out || !out.querySelector('ruby.w')) return;
  IS_ANNOTATION_EDITING = true;
  out.classList.add('editing');
  out.setAttribute('contenteditable', 'true');
  out.setAttribute('spellcheck', 'false');
  out.addEventListener('keydown', handleAnnotationEditKeydown);
  document.getElementById('annotationEditBtn').textContent = '完成编辑';
  out.focus();
}

function finishAnnotationEditMode(){
  const out = document.getElementById('output');
  if(!out) return;
  IS_ANNOTATION_EDITING = false;
  out.classList.remove('editing');
  out.removeAttribute('contenteditable');
  out.removeAttribute('spellcheck');
  out.removeEventListener('keydown', handleAnnotationEditKeydown);
  document.getElementById('annotationEditBtn').textContent = '编辑标注';
  const units = collectRubyUnits()
    .map(unit=>unit.base === '\n' ? unit : {base:unit.base.trim(), ruby:(unit.ruby || '').trim()})
    .filter(unit=>unit.base);
  renderEditedOutput(units);
  updateExportPreview();
}

function handleAnnotationEditKeydown(event){
  if(!IS_ANNOTATION_EDITING) return;
  if(event.key === 'Enter'){
    event.preventDefault();
    document.execCommand('insertLineBreak');
    return;
  }
  if(event.key === 'Backspace' || event.key === 'Delete'){
    const selection = window.getSelection();
    if(selection && selection.rangeCount && !selection.getRangeAt(0).collapsed) return;
    event.preventDefault();
    document.execCommand(event.key === 'Backspace' ? 'delete' : 'forwardDelete');
  }
}

function renderEditedOutput(units){
  const out = document.getElementById('output');
  if(!out) return;
  let html = '';
  units.forEach((unit, index)=>{
    if(unit.base === '\n'){
      html += '<br>';
      return;
    }
    html += renderRubyUnitNode(unit, index);
  });
  out.innerHTML = html || '<span style="color:var(--ink-soft);font-size:14.5px;">内容已清空。</span>';
}

function openExportModal(){
  const modal = document.getElementById('exportModal');
  if(!modal) return;
  modal.classList.add('active');
  syncExportOptions();
  updateExportPreview();
}

function closeExportModal(){
  document.getElementById('exportModal')?.classList.remove('active');
}

function selectedExportFormat(){
  return document.getElementById('exportFormatSelect')?.value || 'pptx';
}

function selectedExportLayout(){
  return document.getElementById('exportLayoutSelect')?.value || 'landscape';
}

const EXPORT_PRESETS = {
  landscape: { baseFont:23, rubyFont:11, rubyGap:0.18, lineHeight:0.64, maxCells:37 },
  portrait: { baseFont:22, rubyFont:10, rubyGap:0.16, lineHeight:0.62, maxCells:22 }
};
let lastExportLayout = null;

function applyExportPreset(layout){
  const preset = EXPORT_PRESETS[layout];
  if(!preset) return;
  document.getElementById('pptBaseFont').value = preset.baseFont;
  document.getElementById('pptRubyFont').value = preset.rubyFont;
  document.getElementById('pptRubyGap').value = preset.rubyGap.toFixed(2);
  document.getElementById('pptLineHeight').value = preset.lineHeight.toFixed(2);
  document.getElementById('pptMaxCells').value = preset.maxCells;
}

function resetExportPreset(){
  applyExportPreset(selectedExportLayout());
  updateExportPreview();
}

function syncExportOptions(){
  const layout = selectedExportLayout();
  const settings = document.getElementById('pptExportSettings');
  if(!settings) return;
  settings.classList.remove('is-hidden');
  if(lastExportLayout !== layout){
    applyExportPreset(layout);
    lastExportLayout = layout;
  }
  updateExportPreview();
}

function updateExportPreview(){
  const target = document.getElementById('exportPreviewContent');
  if(!target) return;
  const source = document.getElementById('output');
  target.innerHTML = source?.querySelector('ruby.w') ? source.innerHTML : '<span style="color:var(--ink-soft);font-size:13px">分析文本后，这里会显示导出效果。</span>';
  target.style.fontSize = `${Math.max(14, numberValue('pptBaseFont',24) * .72)}px`;
  target.style.lineHeight = Math.max(1.65, numberValue('pptLineHeight',.72) * 2.45);
  target.querySelectorAll('rt').forEach(rt=>rt.style.fontSize = `${Math.max(8, numberValue('pptRubyFont',11) * .72)}px`);
}

function collectExportRubyEntries(){
  const entries = new Map();
  document.querySelectorAll('#output ruby.w').forEach(node=>{
    const rt = node.querySelector('rt');
    const ruby = rt ? rt.textContent.trim() : '';
    const base = [...node.childNodes]
      .filter(child=>!(child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === 'rt'))
      .map(child=>child.textContent)
      .join('')
      .trim();
    if(!base || !ruby || !/[\u3400-\u9fff]/.test(base)) return;
    if(!entries.has(base)) entries.set(base, ruby);
  });
  return Array.from(entries, ([base, ruby])=>({base, ruby})).slice(0, 120);
}

function renderExportRubyEditor(){
  const list = document.getElementById('exportRubyList');
  if(!list) return;
  const entries = collectExportRubyEntries();
  if(!entries.length){
    list.innerHTML = '<div class="export-prep-empty">分析文本后，这里会列出可修改的汉字假名。</div>';
    return;
  }
  list.innerHTML = entries.map(({base, ruby}, index)=>{
    const override = RUBY_OVERRIDES[base];
    const value = override && !override.hidden ? override.reading : ruby;
    return `<label class="export-ruby-item">
      <span class="export-ruby-word" title="${escapeHtml(base)}">${escapeHtml(base)}</span>
      <input data-export-ruby-base="${encodeURIComponent(base)}" value="${escapeHtml(value)}">
    </label>`;
  }).join('');
}

async function applyExportRubyEdits(){
  document.querySelectorAll('#exportRubyList input[data-export-ruby-base]').forEach(input=>{
    const base = decodeURIComponent(input.dataset.exportRubyBase || '');
    const reading = input.value.trim();
    if(!base) return;
    if(reading){
      RUBY_OVERRIDES[base] = {reading, hidden:false};
    } else {
      RUBY_OVERRIDES[base] = {reading:'', hidden:true};
    }
  });
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  await renderText();
  renderExportRubyEditor();
  updateExportPreview();
}

async function runExport(){
  const format = selectedExportFormat();
  const layout = selectedExportLayout();
  setExportBusy(true, '正在下载，请稍候……');
  try{
    await new Promise(resolve=>setTimeout(resolve, 30));
    if(format === 'png' || format === 'jpeg'){
      await downloadRubyImage(layout, format);
    } else {
      await downloadRubyPptx(layout);
    }
    setExportBusy(false, '下载已开始。');
  }catch(error){
    const message = error?.message || '导出失败。';
    setExportBusy(false, `${message} 请确认已经分析文本；如果导出库加载失败，请联网刷新后重试。`);
    alert(`${message}\n\n请确认已经分析文本；如果导出库加载失败，请联网刷新后重试。`);
  }finally{
    setTimeout(()=>setExportBusy(false, ''), 1800);
  }
}

function setExportBusy(isBusy, message){
  const status = document.getElementById('exportStatus');
  const button = document.getElementById('exportDownloadBtn');
  if(status) status.textContent = message || '';
  if(button){
    button.disabled = isBusy;
    button.textContent = isBusy ? '处理中……' : '下载';
  }
}

function escapeXml(value){
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function wordTextRun(text, fontHalfPoints){
  const preserve = /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<w:r><w:rPr><w:rFonts w:ascii="Yu Gothic" w:eastAsia="Yu Gothic"/><w:sz w:val="${fontHalfPoints}"/><w:szCs w:val="${fontHalfPoints}"/></w:rPr><w:t${preserve}>${escapeXml(text)}</w:t></w:r>`;
}

function wordRubyRun(unit, baseHalfPoints, rubyHalfPoints){
  if(!unit.ruby) return wordTextRun(unit.base, baseHalfPoints);
  return `<w:ruby><w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="${rubyHalfPoints}"/><w:hpsRaise w:val="${rubyHalfPoints + 2}"/><w:hpsBaseText w:val="${baseHalfPoints}"/><w:lid w:val="ja-JP"/></w:rubyPr><w:rt>${wordTextRun(unit.ruby,rubyHalfPoints)}</w:rt><w:rubyBase>${wordTextRun(unit.base,baseHalfPoints)}</w:rubyBase></w:ruby>`;
}

async function downloadRubyDocx(orientation = 'landscape'){
  const units = collectRubyUnits();
  if(!units.length){ alert('请先分析文本,再导出 Word。'); return; }
  if(!window.JSZip){ alert('Word 导出组件没有加载成功，请联网刷新后重试。'); return; }
  const baseHalfPoints = Math.round(numberValue('pptBaseFont',24) * 2);
  const rubyHalfPoints = Math.round(numberValue('pptRubyFont',11) * 2);
  const paragraphs = [[]];
  units.forEach(unit=>{
    const pieces = String(unit.base).split('\n');
    pieces.forEach((piece,index)=>{
      if(piece) paragraphs[paragraphs.length-1].push({...unit,base:piece});
      if(index < pieces.length-1) paragraphs.push([]);
    });
  });
  const page = orientation === 'portrait'
    ? '<w:pgSz w:w="11906" w:h="16838"/>'
    : '<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>';
  const body = paragraphs.map(parts=>`<w:p><w:pPr><w:spacing w:after="160" w:line="${Math.round(numberValue('pptLineHeight',.78)*480)}" w:lineRule="auto"/></w:pPr>${parts.map(unit=>wordRubyRun(unit,baseHalfPoints,rubyHalfPoints)).join('')}</w:p>`).join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr>${page}<w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml',documentXml);
  const blob = await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=`japanese-ruby-${orientation}.docx`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); closeExportModal();
}

function exportPayload(orientation = 'landscape'){
  return {
    units: collectRubyUnits(),
    layout:orientation,
    baseFont:numberValue('pptBaseFont', 24),
    rubyFont:numberValue('pptRubyFont', 11),
    rubyGap:numberValue('pptRubyGap', 0.20),
    lineHeight:numberValue('pptLineHeight', 0.78),
    maxCells:numberValue('pptMaxCells', 34)
  };
}

async function downloadRubyImage(orientation = 'landscape', format = 'png'){
  const units = collectRubyUnits();
  if(!units.length){
    throw new Error(`请先分析文本，再导出 ${format.toUpperCase()}。`);
  }
  const payload = exportPayload(orientation);
  await downloadClientRubyImage(payload, format);
  closeExportModal();
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 0);
}

async function downloadClientRubyImage(payload, format = 'png'){
  const canvases = buildRubyCanvases(payload, { paged:false, background:format === 'jpeg' ? '#FFFDF8' : 'transparent' });
  const canvas = canvases[0];
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise(resolve=>canvas.toBlob(resolve, mimeType, 0.92));
  if(!blob) throw new Error('浏览器没有生成图片。');
  downloadBlob(blob, `japanese-ruby-text-${payload.layout}.${format === 'jpeg' ? 'jpg' : 'png'}`);
}

function buildRubyCanvases(payload, options = {}){
  const width = payload.layout === 'portrait' ? 900 : 1600;
  const defaultHeight = payload.layout === 'portrait' ? 1600 : 900;
  const padX = payload.layout === 'portrait' ? 70 : 90;
  const padY = payload.layout === 'portrait' ? 82 : 72;
  const contentWidth = width - padX * 2;
  const cellPx = contentWidth / payload.maxCells;
  const basePx = Math.max(18, cellPx * (payload.baseFont / 24) * 0.92);
  const rubyPx = Math.max(9, basePx * (payload.rubyFont / payload.baseFont));
  const rubySlot = rubyPx + Math.round(payload.rubyGap * 32);
  const rowPx = Math.max(basePx + rubySlot + 10, basePx * (1.45 + payload.lineHeight * 0.5));
  const rows = buildMeasuredImageRows(payload.units, {
    fontSize:basePx,
    rubySize:rubyPx,
    availableW:contentWidth
  });
  const rowsPerPage = options.paged ? Math.max(1, Math.floor((defaultHeight - padY * 2) / rowPx)) : rows.length;
  const pages = chunkRows(rows, rowsPerPage || rows.length || 1);
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  return pages.map(pageRows=>{
    const height = options.paged ? defaultHeight : Math.max(defaultHeight, Math.ceil(padY * 2 + pageRows.length * rowPx));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error('浏览器没有可用的图片绘制环境。');
    ctx.scale(scale, scale);
    ctx.clearRect(0, 0, width, height);
    if(options.background && options.background !== 'transparent'){
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.textBaseline = 'top';

    pageRows.forEach((row, rowIndex)=>{
      row.forEach(unit=>{
        const boxX = padX + unit.x;
        const boxW = unit.boxW;
        const centerX = boxX + boxW / 2;
        const y = padY + rowIndex * rowPx;
        if(unit.ruby){
          ctx.font = `${rubyPx}px "Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif`;
          ctx.fillStyle = '#6b6459';
          ctx.textAlign = 'center';
          ctx.fillText(unit.ruby, centerX, y);
        }
        ctx.font = `${basePx}px "Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif`;
        ctx.fillStyle = '#2b2a28';
        ctx.textAlign = 'center';
        ctx.fillText(unit.base, centerX, y + rubySlot);
      });
    });
    return canvas;
  });
}

function layoutRubyUnits(units, config){
  const rows = [];
  let x = config.marginX;
  let current = [];
  units.forEach(unit=>{
    const width = Math.max(
      unit.base.length * config.baseCharW,
      unit.ruby.length * config.rubyCharW,
      config.baseCharW * 0.8
    );
    if(x + width > config.maxWidth && current.length){
      rows.push(current);
      current = [];
      x = config.marginX;
    }
    current.push({...unit, x, width});
    x += width + config.gap;
  });
  if(current.length) rows.push(current);
  return rows;
}

function visualLength(str){
  return [...(str || '')].length;
}

function isLineHeadPunctuation(str){
  return /^[、。！？!?）」』】〕〉》,.;:，．；：]/.test(str || '');
}

function makeMeasureContext(fontSize){
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px "Yu Gothic","Hiragino Sans","Noto Sans JP",sans-serif`;
  return ctx;
}

function measuredTextWidth(ctx, text){
  return Math.max(ctx.measureText(text || '').width, 1);
}

function buildMeasuredImageRows(units, config){
  const baseCtx = makeMeasureContext(config.fontSize);
  const rubyCtx = makeMeasureContext(config.rubySize);
  const rows = [];
  let row = [];
  let x = 0;
  const gap = config.fontSize * 0.02;

  units.forEach(unit=>{
    if(unit.base === '\n'){
      if(row.length){
        rows.push(row);
        row = [];
        x = 0;
      }
      return;
    }
    const baseW = measuredTextWidth(baseCtx, unit.base);
    const rubyW = unit.ruby ? measuredTextWidth(rubyCtx, unit.ruby) : 0;
    const boxW = Math.max(baseW, rubyW * 0.92, config.fontSize * 0.55) + gap;
    const baseOffset = (boxW - baseW) / 2;
    const measured = { ...unit, baseW, rubyW, boxW, baseOffset };

    if(x + boxW > config.availableW && row.length && !isLineHeadPunctuation(unit.base)){
      rows.push(row);
      row = [];
      x = 0;
    }

    if(row.length === 0 && isLineHeadPunctuation(unit.base) && rows.length){
      const previous = rows[rows.length - 1];
      const previousWidth = previous.reduce((sum, item)=>sum + item.boxW, 0);
      if(previousWidth + boxW <= config.availableW + config.fontSize * 0.6){
        previous.push({ ...measured, x:previousWidth });
        return;
      }
    }

    row.push({ ...measured, x });
    x += boxW;
  });

  if(row.length) rows.push(row);
  return rows;
}

function makeImageGlyphs(units){
  const glyphs = [];
  units.forEach((unit, groupIndex)=>{
    [...unit.base].forEach(ch=>{
      glyphs.push({
        ch,
        ruby: unit.ruby || '',
        groupIndex,
        width: isLineHeadPunctuation(ch) ? 0.5 : 1
      });
    });
  });
  return glyphs;
}

function buildImageRows(units, maxCells){
  const glyphs = makeImageGlyphs(units);
  const rows = [];
  let current = [];
  let currentWidth = 0;
  for(let i = 0; i < glyphs.length; i++){
    const glyph = glyphs[i];
    const projected = currentWidth + glyph.width;
    const canKeepEndingMark = isLineHeadPunctuation(glyph.ch) && projected <= maxCells + 0.5;
    if(projected > maxCells && current.length && !canKeepEndingMark){
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
    if(current.length === 0 && isLineHeadPunctuation(glyph.ch) && rows.length){
      const lastRow = rows[rows.length - 1];
      const lastWidth = lastRow.reduce((sum, item)=>sum + item.width, 0);
      if(lastWidth + glyph.width <= maxCells + 0.5){
        lastRow.push(glyph);
        continue;
      }
      if(lastRow.length > 1){
        const moved = lastRow.pop();
        rows.push([moved, glyph]);
        continue;
      }
    }
    current.push(glyph);
    currentWidth += glyph.width;
  }
  if(current.length) rows.push(current);
  return rows;
}

function buildImageRowsFromPptRows(rows){
  return rows.map(row=>{
    let cursor = 0;
    return row.map(unit=>{
      const start = cursor;
      cursor += Math.max(unit.cell || baseCellsForCursor(unit), 1);
      return { ...unit, start };
    });
  });
}

function getRowGlyphPositions(row){
  let cursor = 0;
  return row.map(glyph=>{
    const start = cursor;
    const end = cursor + glyph.width;
    cursor = end;
    return { start, end, center:(start + end) / 2 };
  });
}

function collectRowRubySegments(row, positions){
  const segments = [];
  let active = null;
  row.forEach((glyph, index)=>{
    if(!glyph.ruby){
      if(active){
        active.end = positions[index - 1]?.end ?? active.end;
        segments.push(active);
        active = null;
      }
      return;
    }
    if(active && active.groupIndex === glyph.groupIndex && active.ruby === glyph.ruby){
      active.end = positions[index].end;
      return;
    }
    if(active) segments.push(active);
    active = {
      groupIndex: glyph.groupIndex,
      ruby: glyph.ruby,
      start: positions[index].start,
      end: positions[index].end
    };
  });
  if(active) segments.push(active);
  return segments;
}

function buildVisualRows(units, maxCells){
  const rows = [];
  let current = [];
  let cells = 0;
  units.forEach(unit=>{
    const baseCells = Math.max(visualLength(unit.base), 1);
    if(cells + baseCells > maxCells && current.length && !isLineHeadPunctuation(unit.base)){
      rows.push(current);
      current = [];
      cells = 0;
    }
    current.push({...unit, cell:baseCells, baseCells, rubyCells:Math.max(visualLength(unit.ruby || ''), 1)});
    cells += baseCells;
  });
  if(current.length) rows.push(current);
  return rows;
}

function buildEditablePptRows(units, maxCells){
  const rows = [];
  let current = [];
  let cells = 0;
  units.forEach(unit=>{
    const baseCells = Math.max(visualLength(unit.base), 1);
    const rubyCells = Math.max(visualLength(unit.ruby || ''), 1);
    const cell = Math.max(baseCells, Math.ceil(rubyCells * 0.62), 1);
    if(cells + cell > maxCells && current.length && !isLineHeadPunctuation(unit.base)){
      rows.push(current);
      current = [];
      cells = 0;
    }
    current.push({...unit, cell, baseCells, rubyCells});
    cells += cell;
  });
  if(current.length) rows.push(current);
  return rows;
}

function numberValue(id, fallback){
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

async function downloadRubyPptx(orientation = 'landscape'){
  const units = collectRubyUnits();
  if(!units.length){
    throw new Error('请先分析文本，再导出 PPTX。');
  }
  if(!window.PptxGenJS){
    throw new Error('PPTX 导出库没有加载成功，请联网后刷新页面再试。');
  }

  const pptx = new window.PptxGenJS();
  const isPortrait = orientation === 'portrait';
  if(isPortrait){
    pptx.defineLayout({ name:'PORTRAIT_9_16', width:7.5, height:13.333 });
    pptx.layout = 'PORTRAIT_9_16';
  } else {
    pptx.layout = 'LAYOUT_WIDE';
  }
  pptx.author = 'Nihongo Reader';
  pptx.subject = 'Japanese ruby text';
  pptx.title = 'Japanese Ruby Text';

  const payload = exportPayload(orientation);
  const canvases = buildRubyCanvases(payload, { paged:true, background:'transparent' });
  const slideW = isPortrait ? 7.5 : 13.333;
  const slideH = isPortrait ? 13.333 : 7.5;
  canvases.forEach((canvas, pageIndex)=>{
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFDF8' };
    slide.addImage({
      data: canvas.toDataURL('image/png'),
      x: 0,
      y: 0,
      w: slideW,
      h: slideH
    });
    if(canvases.length > 1){
      slide.addText(`${pageIndex + 1} / ${canvases.length}`, {
        x: slideW - 0.72, y: 0.22, w: 0.52, h: 0.18,
        fontFace: 'Microsoft YaHei',
        fontSize: 8,
        color: 'A49A8A',
        align: 'right',
        margin: 0
      });
    }
    slide.addNotes('稳定排版版本:正文和假名以图片形式嵌入,避免 PowerPoint 或 WPS 重新排版导致文字错位。');
  });

  await pptx.writeFile({ fileName: `japanese-ruby-text-stable-${isPortrait ? 'portrait' : 'landscape'}.pptx` });
}

function baseCellsForCursor(unit){
  return Math.max(unit.baseCells || visualLength(unit.base), 1);
}

function chunkRows(rows, rowsPerPage){
  const chunks = [];
  for(let i = 0; i < rows.length; i += rowsPerPage){
    chunks.push(rows.slice(i, i + rowsPerPage));
  }
  return chunks.length ? chunks : [[]];
}

const LEVEL_LABEL = {N5:'N5 · 基础',N4:'N4 · 初中级',N3:'N3 · 中级',particle:'助词',trap:'易误解词',kuromoji:'已识别词'};
const LEVEL_COLOR = {N5:'var(--n5)',N4:'var(--n4)',N3:'var(--n3)',particle:'var(--particle)',trap:'var(--trap)',kuromoji:'var(--km)'};
const LEVEL_BG = {N5:'var(--n5-bg)',N4:'var(--n4-bg)',N3:'var(--n3-bg)',particle:'var(--particle-bg)',trap:'var(--trap-bg)',kuromoji:'var(--km-bg)'};

const PART_LABELS_ZH = {
  n:'名词', noun:'名词', v:'动词', verb:'动词', adj:'形容词', adverb:'副词', adv:'副词',
  expression:'表达', exp:'表达', particle:'助词', prefix:'接头词', suffix:'接尾词',
  interjection:'感叹词', conjunction:'连词', pronoun:'代词', auxiliary:'助动词',
  ichidan:'一段动词', godan:'五段动词', transitive:'他动词', intransitive:'自动词'
};

const COMMON_GLOSS_ZH = {
  'to be':'是；存在', 'to do':'做', 'to go':'去', 'to come':'来', 'to see':'看见；查看',
  'to look':'看', 'to say':'说', 'to speak':'说话', 'to eat':'吃', 'to drink':'喝',
  'to read':'读', 'to write':'写', 'to listen':'听', 'to hear':'听见', 'to think':'想；认为',
  'person':'人', 'thing':'事物', 'time':'时间', 'place':'地方', 'today':'今天',
  'tomorrow':'明天', 'yesterday':'昨天', 'now':'现在', 'good':'好', 'bad':'不好；坏',
  'many':'许多', 'few':'少量', 'big':'大', 'small':'小', 'new':'新', 'old':'旧；老',
  'water':'水', 'book':'书', 'school':'学校', 'teacher':'老师', 'student':'学生',
  'friend':'朋友', 'family':'家人', 'house':'房子；家', 'work':'工作', 'money':'钱'
};

function hasCjk(text){
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(text || ''));
}

function partLabelZh(part){
  const key = String(part || '').toLowerCase().replace(/[^a-z]/g, '');
  return PART_LABELS_ZH[key] || '';
}

function glossToChinese(gloss){
  const value = String(gloss || '').trim();
  if(!value) return '';
  if(hasCjk(value)) return value;
  const normalized = value.toLowerCase().replace(/\(.+?\)/g, '').replace(/^to\s+/, 'to ').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
  if(COMMON_GLOSS_ZH[normalized]) return COMMON_GLOSS_ZH[normalized];
  const phrase = Object.keys(COMMON_GLOSS_ZH).find(key => normalized.includes(key));
  return phrase ? COMMON_GLOSS_ZH[phrase] : '';
}

function dictionaryEntryChinese(entry){
  const parts = (entry.parts || []).map(partLabelZh).filter(Boolean);
  const meanings = (entry.meanings || []).map(glossToChinese).filter(Boolean);
  const partText = parts.length ? ` · ${escapeHtml([...new Set(parts)].join('、'))}` : '';
  const meaningText = meanings.length
    ? escapeHtml([...new Set(meanings)].slice(0, 4).join('；'))
    : '<span style="color:var(--ink-soft);">中文释义暂未收录。可以先查看读音和词性，后续补充中文词库。</span>';
  return `<b>${escapeHtml(entry.word || '')}</b> ${escapeHtml(entry.reading || '')}${partText}<br>${meaningText}`;
}

function rubyEditorHtml(surface, reading, tokenId = ''){
  const override = RUBY_OVERRIDES[surface];
  const value = override && !override.hidden ? override.reading : reading;
  const encoded = encodeURIComponent(surface);
  return `<details class="detail-more">
    <summary>更多操作</summary>
    <div class="ruby-editor">
      <label>假名读音<input id="rubyEditInput" type="text" value="${escapeHtml(value || '')}" placeholder="输入平假名"></label>
      <div class="ruby-editor-actions">
        <button class="btn-primary" onclick="saveRubyOverride('${encoded}')">保存修改</button>
        <button class="btn-ghost" onclick="hideRubyOverride('${encoded}')">隐藏假名</button>
        <button class="btn-ghost" onclick="resetRubyOverride('${encoded}')">恢复自动读音</button>
        <button class="btn-ghost" onclick="lookupDictionary('${encoded}', '${tokenId}')">查询完整词典</button>
      </div>
      <div class="lookup-status" id="dictionaryLookupResult">修改会保存在当前浏览器，并同步用于导出。</div>
    </div>
  </details>`;
}

function saveRubyOverride(encoded){
  const surface = decodeURIComponent(encoded);
  const reading = document.getElementById('rubyEditInput')?.value.trim();
  if(!reading) return;
  RUBY_OVERRIDES[surface] = {reading, hidden:false};
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  renderText();
}

function hideRubyOverride(encoded){
  const surface = decodeURIComponent(encoded);
  RUBY_OVERRIDES[surface] = {reading:'', hidden:true};
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  renderText();
}

function resetRubyOverride(encoded){
  delete RUBY_OVERRIDES[decodeURIComponent(encoded)];
  safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
  renderText();
}

function tokenLookupCandidates(tokenId, fallbackWord = ''){
  const token = window.KUROMOJI_TOKEN_CACHE[tokenId];
  const words = [
    token?.info?.lookupWord,
    token?.info?.baseForm,
    token?.info?.dictWord,
    token?.surface,
    fallbackWord
  ].map(word => String(word || '').trim()).filter(Boolean);
  return [...new Set(words)];
}

async function lookupDictionary(encoded, tokenId = ''){
  const word = decodeURIComponent(encoded);
  const candidates = tokenLookupCandidates(tokenId, word);
  const target = document.getElementById('dictionaryLookupResult');
  target.textContent = '正在查询词典……';
  if(DICT[word]){
    const info = DICT[word];
    target.innerHTML = `<b>${escapeHtml(info.reading)}</b> · ${escapeHtml(info.pos)}<br>${escapeHtml(info.meaning)}`;
    return;
  }
  try{
    let lastError = null;
    for(const candidate of candidates){
      let response = null;
      for(const endpoint of apiEndpoints(`/api/dictionary?keyword=${encodeURIComponent(candidate)}`)){
        try{ response = await fetch(endpoint); break; }catch(error){ lastError = error; }
      }
      if(!response) continue;
      const data = await response.json();
      if(response.ok && data.ok && data.entries?.length){
        const note = candidate !== word ? `<div class="lookup-status">已按原形「${escapeHtml(candidate)}」查询。</div>` : '';
        target.innerHTML = note + data.entries.map(dictionaryEntryChinese).join('<br><br>');
        return;
      }
      lastError = new Error(data.message || '未找到词条。');
    }
    throw lastError || new Error('无法连接词典服务。');
  }catch(error){ target.textContent = error.message || '词典查询失败。'; }
}

function showDetail(word, el){
  if(IS_ANNOTATION_EDITING) return;
  document.querySelectorAll('.w.active').forEach(n=>n.classList.remove('active'));
  if(el) el.classList.add('active');

  const info = DICT[word];
  if(!info) return;
  const area = document.getElementById('detailArea');
  area.innerHTML = `
    <div class="detail-box">
      <div class="detail-word">${word}</div>
      <div class="detail-reading">读音：${info.reading} ・ ${info.pos}</div>
      <div class="level-badge" style="color:${LEVEL_COLOR[info.level]};background:${LEVEL_BG[info.level]};">${LEVEL_LABEL[info.level]}</div>
      <div class="detail-meaning"><b>释义：</b>${info.meaning}</div>
      <div class="ruby-editor-actions">
        <button class="btn-primary" onclick="addToVocab('${word}')">加入生词本</button>
        <button class="btn-ghost" onclick="speakEncodedJapanese('${encodeURIComponent(word)}')">朗读</button>
      </div>
      ${rubyEditorHtml(word, info.reading)}
    </div>
  `;
}

function showTokenDetail(tokenId, el){
  if(IS_ANNOTATION_EDITING) return;
  document.querySelectorAll('.w.active').forEach(n=>n.classList.remove('active'));
  if(el) el.classList.add('active');

  const token = window.KUROMOJI_TOKEN_CACHE[tokenId];
  if(!token) return;
  const { surface, info } = token;
  const needsLookup = info.source === 'kuromoji';
  const area = document.getElementById('detailArea');
  area.innerHTML = `
    <div class="detail-box">
      <div class="detail-word">${escapeHtml(surface)}</div>
      <div class="detail-reading">读音：${escapeHtml(info.reading)} ・ ${escapeHtml(info.pos)}</div>
      <div class="level-badge" style="color:${LEVEL_COLOR[info.level]};background:${LEVEL_BG[info.level]};">${LEVEL_LABEL[info.level]}</div>
      <div class="detail-meaning" id="tokenMeaning-${tokenId}"><b>释义：</b>${needsLookup ? '正在查询词典……' : escapeHtml(info.meaning)}</div>
      <div class="ruby-editor-actions">
        <button class="btn-primary" onclick="addTokenToVocab(${tokenId})">加入生词本</button>
        <button class="btn-ghost" onclick="speakEncodedJapanese('${encodeURIComponent(surface)}')">朗读</button>
      </div>
      ${rubyEditorHtml(surface, info.reading, tokenId)}
    </div>
  `;
  if(needsLookup) autoLookupTokenMeaning(surface, tokenId);
}

async function autoLookupTokenMeaning(word, tokenId){
  const target = document.getElementById(`tokenMeaning-${tokenId}`);
  if(!target) return;
  const candidates = tokenLookupCandidates(tokenId, word);
  try{
    let lastError = null;
    for(const candidate of candidates){
      let response = null;
      for(const endpoint of apiEndpoints(`/api/dictionary?keyword=${encodeURIComponent(candidate)}`)){
        try{ response = await fetch(endpoint); break; }catch(error){ lastError = error; }
      }
      if(!response) continue;
      const data = await response.json();
      if(response.ok && data.ok && data.entries?.length){
        const note = candidate !== word ? `<span style="color:var(--ink-soft);">按原形「${escapeHtml(candidate)}」查询。</span><br>` : '';
        target.innerHTML = '<b>释义：</b>' + note + data.entries.slice(0, 3).map(dictionaryEntryChinese).join('<br>');
        return;
      }
      lastError = new Error(data.message || '词典里没查到这个词。');
    }
    throw lastError || new Error('无法连接词典服务,请确认 backend 已启动。');
  }catch(error){
    target.innerHTML = `<b>释义：</b><span style="color:var(--ink-soft);">${escapeHtml(error.message || '查询失败。')}</span> <button class="btn-ghost" style="padding:3px 8px;font-size:11px;" onclick='autoLookupTokenMeaning(${JSON.stringify(word)}, ${tokenId})'>重试</button>`;
  }
}

function showFootnoteDetail(id){
  const note = footnoteForId(id);
  if(!note) return;
  const area = document.getElementById('detailArea');
  area.innerHTML = `
    <div class="detail-box">
      <div class="detail-word">注 ${escapeHtml(String(note.id))}</div>
      <div class="detail-reading">第 ${escapeHtml(String(note.page || ''))} 页脚注</div>
      <div class="detail-meaning">${escapeHtml(note.text || '')}</div>
      <div class="ruby-editor-actions">
        <button class="btn-primary" onclick="addEncodedTextToVocab('${encodeURIComponent(note.text || '')}', 'PDF 脚注')">加入生词本</button>
        <button class="btn-ghost" onclick="speakEncodedJapanese('${encodeURIComponent(note.text || '')}')">朗读</button>
      </div>
    </div>
  `;
}

let currentSelectionText = '';

function handleReadingSelection(event){
  if(IS_ANNOTATION_EDITING) return;
  const output = document.getElementById('output');
  const tools = document.getElementById('selectionTools');
  if(!output || !tools) return;
  setTimeout(()=>{
    const selection = window.getSelection();
    const text = plainSelectedText();
    if(!text || text.length > 220 || !selection.rangeCount || !output.contains(selection.anchorNode)){
      hideSelectionTools();
      return;
    }
    currentSelectionText = text;
    document.getElementById('selectionText').textContent = text;
    document.getElementById('selectionResult').textContent = '可以查询释义、加入生词本或朗读。';
    const range = selection.getRangeAt(0).getBoundingClientRect();
    const left = Math.min(Math.max(12, range.left), window.innerWidth - 352);
    const top = Math.min(window.innerHeight - 220, range.bottom + 10);
    tools.style.left = `${left}px`;
    tools.style.top = `${Math.max(12, top)}px`;
    tools.classList.add('active');
  }, 0);
}

function hideSelectionTools(){
  document.getElementById('selectionTools')?.classList.remove('active');
}

async function lookupSelectedText(){
  const text = currentSelectionText || plainSelectedText();
  const target = document.getElementById('selectionResult');
  if(!text || !target) return;
  target.textContent = '正在查询……';
  const local = DICT[text];
  if(local){
    target.innerHTML = `<b>${escapeHtml(local.reading)}</b> · ${escapeHtml(local.pos)}<br>${escapeHtml(local.meaning)}`;
    return;
  }
  const summary = summarizeSelectedJapanese(text);
  target.innerHTML = buildChineseSentenceAnalysis(text, summary);
}

function summarizeSelectedJapanese(text){
  const hits = Object.entries(DICT)
    .filter(([word])=>text.includes(word))
    .slice(0, 5)
    .map(([word, info])=>`${word}: ${info.meaning}`);
  return hits.length ? hits.join('；') : '';
}

function buildChineseSentenceAnalysis(text, summary){
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const sentences = clean.split(/(?<=[。！？!?])/).map(item=>item.trim()).filter(Boolean).slice(0, 3);
  const parts = [];
  parts.push(`<b>选中内容</b><br>${escapeHtml(sentences.join(' ') || clean)}`);
  if(summary){
    parts.push(`<b>关键词释义</b><br>${escapeHtml(summary)}`);
  }
  parts.push('完整自然中文翻译需要接入翻译或 AI 服务；当前先提供本地词义解析，适合做 MVP 验证。');
  return parts.join('<br><br>');
}

function saveSelectedTextToVocab(){
  const text = currentSelectionText || plainSelectedText();
  if(!text) return;
  const local = DICT[text];
  addCustomToVocab(text, local?.reading || '', local?.meaning || '用户选中的词语或句子');
  document.getElementById('selectionResult').textContent = '已加入生词本。';
}

function addEncodedTextToVocab(encoded, meaning = '用户添加'){
  addCustomToVocab(decodeURIComponent(encoded || ''), '', meaning);
}

function speakSelectedText(){
  const text = currentSelectionText || plainSelectedText();
  speakJapanese(text);
}

function speakJapanese(text){
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if(!value) return;
  if(!('speechSynthesis' in window)){
    alert('当前浏览器不支持发音功能。');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(value);
  utterance.lang = 'ja-JP';
  utterance.rate = 1;
  utterance.pitch = 1;
  const jaVoice = chooseJapaneseVoice();
  if(jaVoice) utterance.voice = jaVoice;
  utterance.onstart = showTtsControlBar;
  utterance.onend = hideTtsControlBar;
  utterance.onerror = hideTtsControlBar;
  window.speechSynthesis.speak(utterance);
}

function speakEncodedJapanese(encoded){
  speakJapanese(decodeURIComponent(encoded || ''));
}

function showTtsControlBar(){
  const bar = document.getElementById('ttsControlBar');
  if(!bar) return;
  bar.classList.add('active');
  const pauseBtn = document.getElementById('ttsPauseBtn');
  if(pauseBtn) pauseBtn.textContent = '暂停';
}

function hideTtsControlBar(){
  document.getElementById('ttsControlBar')?.classList.remove('active');
}

function toggleTtsPause(){
  if(!('speechSynthesis' in window)) return;
  const pauseBtn = document.getElementById('ttsPauseBtn');
  if(window.speechSynthesis.speaking && !window.speechSynthesis.paused){
    window.speechSynthesis.pause();
    if(pauseBtn) pauseBtn.textContent = '继续';
  } else if(window.speechSynthesis.paused){
    window.speechSynthesis.resume();
    if(pauseBtn) pauseBtn.textContent = '暂停';
  }
}

function stopTts(){
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  hideTtsControlBar();
}

const RECOMMENDED_VOICE_PATTERN = /(Hattori|Kyoko|O-?ren|Otoya)/i;
const EXCLUDED_VOICE_PATTERN = /(Shelley|Sandy|Rocko|Reed|Grandpa|Grandma|Flo|Eddy)/i;

function populateVoiceOptions(){
  if(!('speechSynthesis' in window)) return;
  const allVoices = window.speechSynthesis.getVoices().filter(v=>/^ja[-_]/i.test(v.lang) && !EXCLUDED_VOICE_PATTERN.test(v.name));
  const field = document.getElementById('ttsVoiceField');
  const select = document.getElementById('ttsVoiceSelect');
  if(!select || !allVoices.length){ if(field) field.style.display = 'none'; return; }
  const recommended = allVoices.filter(v=>RECOMMENDED_VOICE_PATTERN.test(v.name));
  const others = allVoices.filter(v=>!RECOMMENDED_VOICE_PATTERN.test(v.name));
  const preferred = safeStorage.getItem('reading_tts_voice') || '';
  const optionHtml = v => `<option value="${escapeHtml(v.name)}" ${v.name===preferred?'selected':''}>${escapeHtml(v.name)}${RECOMMENDED_VOICE_PATTERN.test(v.name)?' · 推荐':''}</option>`;
  select.innerHTML = (recommended.length ? recommended.map(optionHtml).join('') : '')
    + (recommended.length && others.length ? '<option disabled>──────</option>' : '')
    + others.map(optionHtml).join('');
  if(field) field.style.display = 'flex';
  if(!preferred){
    const best = recommended[0] || allVoices.find(v=>v.localService) || allVoices[0];
    if(best){ select.value = best.name; safeStorage.setItem('reading_tts_voice', best.name); }
  }
}

function setPreferredVoice(name){
  safeStorage.setItem('reading_tts_voice', name || '');
}

function chooseJapaneseVoice(){
  const voices = window.speechSynthesis.getVoices();
  const japanese = voices.filter(voice=>/^ja[-_]/i.test(voice.lang));
  if(!japanese.length) return null;
  const preferred = safeStorage.getItem('reading_tts_voice');
  if(preferred){
    const match = japanese.find(v=>v.name === preferred);
    if(match) return match;
  }
  return japanese.find(voice=>voice.localService && /(Kyoko|Otoya|Siri|Nanami|Nozomi|Haruka|Ichiro)/i.test(voice.name)) ||
    japanese.find(voice=>voice.localService) ||
    japanese.find(voice=>/(Kyoko|Otoya|Siri|Nanami|Nozomi|Haruka|Ichiro)/i.test(voice.name)) ||
    japanese[0];
}

function renderTypingPractice(){
  if(!TYPING_PROMPTS.length){
    const meta = document.getElementById('typingMeta');
    if(meta) meta.innerHTML = '<span class="typing-chip">题库加载中</span>';
    const promptCn = document.getElementById('typingPromptCn');
    if(promptCn) promptCn.textContent = '题库还没有加载完成，请稍后再试。';
    return;
  }
  const prompt = TYPING_PROMPTS[currentTypingIndex] || TYPING_PROMPTS[0];
  const meta = document.getElementById('typingMeta');
  if(!meta) return;
  meta.innerHTML = `<span class="typing-chip">${prompt.level}</span><span class="typing-chip">${escapeHtml(prompt.grammar)}</span><span class="typing-chip">${currentTypingIndex + 1} / ${TYPING_PROMPTS.length}</span>`;
  document.getElementById('typingPromptCn').textContent = prompt.cn;
  document.getElementById('typingAnswerPreview').textContent = `提示: ${prompt.hint}`;
  document.getElementById('typingInput').value = '';
  document.getElementById('typingResult').innerHTML = '';
  renderTypingList();
}

function renderTypingList(){
  const list = document.getElementById('typingList');
  if(!list) return;
  list.innerHTML = TYPING_PROMPTS.map((prompt, index)=>`
    <button class="typing-item ${index === currentTypingIndex ? 'active' : ''}" onclick="selectTypingPrompt(${index})">
      <b>${escapeHtml(prompt.cn)}</b>
      <span>${escapeHtml(prompt.level)} · ${escapeHtml(prompt.grammar)}</span>
    </button>
  `).join('');
}

function selectTypingPrompt(index){
  currentTypingIndex = Math.max(0, Math.min(TYPING_PROMPTS.length - 1, Number(index) || 0));
  renderTypingPractice();
}

function nextTypingPrompt(){
  currentTypingIndex = (currentTypingIndex + 1) % TYPING_PROMPTS.length;
  renderTypingPractice();
}

function normalizeTypingText(text){
  return String(text || '').replace(/\s+/g, '').replace(/[，、]/g, '、').replace(/[。．.]+$/g, '。').trim();
}

function checkTypingAnswer(){
  const prompt = TYPING_PROMPTS[currentTypingIndex];
  const input = document.getElementById('typingInput').value;
  const expected = normalizeTypingText(prompt.ja);
  const actual = normalizeTypingText(input);
  const result = compareTypingText(actual, expected);
  const score = expected.length ? Math.round((result.correct / expected.length) * 100) : 0;
  document.getElementById('typingResult').innerHTML = `
    <div class="typing-score">正确率 ${score}%</div>
    <div class="typing-diff">${result.html}</div>
    <div class="typing-answer">参考答案: ${escapeHtml(prompt.ja)}</div>
  `;
  recordPracticeResult('typing', { score });
}

function compareTypingText(actual, expected){
  let correct = 0;
  let html = '';
  const max = Math.max(actual.length, expected.length);
  for(let i = 0; i < max; i += 1){
    const a = actual[i] || '';
    const e = expected[i] || '';
    if(a && e && a === e){
      correct += 1;
      html += `<span class="diff-ok">${escapeHtml(a)}</span>`;
    } else if(a && e){
      html += `<span class="diff-miss">${escapeHtml(e)}</span><span class="diff-extra">${escapeHtml(a)}</span>`;
    } else if(e){
      html += `<span class="diff-miss">${escapeHtml(e)}</span>`;
    } else if(a){
      html += `<span class="diff-extra">${escapeHtml(a)}</span>`;
    }
  }
  return { correct, html };
}

function showTypingAnswer(){
  const prompt = TYPING_PROMPTS[currentTypingIndex];
  document.getElementById('typingInput').value = prompt.ja;
  checkTypingAnswer();
}

function clearTypingResult(){
  const result = document.getElementById('typingResult');
  if(result) result.innerHTML = '';
}

function speakCurrentTypingAnswer(){
  const prompt = TYPING_PROMPTS[currentTypingIndex];
  speakJapanese(prompt?.ja || '');
}

// ---------------- 理解：挖空自测 ----------------
function refreshRetellAdvice(){
  const hasText = !!CURRENT_ARTICLE_TEXT.trim();
  const cloze = document.getElementById('clozeAdvice');
  const retell = document.getElementById('retellAdvice');
  if(cloze) cloze.textContent = hasText
    ? `当前文章约 ${CURRENT_ARTICLE_TEXT.length} 字，可以生成挖空测试。`
    : '先在「阅读」标签里分析一段文本，再回来生成挖空测试。';
  if(retell) retell.textContent = hasText
    ? '先点「朗读原文」听一遍，再点「开始录音复述」用自己的话讲一遍，结束后会展示原文和你的复述，自己对照检查。'
    : '先在「阅读」标签里分析一段文本，再回来练习复述。';
  refreshPracticeStatus();
}

function refreshPracticeStatus(){
  const hasText = !!CURRENT_ARTICLE_TEXT.trim();
  const vocab = getAllVocab();
  const vocabCount = vocab.length;
  const dueCount = vocab.filter(v => isDue(v)).length;
  const articleStatus = document.getElementById('articlePracticeStatus');
  const vocabStatus = document.getElementById('vocabPracticeStatus');
  const articleLock = document.getElementById('articleModuleLock');
  const vocabLock = document.getElementById('vocabModuleLock');
  const vocabAdvice = document.getElementById('vocabPracticeAdvice');
  const startArticle = document.getElementById('startArticlePracticeBtn');
  const startVocab = document.getElementById('startVocabPracticeBtn');

  if(articleStatus){
    articleStatus.textContent = hasText ? '文章理解：已解锁' : '文章理解：未解锁';
    articleStatus.classList.toggle('unlocked', hasText);
  }
  if(vocabStatus){
    vocabStatus.textContent = vocabCount ? `生词练习：${vocabCount} 个词` : '生词练习：未解锁';
    vocabStatus.classList.toggle('unlocked', vocabCount > 0);
  }
  if(articleLock){
    articleLock.textContent = hasText ? '已解锁' : '需要先完成阅读';
    articleLock.classList.toggle('unlocked', hasText);
  }
  if(vocabLock){
    vocabLock.textContent = vocabCount ? '已解锁' : '需要先收藏生词';
    vocabLock.classList.toggle('unlocked', vocabCount > 0);
  }
  if(vocabAdvice){
    vocabAdvice.textContent = vocabCount
      ? `生词本共有 ${vocabCount} 个词，其中 ${dueCount} 个到期复习。这里可以先做快速自测。`
      : '阅读时收藏的词会在这里变成快速自测。';
  }
  if(startArticle){
    startArticle.textContent = hasText ? '继续文章理解' : '先去阅读';
    startArticle.className = hasText ? 'btn-primary' : 'btn-ghost';
  }
  if(startVocab){
    startVocab.textContent = vocabCount ? '继续练生词' : '先收藏生词';
    startVocab.className = vocabCount ? 'btn-primary' : 'btn-ghost';
  }
}

function focusPracticeModule(type){
  if(type === 'article' && !CURRENT_ARTICLE_TEXT.trim()){
    switchWorkspace('reading');
    return;
  }
  if(type === 'vocab' && !getAllVocab().length){
    switchWorkspace('reading');
    return;
  }
  switchWorkspace('retell');
  const target = type === 'article'
    ? document.getElementById('articlePracticeModule')
    : type === 'vocab'
      ? document.getElementById('vocabPracticeModule')
      : document.getElementById('typingPracticeModule');
  target?.scrollIntoView({ behavior:'smooth', block:'start' });
}

function setArticlePracticeMode(mode){
  articlePracticeMode = mode === 'retell' ? 'retell' : 'cloze';
  document.querySelectorAll('.practice-mode-tab').forEach(button=>{
    button.classList.toggle('active', button.id === `${articlePracticeMode}ModeTab`);
  });
  document.querySelectorAll('.article-practice-panel').forEach(panel=>{
    panel.classList.toggle('active', panel.dataset.articlePractice === articlePracticeMode);
  });
}

function getVocabPracticeItems(){
  const vocab = getAllVocab();
  const due = vocab.filter(v => isDue(v));
  return due.length ? due : vocab;
}

function renderVocabPractice(){
  const empty = document.getElementById('vocabPracticeEmpty');
  const body = document.getElementById('vocabPracticeBody');
  const card = document.getElementById('vocabQuizCard');
  if(!empty || !body || !card) return;
  const items = getVocabPracticeItems();
  if(!items.length){
    empty.style.display = 'block';
    body.style.display = 'none';
    card.innerHTML = '';
    const result = document.getElementById('vocabPracticeResult');
    if(result) result.textContent = '';
    return;
  }
  empty.style.display = 'none';
  body.style.display = 'block';
  currentVocabPracticeIndex = Math.max(0, Math.min(currentVocabPracticeIndex, items.length - 1));
  const item = items[currentVocabPracticeIndex];
  card.innerHTML = `
    <div class="typing-meta">
      <span class="typing-chip">${escapeHtml(item.level || '自选')}</span>
      <span class="typing-chip">${currentVocabPracticeIndex + 1} / ${items.length}</span>
      <span class="typing-chip">${isDue(item) ? '到期' : '未到期'}</span>
    </div>
    <div class="vocab-quiz-word">${escapeHtml(item.word)}</div>
    <div class="vocab-quiz-reading">${vocabPracticeAnswerVisible ? escapeHtml(item.reading || '无假名') : '先回想读音和释义'}</div>
    <div class="vocab-quiz-meaning">${vocabPracticeAnswerVisible ? escapeHtml(item.meaning || '无释义') : '点击「显示释义」检查'}</div>
  `;
}

function nextVocabPractice(){
  const items = getVocabPracticeItems();
  if(!items.length) return;
  currentVocabPracticeIndex = (currentVocabPracticeIndex + 1) % items.length;
  vocabPracticeAnswerVisible = false;
  renderVocabPractice();
}

function prevVocabPractice(){
  const items = getVocabPracticeItems();
  if(!items.length) return;
  currentVocabPracticeIndex = (currentVocabPracticeIndex - 1 + items.length) % items.length;
  vocabPracticeAnswerVisible = false;
  renderVocabPractice();
}

function toggleVocabPracticeAnswer(){
  vocabPracticeAnswerVisible = !vocabPracticeAnswerVisible;
  renderVocabPractice();
}

function rateVocabPractice(rating){
  const items = getVocabPracticeItems();
  const item = items[currentVocabPracticeIndex];
  if(!item) return;
  const vocabItem = vocabData.find(v => v.word === item.word);
  if(vocabItem){
    if(rating === 'again'){
      vocabItem.repetition = 0;
    } else if(rating === 'hard'){
      vocabItem.repetition = Math.max(1, vocabItem.repetition || 0);
    } else {
      vocabItem.repetition = Math.min((vocabItem.repetition || 0) + 1, SRS_STEPS_MIN.length - 1);
    }
    vocabItem.lastPracticeAt = Date.now();
    vocabItem.lastPracticeRating = rating;
    const mins = SRS_STEPS_MIN[vocabItem.repetition];
    vocabItem.interval = mins;
    vocabItem.dueAt = Date.now() + mins * 60000;
    saveVocab();
    renderVocab();
  }
  recordPracticeResult('vocab', { rating });
  const result = document.getElementById('vocabPracticeResult');
  if(result){
    const label = rating === 'again' ? '不认识' : rating === 'hard' ? '模糊' : '认识';
    result.textContent = `已记录：${label}。`;
  }
  vocabPracticeAnswerVisible = false;
  nextVocabPractice();
}

function markVocabPracticeKnown(){
  rateVocabPractice('easy');
}

function generateCloze(){
  const out = document.getElementById('clozeOutput');
  const text = CURRENT_ARTICLE_TEXT;
  if(!text.trim()){
    out.innerHTML = '<span style="color:var(--ink-soft);font-size:14.5px;">还没有文本——先去「阅读」标签分析一段日语吧。</span>';
    return;
  }
  const words = Object.keys(DICT)
    .filter(w => DICT[w].level !== 'particle')
    .sort((a,b)=>b.length-a.length);
  let segments = [{text, matched:null}];
  words.forEach(word=>{
    const next = [];
    segments.forEach(seg=>{
      if(seg.matched){ next.push(seg); return; }
      const parts = seg.text.split(word);
      for(let i=0;i<parts.length;i++){
        if(parts[i]) next.push({text:parts[i], matched:null});
        if(i < parts.length-1) next.push({text:word, matched:word});
      }
    });
    segments = next;
  });

  CLOZE_ITEMS = [];
  let blankId = 0;
  let html = '';
  segments.forEach(seg=>{
    if(seg.matched && Math.random() < 0.45){
      const id = blankId++;
      const info = DICT[seg.matched];
      CLOZE_ITEMS.push({ id, word: seg.matched, reading: info.reading });
      const widthEm = Math.max(2.6, seg.matched.length * 1.5);
      html += `<input type="text" class="cloze-blank" data-cloze-id="${id}" style="width:${widthEm}em;">`;
    } else {
      html += escapeHtml(seg.text).replace(/\n/g, '<br>');
    }
  });

  if(!CLOZE_ITEMS.length){
    out.innerHTML = '<span style="color:var(--ink-soft);font-size:14.5px;">这段文本没匹配到内置词库里的生词，挖空测试暂时生成不了，换一段试试。</span>';
    document.getElementById('clozeScore').textContent = '';
    return;
  }
  out.innerHTML = html;
  document.getElementById('clozeScore').textContent = `共 ${CLOZE_ITEMS.length} 处空格`;
}

function checkCloze(){
  if(!CLOZE_ITEMS.length) return;
  let correct = 0;
  CLOZE_ITEMS.forEach(item=>{
    const input = document.querySelector(`[data-cloze-id="${item.id}"]`);
    if(!input) return;
    const val = input.value.trim();
    const ok = !!val && (val === item.word || katakanaToHiragana(val) === katakanaToHiragana(item.reading));
    input.style.borderColor = ok ? 'var(--n5)' : 'var(--trap)';
    input.style.background = ok ? 'var(--n5-bg)' : 'var(--trap-bg)';
    input.title = ok ? '正确' : `正确答案：${item.word}（${item.reading}）`;
    if(ok) correct += 1;
  });
  document.getElementById('clozeScore').textContent = `正确 ${correct} / ${CLOZE_ITEMS.length} —— 没填对的空格鼠标悬停可以看正确答案`;
  recordPracticeResult('cloze', { correct, total: CLOZE_ITEMS.length });
}

function revealCloze(){
  if(!CLOZE_ITEMS.length) return;
  CLOZE_ITEMS.forEach(item=>{
    const input = document.querySelector(`[data-cloze-id="${item.id}"]`);
    if(!input) return;
    input.value = item.word;
    input.style.borderColor = 'var(--aizome)';
    input.style.background = '#fff';
    input.title = '';
  });
  document.getElementById('clozeScore').textContent = '已显示全部答案';
}

// ---------------- 输出：口语复述（对照原文自查，不做自动判分） ----------------
function speakOriginalForRetell(){
  if(!CURRENT_ARTICLE_TEXT.trim()){
    alert('请先在「阅读」标签里分析一段文本。');
    return;
  }
  speakJapanese(CURRENT_ARTICLE_TEXT);
}

function toggleRetellRecording(){
  if(RETELL_RECORDING){ stopRetellRecording(); return; }
  startRetellRecording();
}

async function startRetellRecording(){
  if(!CURRENT_ARTICLE_TEXT.trim()){
    alert('请先在「阅读」标签里分析一段文本。');
    return;
  }
  const resultBox = document.getElementById('retellResult');
  const btn = document.getElementById('retellRecordBtn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    resultBox.innerHTML = `
      <div class="typing-score" style="color:var(--trap);">当前浏览器不支持语音识别（建议用桌面版 Chrome）。你也可以直接打字复述：</div>
      <textarea id="retellManualInput" class="typing-input" placeholder="凭记忆打字复述刚才读到的内容……" style="margin-top:10px;"></textarea>
      <div class="btnrow"><button class="btn-primary" onclick="showRetellComparison(document.getElementById('retellManualInput').value)">对照原文</button></div>
    `;
    return;
  }

  if(RETELL_AUDIO_URL){ URL.revokeObjectURL(RETELL_AUDIO_URL); RETELL_AUDIO_URL = null; }
  RETELL_AUDIO_CHUNKS = [];

  if(navigator.mediaDevices?.getUserMedia && window.MediaRecorder){
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      RETELL_MEDIA_RECORDER = new MediaRecorder(stream);
      RETELL_MEDIA_RECORDER.ondataavailable = (event)=>{ if(event.data.size) RETELL_AUDIO_CHUNKS.push(event.data); };
      RETELL_MEDIA_RECORDER.onstop = ()=>{
        if(RETELL_AUDIO_CHUNKS.length){
          RETELL_AUDIO_URL = URL.createObjectURL(new Blob(RETELL_AUDIO_CHUNKS, { type: 'audio/webm' }));
        }
        stream.getTracks().forEach(track=>track.stop());
        renderRetellAudioSlot();
      };
      RETELL_MEDIA_RECORDER.start();
    }catch(error){
      RETELL_MEDIA_RECORDER = null;
      console.warn('无法录制可回放的音频,只保留语音转写文字。', error);
    }
  }

  RETELL_RECOGNITION = new SR();
  RETELL_RECOGNITION.lang = 'ja-JP';
  RETELL_RECOGNITION.interimResults = true;
  RETELL_RECOGNITION.continuous = true;
  let finalTranscript = '';
  RETELL_RECOGNITION.onresult = (event)=>{
    let interim = '';
    for(let i = event.resultIndex; i < event.results.length; i++){
      const chunk = event.results[i][0].transcript;
      if(event.results[i].isFinal) finalTranscript += chunk;
      else interim += chunk;
    }
    RETELL_RECOGNITION._final = finalTranscript;
    resultBox.innerHTML = `
      <div class="recording-indicator"><span class="recording-dot"></span>正在录音…… 说完后点「停止录音」</div>
      <div class="typing-diff" style="margin-top:8px;">${escapeHtml(finalTranscript)}<span style="color:var(--ink-soft);">${escapeHtml(interim)}</span></div>
    `;
  };
  RETELL_RECOGNITION.onerror = (event)=>{
    resultBox.innerHTML = `<div class="typing-score" style="color:var(--trap);">识别出错：${escapeHtml(event.error || '未知错误')}，请重试。</div>`;
    RETELL_RECORDING = false;
    if(btn){ btn.textContent = '开始录音复述'; btn.classList.remove('is-recording'); }
    if(RETELL_MEDIA_RECORDER?.state === 'recording') RETELL_MEDIA_RECORDER.stop();
  };
  RETELL_RECOGNITION.onend = ()=>{
    if(RETELL_RECORDING){
      showRetellComparison(RETELL_RECOGNITION._final || '');
      RETELL_RECORDING = false;
      if(btn){ btn.textContent = '开始录音复述'; btn.classList.remove('is-recording'); }
    }
  };
  RETELL_RECOGNITION.start();
  RETELL_RECORDING = true;
  if(btn){ btn.textContent = '⏹ 停止录音'; btn.classList.add('is-recording'); }
  resultBox.innerHTML = '<div class="recording-indicator"><span class="recording-dot"></span>正在录音…… 请开始用日语复述</div>';
}

function stopRetellRecording(){
  if(RETELL_RECOGNITION) RETELL_RECOGNITION.stop();
  if(RETELL_MEDIA_RECORDER?.state === 'recording') RETELL_MEDIA_RECORDER.stop();
}

function showRetellComparison(transcript){
  const clean = String(transcript || '').trim();
  const resultBox = document.getElementById('retellResult');
  resultBox.innerHTML = `
    <div class="typing-score">复述完成 —— 左右对照原文，自己检查内容是否完整、有没有说错的地方</div>
    <div id="retellAudioSlot" style="margin-top:8px;"></div>
    <div class="retell-compare">
      <div>
        <div class="typing-meta"><span class="typing-chip">原文</span></div>
        <div class="typing-diff">${escapeHtml(CURRENT_ARTICLE_TEXT).replace(/\n/g, '<br>')}</div>
      </div>
      <div>
        <div class="typing-meta"><span class="typing-chip">你的复述（语音识别文字）</span></div>
        <div class="typing-diff">${clean ? escapeHtml(clean) : '<span style="color:var(--ink-soft);">没有识别到内容，再试一次。</span>'}</div>
      </div>
    </div>
  `;
  renderRetellAudioSlot();
}

function renderRetellAudioSlot(){
  const slot = document.getElementById('retellAudioSlot');
  if(!slot) return;
  slot.innerHTML = RETELL_AUDIO_URL
    ? `<audio controls src="${RETELL_AUDIO_URL}" style="width:100%;"></audio>`
    : (RETELL_MEDIA_RECORDER ? '<span class="lookup-status">处理录音中……</span>' : '');
}

let vocabData = [];

async function loadVocab(){
  try{
    if(window.storage && window.storage.get){
      const res = await window.storage.get('reading_vocab_list', false);
      vocabData = res && res.value ? JSON.parse(res.value) : [];
    } else {
      vocabData = JSON.parse(safeStorage.getItem('reading_vocab_list') || '[]');
    }
  }catch(e){ vocabData = []; }
  // 迁移旧数据:补齐SRS字段,避免之前版本存的数据缺字段报错
  vocabData.forEach(v=>{
    if(v.repetition===undefined) v.repetition = 0;
    if(v.interval===undefined) v.interval = 0;
    if(v.dueAt===undefined) v.dueAt = Date.now();
    if(v.level===undefined) v.level = 'N5';
    if(v.lastPracticeAt===undefined) v.lastPracticeAt = null;
    if(v.lastPracticeRating===undefined) v.lastPracticeRating = '';
  });
  renderVocab();
}

async function saveVocab(){
  try{
    if(window.storage && window.storage.set){
      await window.storage.set('reading_vocab_list', JSON.stringify(vocabData), false);
    } else {
      safeStorage.setItem('reading_vocab_list', JSON.stringify(vocabData));
    }
  }catch(e){ console.error('保存生词本失败', e); }
}

function addToVocab(word){
  const info = DICT[word];
  if(!info) return;
  addCustomToVocab(word, info.reading, info.meaning, info.level, info.pos);
}

function addTokenToVocab(tokenId){
  const token = window.KUROMOJI_TOKEN_CACHE[tokenId];
  if(!token) return;
  const { surface, info } = token;
  addCustomToVocab(surface, info.reading, info.meaning, info.level, info.pos);
}

function addCustomToVocab(word, reading = '', meaning = '用户添加', level = 'kuromoji', pos = '自选内容'){
  const normalized = String(word || '').trim();
  if(!normalized || vocabData.find(v=>v.word===normalized)) return;
  vocabData.unshift({
    word:normalized, reading, meaning,
    level, pos,
    repetition:0, interval:0, dueAt: Date.now(),
    lastPracticeAt:null, lastPracticeRating:''
  });
  saveVocab();
  renderVocab();
}

function removeFromVocab(word){
  try{ word = decodeURIComponent(word); }catch{}
  vocabData = vocabData.filter(v=>v.word!==word);
  saveVocab();
  renderVocab();
}

function renderVocab(){
  const list = document.getElementById('vocabList');
  const empty = document.getElementById('vocabEmptyMsg');
  document.getElementById('vocabCount').textContent = vocabData.length;
  const badge = document.getElementById('vocabBadgeCount');
  if(badge) badge.textContent = vocabData.length;
  const total = document.getElementById('totalVocabCount');
  if(total) total.textContent = vocabData.length;
  if(vocabData.length===0){ list.innerHTML=''; empty.style.display='block'; updateDueCount(); return; }
  empty.style.display='none';
  const now = Date.now();
  list.innerHTML = vocabData.map(v=>{
    const isDue = v.dueAt <= now;
    const tag = isDue
      ? '<span class="vocab-due-tag due-now">待复习</span>'
      : `<span class="vocab-due-tag due-later">${formatDue(v.dueAt)}</span>`;
    const practiceTag = vocabPracticeTag(v);
    return `
    <li>
      <div>
        <span class="vocab-word">${escapeHtml(v.word)}<span style="font-size:11px;color:var(--ink-soft);font-weight:400;margin-left:6px;">${escapeHtml(v.reading || '')}</span>${tag}${practiceTag}</span>
        <span class="vocab-meaning">${escapeHtml(v.meaning || '')}</span>
      </div>
      <button class="vocab-remove" onclick="removeFromVocab('${encodeURIComponent(v.word)}')" aria-label="移除 ${escapeHtml(v.word)}">×</button>
    </li>
  `;}).join('');
  updateDueCount();
  syncVocabPanelData();
}

function vocabPracticeTag(v){
  if(!v.lastPracticeAt) return '';
  if(v.lastPracticeRating === 'again') return '<span class="vocab-practice-tag needs-work">需加强</span>';
  if(v.lastPracticeRating === 'hard') return '<span class="vocab-practice-tag needs-work">模糊</span>';
  if(v.lastPracticeRating === 'easy') return '<span class="vocab-practice-tag practiced">已练过</span>';
  return '';
}

function formatDue(ts){
  const diffMin = Math.round((ts - Date.now())/60000);
  if(diffMin < 60) return `${diffMin}分钟后`;
  if(diffMin < 1440) return `${Math.round(diffMin/60)}小时后`;
  return `${Math.round(diffMin/1440)}天后`;
}

function updateDueCount(){
  const now = Date.now();
  const due = vocabData.filter(v=>v.dueAt<=now).length;
  const dueEl = document.getElementById('dueCount');
  if(dueEl) dueEl.textContent = due;
  const total = document.getElementById('totalVocabCount');
  if(total) total.textContent = vocabData.length;
  const pageDue = document.getElementById('dueCountPage');
  if(pageDue) pageDue.textContent = due;
}

// ---------------- 新增：导出与清空功能 ----------------
function downloadTextFile(filename, content, type = 'text/plain;charset=utf-8;'){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp(){
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function setInlineStatus(id, message, type = 'ok'){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = message;
  el.className = `export-inline-status ${type}`.trim();
  if(message) setTimeout(()=>{
    if(el.textContent === message) el.textContent = '';
  }, 4500);
}

function setVocabExportStatus(message, type = 'ok'){
  ['vocabExportStatus', 'vocabExportStatusPage', 'vocabExportStatusPanel'].forEach(id=>{
    setInlineStatus(id, message, type);
  });
}

// 导出生词本为 CSV (适配 Anki)
function exportVocabCsv() {
  if (vocabData.length === 0) {
    alert("生词本是空的，先去添加几个单词吧！");
    return;
  }
  // 添加 BOM 头 \uFEFF，防止 Excel 打开时出现中文乱码
  let csvContent = "\uFEFF"; 
  // 定义表头：单词, 假名, 释义, 词性, JLPT等级
  csvContent += "单词,假名,释义,词性,等级\n";
  
  const csvField = value => `"${String(value || '').replace(/"/g, '""')}"`;
  csvContent += vocabData.map(v =>
    [v.word, v.reading, v.meaning, v.pos, v.level].map(csvField).join(',')
  ).join("\n");

  downloadTextFile("读得懂_生词本导出.csv", csvContent, 'text/csv;charset=utf-8;');
  setVocabExportStatus(`已导出 ${vocabData.length} 个词的 CSV 文件。`);
}

function exportAnkiTsv(){
  if(vocabData.length === 0){
    alert('生词本是空的，先添加几个词再导出 Anki。');
    return;
  }
  const clean = value => String(value || '').replace(/\t/g, ' ').replace(/\r?\n/g, '<br>');
  const lines = vocabData.map(v => [
    clean(v.word),
    clean(v.reading),
    clean(v.meaning),
    clean(v.pos),
    clean(v.level),
    clean(v.sourceTitle || '')
  ].join('\t'));
  const header = '# 正面\t假名\t释义\t词性\t等级\t来源\n';
  downloadTextFile(`dokedo-anki-${todayStamp()}.tsv`, header + lines.join('\n'), 'text/tab-separated-values;charset=utf-8;');
  setVocabExportStatus(`已导出 ${vocabData.length} 个词，可在 Anki 中选择「导入文件」。`);
}

function exportLearningBackup(){
  const backup = {
    app:'dokedo-japanese-reader',
    version:1,
    exportedAt:new Date().toISOString(),
    vocab:vocabData,
    history:READING_HISTORY,
    practiceHistory:PRACTICE_HISTORY,
    rubyOverrides:RUBY_OVERRIDES,
    preferredVoice:safeStorage.getItem('reading_tts_voice') || '',
    workspace:safeStorage.getItem('reading_workspace') || 'reading',
    levelResult:safeStorage.getItem('reading_level_result') || ''
  };
  downloadTextFile(`dokedo-backup-${todayStamp()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8;');
}

async function importLearningBackup(file){
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data || data.app !== 'dokedo-japanese-reader') throw new Error('这不是有效的读得懂备份文件。');
    vocabData = Array.isArray(data.vocab) ? data.vocab : [];
    READING_HISTORY = Array.isArray(data.history) ? data.history.slice(0, 50) : [];
    PRACTICE_HISTORY = Array.isArray(data.practiceHistory)
      ? data.practiceHistory.map(item => normalizePracticeStats(item, item.date)).slice(0, 30)
      : PRACTICE_HISTORY;
    const restoredToday = PRACTICE_HISTORY.find(item => item.date === practiceDateKey());
    if(restoredToday) PRACTICE_STATS = normalizePracticeStats(restoredToday, restoredToday.date);
    RUBY_OVERRIDES = data.rubyOverrides && typeof data.rubyOverrides === 'object' ? data.rubyOverrides : {};
    safeStorage.setItem('reading_ruby_overrides', JSON.stringify(RUBY_OVERRIDES));
    if(data.preferredVoice) safeStorage.setItem('reading_tts_voice', data.preferredVoice);
    if(data.levelResult) safeStorage.setItem('reading_level_result', data.levelResult);
    await saveVocab();
    saveReadingHistory();
    savePracticeStats();
    syncPracticeHistory();
    renderVocab();
    renderReadingHistory();
    renderPracticeSummary();
    alert('备份已恢复。');
  }catch(error){
    alert(error.message || '备份恢复失败。');
  }finally{
    const input = document.getElementById('backupFileInput');
    if(input) input.value = '';
  }
}

function backupData(){
  exportLearningBackup();
}

function restoreData(){
  document.getElementById('backupFileInput')?.click();
}

function clearHistory(){
  clearReadingHistory();
}

// 一键清空生词本
function clearAllVocab() {
  if (vocabData.length === 0) return;
  if (confirm("确定要清空生词本里的所有单词吗？清空后无法恢复。")) {
    vocabData = [];
    saveVocab();     // 保存空数组到本地存储
    renderVocab();   // 重新渲染列表
    
    // 清除正文中高亮词汇的 active 状态
    document.querySelectorAll('.w.active').forEach(el => el.classList.remove('active'));
    // 清空详情卡片区域
    const detailArea = document.getElementById('detailArea');
    if(detailArea) {
      detailArea.innerHTML = '<div class="detail-empty">分析后点击带颜色的词语，这里会显示读音、释义和等级。</div>';
    }
  }
}

// ---------------- 闪卡复习(简化版 SRS,间隔单位为分钟,方便现场演示)----------------
const SRS_STEPS_MIN = [1, 10, 30, 120, 720, 1440, 4320, 10080, 20160]; // 1分钟→10分钟→30分钟→2小时→12小时→1天→3天→7天→14天
let reviewQueue = [];
let currentCardWord = null;
let cardFlipped = false;

function getFlashArea(){
  return document.getElementById('flashArea');
}

function setFlashArea(message){
  const area = getFlashArea();
  if(area) area.innerHTML = `<div class="flash-empty">${message}</div>`;
}

function startReview(){
  switchWorkspace('vocab');
  const now = Date.now();
  reviewQueue = vocabData.filter(v=>v.dueAt<=now).map(v=>v.word);
  if(reviewQueue.length===0){
    setFlashArea('现在没有到期的词。想马上练习的话，可以点「全部复习」。');
    return;
  }
  showNextCard();
}

function reviewAllVocab(){
  switchWorkspace('vocab');
  if(!vocabData.length){
    setFlashArea('生词本是空的。先去阅读页分析一篇文章，再收藏几个词。');
    return;
  }
  reviewQueue = [...vocabData]
    .sort(()=>Math.random() - 0.5)
    .slice(0, 10)
    .map(v=>v.word);
  showNextCard();
}

function showNextCard(){
  cardFlipped = false;
  if(reviewQueue.length===0){
    setFlashArea('这一轮复习完成了。词汇列表会显示每个词的下次复习时间。');
    return;
  }
  currentCardWord = reviewQueue[0];
  renderCard();
}

function renderCard(){
  const v = vocabData.find(x=>x.word===currentCardWord);
  if(!v){ reviewQueue.shift(); showNextCard(); return; }
  const area = getFlashArea();
  if(!area) return;
  if(!cardFlipped){
    area.innerHTML = `
      <div class="flash-stage" onclick="flipCard()">
        <div class="flash-word">${v.word}</div>
        <div class="flash-tap-hint">点击卡片查看读音和释义</div>
      </div>
    `;
  } else {
    area.innerHTML = `
      <div class="flash-stage" onclick="flipCard()">
        <div class="flash-word">${v.word}</div>
        <div class="flash-reading">${v.reading}</div>
        <div class="flash-meaning">${v.meaning}</div>
      </div>
      <div class="rate-row">
        <button class="rate-btn rate-again" onclick="rateCard('again')">没记住</button>
        <button class="rate-btn rate-hard" onclick="rateCard('hard')">有点犹豫</button>
        <button class="rate-btn rate-easy" onclick="rateCard('easy')">记住了</button>
      </div>
    `;
  }
}

function flipCard(){
  cardFlipped = !cardFlipped;
  renderCard();
}

function rateCard(rating){
  const v = vocabData.find(x=>x.word===currentCardWord);
  if(v){
    if(rating === 'again'){
      v.repetition = 0;
    } else if(rating === 'hard'){
      v.repetition = Math.max(0, v.repetition); // 维持当前等级,不前进
    } else { // easy
      v.repetition = Math.min(v.repetition + 1, SRS_STEPS_MIN.length - 1);
    }
    const mins = SRS_STEPS_MIN[v.repetition];
    v.interval = mins;
    v.dueAt = Date.now() + mins * 60000;
    v.lastPracticeAt = Date.now();
    v.lastPracticeRating = rating;
    saveVocab();
  }
  recordPracticeResult('vocab', {rating});
  reviewQueue.shift();
  showNextCard();
  renderVocab();
}

loadVocab();

// ---------------- 阅读历史、推荐来源、水平测试 ----------------
function loadReadingHistory(){
  try{ READING_HISTORY = JSON.parse(safeStorage.getItem('reading_history') || '[]'); }
  catch{ READING_HISTORY = []; }
}

function saveReadingHistory(){
  safeStorage.setItem('reading_history', JSON.stringify(READING_HISTORY.slice(0, 50)));
}

function articleTitleFromText(text){
  const firstLine = String(text || '').split('\n').map(v=>v.trim()).find(Boolean) || '未命名文章';
  return firstLine.length > 34 ? firstLine.slice(0, 34) + '…' : firstLine;
}

function saveCurrentArticleToHistory(){
  const text = CURRENT_ARTICLE_TEXT.trim();
  const output = document.getElementById('output');
  if(!text || !output) return;
  const compact = text.replace(/\s+/g, '');
  const existingIndex = READING_HISTORY.findIndex(item => item.fingerprint === compact.slice(0, 180));
  const item = {
    id: Date.now(),
    title: articleTitleFromText(text),
    source:'手动导入',
    date:new Date().toISOString(),
    chars:text.length,
    text,
    annotatedHtml:output.innerHTML,
    fingerprint:compact.slice(0, 180)
  };
  if(existingIndex >= 0) READING_HISTORY.splice(existingIndex, 1);
  READING_HISTORY.unshift(item);
  READING_HISTORY = READING_HISTORY.slice(0, 50);
  saveReadingHistory();
  renderDailyPlan();
}

function renderReadingHistory(){
  renderLearningProgress();
  const list = document.getElementById('historyList');
  if(!list) return;
  const keyword = (document.getElementById('historySearch')?.value || '').trim().toLowerCase();
  const filtered = READING_HISTORY.filter(item => {
    const haystack = `${item.title} ${item.source} ${item.text}`.toLowerCase();
    return !keyword || haystack.includes(keyword);
  });
  if(!filtered.length){
    list.innerHTML = '<div class="history-empty"><p>还没有阅读历史。分析一篇文章后，会自动保存在这里。</p><button class="btn-primary" onclick="switchWorkspace(\'reading\')">去读一篇文章</button></div>';
    return;
  }
  list.innerHTML = filtered.map(item => `
    <article class="history-item">
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${new Date(item.date).toLocaleString()} · ${Number(item.chars || 0).toLocaleString()} 字</p>
      </div>
      <div class="history-actions">
        <button class="btn-primary" onclick="restoreHistoryArticle(${item.id})">打开</button>
        <button class="btn-ghost" onclick="removeHistoryArticle(${item.id})">删除</button>
      </div>
    </article>
  `).join('');
}

function restoreHistoryArticle(id){
  const item = READING_HISTORY.find(entry => entry.id === id);
  if(!item) return;
  document.getElementById('inputText').value = item.text || '';
  CURRENT_ARTICLE_TEXT = item.text || '';
  document.getElementById('output').innerHTML = item.annotatedHtml || escapeHtml(item.text || '');
  setReadingReady(true);
  setPostAnalysisActionsVisible(true);
  refreshRetellAdvice();
  switchWorkspace('reading');
}

function removeHistoryArticle(id){
  READING_HISTORY = READING_HISTORY.filter(item => item.id !== id);
  saveReadingHistory();
  renderReadingHistory();
}

function clearReadingHistory(){
  if(!READING_HISTORY.length) return;
  if(!confirm('确定要清空阅读历史吗？生词本不会被删除。')) return;
  READING_HISTORY = [];
  saveReadingHistory();
  renderReadingHistory();
}

function renderSourceDirectory(){
  const target = document.getElementById('sourceDirectory');
  if(!target) return;
  const recommended = (safeStorage.getItem('reading_level_result') || '').split('｜')[0] || '';
  target.innerHTML = READING_SOURCES.map(source => `
    <article class="source-directory-item ${recommended && (source.level.includes(recommended) || recommended.includes(source.level.split('-')[0])) ? 'recommended' : ''}">
      <span>${escapeHtml(source.level)}</span>
      <div class="source-directory-copy">
        <h3>${escapeHtml(source.title)}</h3>
        <p>${escapeHtml(source.note)}</p>
      </div>
      <div class="btnrow">
        <button class="btn-primary" onclick="useSourceUrl('${encodeURIComponent(source.url)}')">复制到阅读页</button>
        <button class="btn-ghost" onclick="openRecommendedSource('${source.url}')">打开网站</button>
      </div>
    </article>
  `).join('');
}

function useSourceUrl(encodedUrl){
  const url = decodeURIComponent(encodedUrl);
  document.getElementById('inputText').value = url;
  switchWorkspace('reading');
  editSourceText();
  setImportStatus('已填入推荐来源链接。确认是具体文章页后，点击「开始阅读」。');
}

function renderLevelTest(){
  const target = document.getElementById('levelTest');
  if(!target || target.dataset.rendered) return;
  target.dataset.rendered = '1';
  target.innerHTML = LEVEL_TEST_QUESTIONS.map((item, index) => `
    <fieldset class="level-question">
      <legend><span>${escapeHtml(item.level)}</span>${index + 1}. ${escapeHtml(item.q)}</legend>
      ${item.options.map((option, optionIndex) => `
        <label><input type="radio" name="level-q-${index}" value="${optionIndex}"> ${escapeHtml(option)}</label>
      `).join('')}
    </fieldset>
  `).join('');
  const saved = safeStorage.getItem('reading_level_result');
  if(saved) showLevelResult(saved);
}

function startLevelTest(){
  renderLevelTest();
  const actions = document.getElementById('levelScoreActions');
  if(actions) actions.style.display = 'flex';
  document.getElementById('levelTest')?.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function scoreLevelTest(){
  let score = 0;
  let answered = 0;
  LEVEL_TEST_QUESTIONS.forEach((item, index)=>{
    const checked = document.querySelector(`input[name="level-q-${index}"]:checked`);
    if(!checked) return;
    answered += 1;
    if(Number(checked.value) === item.answer) score += 1;
  });
  if(answered < 6){
    document.getElementById('levelResult').textContent = '至少完成 6 题，结果会更可靠。';
    return;
  }
  const level = score <= 2 ? 'N5-N4' : score <= 4 ? 'N4-N3' : score <= 6 ? 'N3-N2' : score <= 8 ? 'N2' : 'N1';
  const result = `${level}｜答对 ${score}/${answered} 题`;
  safeStorage.setItem('reading_level_result', result);
  showLevelResult(result);
  renderSourceDirectory();
  document.getElementById('sourceDirectory')?.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function showLevelResult(result){
  const badge = document.getElementById('levelResultBadge');
  const box = document.getElementById('levelResult');
  if(badge) badge.textContent = result.split('｜')[0] || result;
  if(box) box.innerHTML = `建议从 <b>${escapeHtml(result.split('｜')[0] || result)}</b> 的材料开始。<br><span>${escapeHtml(result)}</span><br><button class="btn-ghost" onclick="switchWorkspace('discover')" style="margin-top:12px;padding:6px 16px;font-size:13px;">前往「找材料」查看推荐</button>`;
}

function resetLevelTest(){
  document.querySelectorAll('#levelTest input[type="radio"]').forEach(input=>input.checked = false);
  localStorage.removeItem('reading_level_result');
  document.getElementById('levelResultBadge').textContent = '未测试';
  document.getElementById('levelResult').textContent = '完成后会推荐适合你的阅读等级，并在「找材料」里高亮相近来源。';
  const test = document.getElementById('levelTest');
  if(test){
    test.innerHTML = '';
    delete test.dataset.rendered;
  }
  const actions = document.getElementById('levelScoreActions');
  if(actions) actions.style.display = 'none';
  renderSourceDirectory();
}

// ---------------- 语法点词典 ----------------
let openGrammarTitle = null;

function renderGrammar(){
  if(!GRAMMAR_POINTS.length){
    const grid = document.getElementById('grammarGrid');
    if(grid) grid.innerHTML = '<div class="grammar-empty"><p>语法点正在加载，请稍后再试。</p><button class="btn-primary" onclick="switchWorkspace(\'reading\')">先去阅读</button></div>';
    return;
  }
  const keyword = document.getElementById('grammarSearch').value.trim().toLowerCase();
  const grid = document.getElementById('grammarGrid');
  const filtered = GRAMMAR_POINTS.filter(g =>
    !keyword || g.title.toLowerCase().includes(keyword) || g.sub.toLowerCase().includes(keyword) || g.explain.toLowerCase().includes(keyword)
  );
  if(filtered.length===0){
    grid.innerHTML = '<div class="grammar-empty"><p>没有找到匹配的语法点，换个关键词试试。</p><button class="btn-ghost" onclick="document.getElementById(\'grammarSearch\').value=\'\';renderGrammar();">查看全部语法</button></div>';
    return;
  }
  grid.innerHTML = filtered.map(g=>{
    const isOpen = openGrammarTitle === g.title;
    const levelColor = g.level==='N5' ? 'var(--n5)' : g.level==='N4' ? 'var(--n4)' : 'var(--n3)';
    const levelBg = g.level==='N5' ? 'var(--n5-bg)' : g.level==='N4' ? 'var(--n4-bg)' : 'var(--n3-bg)';
    return `
      <div class="gpoint ${isOpen?'open':''}" onclick="toggleGrammar('${g.title.replace(/'/g,"\\'")}')">
        <div class="gpoint-head">
          <span class="gpoint-title">${g.title}</span>
          <span class="gpoint-level" style="color:${levelColor};background:${levelBg};">${g.level}</span>
        </div>
        <div class="gpoint-sub">${g.sub}</div>
        <div class="gpoint-body">
          <div class="explain">${g.explain}</div>
          ${g.examples.map(ex=>`<div class="gpoint-ex"><div class="jp">${ex.jp}</div><div class="cn">${ex.cn}</div></div>`).join('')}
          <div class="gpoint-pitfall"><b>中文母语者易踩坑:</b>${g.pitfall}</div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleGrammar(title){
  openGrammarTitle = openGrammarTitle === title ? null : title;
  renderGrammar();
}

function openOnboarding(){
  document.getElementById('onboardingBanner')?.classList.remove('is-hidden');
}
function dismissOnboarding(){
  document.getElementById('onboardingBanner')?.classList.add('is-hidden');
  safeStorage.setItem('reading_onboarding_dismissed', '1');
}
function startOnboardingDemo(){
  switchWorkspace('reading');
  loadSample();
  dismissOnboarding();
  document.getElementById('output')?.scrollIntoView({ behavior:'smooth', block:'start' });
}
if(safeStorage.getItem('reading_onboarding_dismissed')) dismissOnboarding();

async function initializeApp(){
  loadReadingHistory();
  try{
    DATA_READY = ensureLearningData();
    await DATA_READY;
  }catch(error){
    showDataLoadError(error);
  }

  renderGrammar();
  renderSourceDirectory();
  renderPracticeSummary();
  renderDailyPlan();
  const savedLevelResult = safeStorage.getItem('reading_level_result');
  if(savedLevelResult) showLevelResult(savedLevelResult);
  setTokenizerStatus('默认使用轻量词库，需要时可手动开启智能分词', '');
  document.getElementById('useKuromoji')?.addEventListener('change', renderText);

  if('speechSynthesis' in window){
    populateVoiceOptions();
    window.speechSynthesis.onvoiceschanged = populateVoiceOptions;
  }
  document.getElementById('exportModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeExportModal();
  });
  document.getElementById('importPreviewModal')?.addEventListener('click', event=>{
    if(event.target === event.currentTarget) closeImportPreview();
  });
  document.getElementById('importPreviewText')?.addEventListener('input', updateImportPreviewSummary);
  document.querySelectorAll('#pptExportSettings input').forEach(input=>input.addEventListener('input', updateExportPreview));
  document.getElementById('output')?.addEventListener('mouseup', handleReadingSelection);
  document.getElementById('output')?.addEventListener('keyup', handleReadingSelection);
  document.addEventListener('mousedown', event=>{
    const tools = document.getElementById('selectionTools');
    const output = document.getElementById('output');
    if(tools?.contains(event.target) || output?.contains(event.target)) return;
    hideSelectionTools();
  });
  document.addEventListener('keydown', event=>{
    if(event.key === 'Escape'){ closeExportModal(); closeImportPreview(); }
  });
  switchWorkspace(safeStorage.getItem('reading_workspace') || 'reading');
  renderTypingPractice();
  syncExportOptions();
}

initializeApp();
