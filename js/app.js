'use strict';

/* ============================================================
   拾知 - 运营岗位资质题库刷题平台
   ============================================================ */

/* ===== Global State ===== */
const App = {
  questions: [],
  meta: {},
  stats: {},        // per-question stats
  wrongSet: new Set(),
  sessionLog: [],   // today's session
  dailyLog: {},     // date -> {count, correct}
  settings: {
    theme: 'japanese',
    soundEnabled: true,
    soundType: 'gentle',
    customHue: null,
    customSat: null,
    customLight: null,
    customBrightness: null,
    fontSize: 16,
    showAnswerImmediately: true,
    effectsEnabled: true,
  },
  currentMode: null,
  currentQuiz: null,
  isReady: false,
};

/* ===== Theme List ===== */
const THEMES = [
  { id: 'japanese', name: '和風', desc: '日系简约' },
  { id: 'ink', name: '墨韵', desc: '水墨黑白' },
  { id: 'sakura', name: '樱花', desc: '柔粉' },
  { id: 'zen', name: '枯山水', desc: '禅意砂色' },
  { id: 'pokemon-gba', name: '宝可梦GBA', desc: '点阵绿屏' },
  { id: 'cyberpunk', name: '赛博朋克', desc: '霓虹光污' },
  { id: 'stardew', name: '星露谷', desc: '像素田园' },
  { id: 'shinkai', name: '新海诚', desc: '漫画天空' },
  { id: 'deepsea', name: '深海', desc: '幽蓝深邃' },
  { id: 'forest', name: '森林', desc: '自然绿意' },
  { id: 'twilight', name: '暮色', desc: '紫橙渐变' },
  { id: 'aurora', name: '极光', desc: '极光流彩' },
  { id: 'warmsun', name: '暖阳', desc: '暖黄' },
  { id: 'coldmoon', name: '冷月', desc: '银灰清冷' },
  { id: 'redplum', name: '红梅', desc: '朱红点缀' },
  { id: 'bamboo', name: '竹林', desc: '翠竹' },
  { id: 'forbidden', name: '紫禁', desc: '宫墙金' },
  { id: 'obsidian', name: '黑曜', desc: '暗黑材质' },
  { id: 'ricepaper', name: '宣纸', desc: '纸质暖色' },
  { id: 'mint', name: '薄荷', desc: '清凉绿' },
  { id: 'rosegold', name: '玫瑰金', desc: '玫瑰金属' },
  { id: 'neon-night', name: '霓虹夜', desc: '暗夜霓虹' },
  { id: 'retro', name: '复古', desc: '怀旧棕' },
  { id: 'blueporcelain', name: '蓝瓷', desc: '青花瓷' },
];

/* ===== Mode Definitions ===== */
const MODES = [
  { id: 'daily', name: '每日挑战', desc: '每日10题挑战', icon: 'star' },
  { id: 'sequential', name: '顺序刷题', desc: '按序号逐题练习', icon: 'list' },
  { id: 'exam', name: '组卷刷题', desc: '随机生成试卷', icon: 'file' },
  { id: 'random', name: '随机刷题', desc: '随机抽取不重复', icon: 'shuffle' },
  { id: 'department', name: '按部门刷题', desc: '选择部门专项练习', icon: 'dept' },
  { id: 'spaced', name: '遗忘曲线', desc: '智能间隔重复', icon: 'brain' },
  { id: 'selection', name: '选题模式', desc: '答题卡跳转', icon: 'grid' },
  { id: 'loop', name: '循环刷题', desc: '错题循环至掌握', icon: 'loop' },
  { id: 'mastery', name: '冲刺掌握', desc: '即将掌握的题', icon: 'trophy' },
  { id: 'memorize', name: '背题模式', desc: '题目答案对照', icon: 'book' },
  { id: 'flashcard', name: '闪卡记忆', desc: '翻转卡片', icon: 'card' },
  { id: 'game', name: '游戏记忆', desc: '限时挑战', icon: 'gamepad' },
  { id: 'wrong', name: '错题集', desc: '复习错题', icon: 'warning' },
  { id: 'stats', name: '学习统计', desc: '进度与数据', icon: 'chart' },
  { id: 'themes', name: '皮肤定制', desc: '主题与配色', icon: 'palette' },
];

/* ===== Storage Manager ===== */
const Storage = {
  KEY: 'shizhi_data_v1',
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const data = JSON.parse(raw);
        App.stats = data.stats || {};
        App.settings = Object.assign(App.settings, data.settings || {});
        App.wrongSet = new Set(data.wrongQuestions || []);
        App.dailyLog = data.dailyLog || {};
        App.sessionLog = data.sessionLog || [];
      }
    } catch(e) { console.warn('Storage load error:', e); }
  },
  save() {
    try {
      const data = {
        stats: App.stats,
        settings: App.settings,
        wrongQuestions: Array.from(App.wrongSet),
        dailyLog: App.dailyLog,
        sessionLog: App.sessionLog.slice(-200),
      };
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch(e) { console.warn('Storage save error:', e); }
  },
  getQuestionStat(qid) {
    if (!App.stats[qid]) {
      App.stats[qid] = {
        correct: 0, wrong: 0, total: 0,
        lastAnswered: null, nextReview: null,
        srLevel: 0, srInterval: 0,
        mastery: 0,
      };
    }
    return App.stats[qid];
  },
  recordAnswer(qid, isCorrect) {
    const s = this.getQuestionStat(qid);
    s.total++;
    if (isCorrect) s.correct++; else s.wrong++;
    s.lastAnswered = Date.now();
    // Spaced repetition update
    this.updateSR(qid, isCorrect);
    // Wrong set management
    if (isCorrect) {
      // If mastery reached, remove from wrong set
      const st = this.getQuestionStat(qid);
      if (st.srLevel >= 5) App.wrongSet.delete(qid);
    } else {
      App.wrongSet.add(qid);
    }
    this.save();
  },
  updateSR(qid, isCorrect) {
    const s = this.getQuestionStat(qid);
    // SM-2 inspired intervals (days)
    const intervals = [1, 2, 4, 7, 15, 30, 60];
    if (isCorrect) {
      s.srLevel = Math.min(s.srLevel + 1, 6);
      s.mastery = Math.min(s.mastery + 1, 5);
    } else {
      s.srLevel = Math.max(s.srLevel - 2, 0);
      s.mastery = Math.max(s.mastery - 1, 0);
    }
    const idx = Math.min(s.srLevel, intervals.length - 1);
    s.srInterval = intervals[idx];
    s.nextReview = Date.now() + s.srInterval * 86400000;
  },
  getDueQuestions() {
    const now = Date.now();
    const due = [];
    for (const [qid, s] of Object.entries(App.stats)) {
      if (s.nextReview && s.nextReview <= now && s.srLevel < 5) {
        due.push(parseInt(qid));
      }
    }
    return due;
  },
  getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  logSession(qid, isCorrect) {
    const key = this.getTodayKey();
    if (!App.dailyLog[key]) App.dailyLog[key] = { count: 0, correct: 0 };
    App.dailyLog[key].count++;
    if (isCorrect) App.dailyLog[key].correct++;
    App.sessionLog.push({ qid, isCorrect, time: Date.now() });
  },
  clearAllStats() {
    App.stats = {};
    App.wrongSet = new Set();
    App.dailyLog = {};
    App.sessionLog = [];
    this.save();
  },
  clearWrongSet() {
    App.wrongSet.clear();
    this.save();
  },
  getOverallStats() {
    const stats = { total: 0, answered: 0, correct: 0, mastered: 0 };
    stats.total = App.questions.length;
    for (const s of Object.values(App.stats)) {
      stats.answered += s.total > 0 ? 1 : 0;
      stats.correct += s.correct;
      if (s.srLevel >= 5) stats.mastered++;
    }
    return stats;
  },
  getAccuracy() {
    let total = 0, correct = 0;
    for (const s of Object.values(App.stats)) {
      total += s.total;
      correct += s.correct;
    }
    return total > 0 ? Math.round(correct / total * 100) : 0;
  },
};

/* ===== Audio Manager (Web Audio API) ===== */
const Audio = {
  ctx: null,
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { console.warn('Audio init failed'); }
    }
  },
  play(isCorrect) {
    if (!App.settings.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    if (isCorrect) {
      // Pleasant ascending chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // Gentle descending tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(311.13, now); // Eb4
      osc.frequency.setValueAtTime(246.94, now + 0.15); // B3
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  },
  playClick() {
    if (!App.settings.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.start(now); osc.stop(now + 0.08);
  },
  playFinish() {
    if (!App.settings.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C6
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.12, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.3);
    });
  },
};

/* ===== Theme Manager ===== */
const ThemeMgr = {
  apply() {
    const t = App.settings.theme;
    document.body.setAttribute('data-theme', t);
    // Apply custom overrides
    const root = document.documentElement;
    root.style.removeProperty('--hue');
    root.style.removeProperty('--sat');
    root.style.removeProperty('--light');
    // Remove effect classes
    document.body.classList.remove('theme-effect-pixel', 'theme-effect-glow', 'theme-effect-gradient-bg', 'theme-effect-scanline');
    if (t === 'pokemon-gba' || t === 'stardew') document.body.classList.add('theme-effect-pixel');
    if (t === 'cyberpunk' || t === 'neon-night') document.body.classList.add('theme-effect-glow');
    if (t === 'shinkai' || t === 'aurora' || t === 'twilight') document.body.classList.add('theme-effect-gradient-bg');
    if (t === 'pokemon-gba') document.body.classList.add('theme-effect-scanline');
    // Custom color overrides
    if (App.settings.customHue !== null) {
      this.applyCustomColors();
    }
    // Font size
    document.documentElement.style.fontSize = App.settings.fontSize + 'px';
    // Start particle effects
    if (typeof ThemeFX !== 'undefined') {
      if (App.settings.effectsEnabled) {
        ThemeFX.start(t);
      } else {
        ThemeFX.stop();
      }
    }
  },
  applyCustomColors() {
    const h = App.settings.customHue ?? 0;
    const s = App.settings.customSat ?? 50;
    const l = App.settings.customLight ?? 50;
    const br = App.settings.customBrightness ?? 100;
    const root = document.documentElement;
    root.style.setProperty('--accent', `hsl(${h}, ${s}%, ${l}%)`);
    root.style.setProperty('--accent-soft', `hsla(${h}, ${s}%, ${l}%, 0.15)`);
    root.style.setProperty('--accent-contrast', l < 40 ? '#fff' : '#1a1a1a');
    // Adjust bg brightness
    if (br !== 100) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      root.style.setProperty('--bg', this.adjustBrightness(bg, br));
    }
  },
  adjustBrightness(color, br) {
    // Simple filter for brightness
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1,3),16);
      const g = parseInt(color.slice(3,5),16);
      const b = parseInt(color.slice(5,7),16);
      const factor = br / 100;
      const nr = Math.min(255, Math.max(0, Math.round(r*factor)));
      const ng = Math.min(255, Math.max(0, Math.round(g*factor)));
      const nb = Math.min(255, Math.max(0, Math.round(b*factor)));
      return `#${nr.toString(16).padStart(2,'0')}${ng.toString(16).padStart(2,'0')}${nb.toString(16).padStart(2,'0')}`;
    }
    return color;
  },
};

/* ===== Utility ===== */
function $(id) { return document.getElementById(id); }
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = $('view-' + id);
  if (view) view.classList.add('active');
  window.scrollTo(0, 0);
}
function formatAnswer(q) {
  // Normalize answer: judgment -> T/F, choice -> letters
  const ans = q.answer.trim();
  if (q.type === '判断') return ans === '正确';
  return ans.split('').filter(c => /[A-F]/i.test(c)).sort().join('').toUpperCase();
}
function getOptionLetters(q) {
  return Object.keys(q.options).sort();
}

/* ===== SVG Icons ===== */
const ICONS = {
  list: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3V5zm0 4h18v2H3V9zm0 4h18v2H3v-2zm0 4h18v2H3v-2z"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>',
  dept: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>',
  brain: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zm8 0h2v6h-2V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6zm8 0h2v6h-2v-6zM3 19h6v2H3v-2zm8 0h6v2h-6v-2zm8 0h2v2h-2v-2z"/></svg>',
  loop: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1-.25 1.97-.7 2.8l1.46 1.46C19.54 14.97 20 13.54 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1 .25-1.97.7-2.8L5.24 7.74C4.46 9.03 4 10.46 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9C5.67 11 5 10.33 5 9.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8 19 8.67 19 9.5s-.67 1.5-1.5 1.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.58 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.38 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>',
};

/* ===== Data Loading ===== */
async function loadData() {
  try {
    const [qRes, mRes] = await Promise.all([
      fetch('data/questions.json'),
      fetch('data/meta.json'),
    ]);
    App.questions = await qRes.json();
    App.meta = await mRes.json();
    App.isReady = true;
  } catch(e) {
    console.error('Data load failed:', e);
    // Fallback: try alternate path
    try {
      const res = await fetch('./data/questions.json');
      App.questions = await res.json();
      App.meta = { total: App.questions.length };
      App.isReady = true;
    } catch(e2) {
      console.error('Fallback also failed:', e2);
      $('loading-text').textContent = '题库加载失败，请检查路径';
    }
  }
}

/* ===== Dashboard Renderer ===== */
function renderDashboard() {
  // Stats cards
  const overall = Storage.getOverallStats();
  const accuracy = Storage.getAccuracy();
  const wrongCount = App.wrongSet.size;
  const dueCount = Storage.getDueQuestions().length;
  const masteredPct = overall.total > 0 ? Math.round(overall.mastered / overall.total * 100) : 0;

  $('dash-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${overall.total}</div><div class="stat-label">总题数</div></div>
    <div class="stat-card"><div class="stat-value">${accuracy}%</div><div class="stat-label">正确率</div></div>
    <div class="stat-card"><div class="stat-value">${wrongCount}</div><div class="stat-label">错题数</div></div>
    <div class="stat-card"><div class="stat-value">${dueCount}</div><div class="stat-label">待复习</div></div>
  `;

  // Progress ring
  const answeredPct = overall.total > 0 ? Math.round(overall.answered / overall.total * 100) : 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (answeredPct / 100) * circumference;
  $('dash-progress').innerHTML = `
    <div class="progress-ring-container">
      <div class="progress-ring">
        <svg width="100" height="100">
          <circle class="ring-bg" cx="50" cy="50" r="42" stroke-width="8"/>
          <circle class="ring-fill" cx="50" cy="50" r="42" stroke-width="8"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
        </svg>
        <div class="progress-ring-text">
          <div class="pct">${answeredPct}%</div>
          <div class="lbl">已练习</div>
        </div>
      </div>
      <div class="progress-info">
        <h3>学习进度</h3>
        <div class="progress-bar"><div class="progress-bar-fill" style="width:${answeredPct}%"></div></div>
        <div class="progress-detail">已答 ${overall.answered} / ${overall.total} · 已掌握 ${overall.mastered} 题 (${masteredPct}%)</div>
        ${dueCount > 0 ? `<div class="progress-detail" style="color:var(--warning);margin-top:0.3rem;">有 ${dueCount} 道题待复习</div>` : ''}
      </div>
    </div>
  `;

  // Mode grid
  const grid = $('mode-grid');
  grid.innerHTML = '';
  for (const mode of MODES) {
    let badge = '';
    if (mode.id === 'spaced' && dueCount > 0) badge = `<span class="mode-card-badge">${dueCount}</span>`;
    if (mode.id === 'wrong' && wrongCount > 0) badge = `<span class="mode-card-badge">${wrongCount}</span>`;
    const card = el('div', 'mode-card');
    card.innerHTML = `${badge}<div class="mode-card-icon">${ICONS[mode.icon] || ''}</div><div class="mode-card-title">${mode.name}</div><div class="mode-card-desc">${mode.desc}</div>`;
    card.onclick = () => handleModeClick(mode.id);
    grid.appendChild(card);
  }
}

/* ===== Mode Click Handler ===== */
function handleModeClick(modeId) {
  Audio.playClick();
  switch(modeId) {
    case 'daily': startDailyChallenge(); break;
    case 'sequential': showSequentialConfig(); break;
    case 'exam': showExamConfig(); break;
    case 'random': showRandomConfig(); break;
    case 'department': showDepartmentConfig(); break;
    case 'spaced': startSpacedRepetition(); break;
    case 'selection': showSelectionConfig(); break;
    case 'loop': showLoopConfig(); break;
    case 'mastery': startMasteryChallenge(); break;
    case 'memorize': showMemorizeConfig(); break;
    case 'flashcard': showFlashcardConfig(); break;
    case 'game': showGameConfig(); break;
    case 'wrong': showWrongQuestions(); break;
    case 'stats': renderStats(); break;
    case 'themes': renderThemeCustomizer(); break;
  }
}

/* ===== Config Views ===== */

/* --- 每日挑战 (Daily Challenge) --- */
function startDailyChallenge() {
  // Seed from today's date for consistent daily questions
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth()+1) * 100 + today.getDate();
  // Simple seeded shuffle
  let pool = App.questions.slice();
  let s = seed;
  for (let i = pool.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor(s / 233280 * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const qs = pool.slice(0, 10);
  startQuiz('daily', qs, { seed });
}

/* --- 随机刷题 (Random Practice) --- */
function showRandomConfig() {
  App.currentMode = 'random';
  const depts = App.meta.departments || [];
  const types = App.meta.types || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">题目数量</div>
      <div class="config-range">
        <input type="range" id="rand-count" min="5" max="100" value="20">
        <span id="rand-count-val">20</span>
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">选择部门</div>
      <div class="config-options" id="rand-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">选择题型</div>
      <div class="config-options" id="rand-types">
        <div class="config-chip active" data-val="all">全部</div>
        ${types.map(t => `<div class="config-chip" data-val="${t}">${t}</div>`).join('')}
      </div>
    </div>
    <button class="config-start" id="rand-start">开始随机刷题</button>
  `;
  $('mode-title').textContent = '随机刷题';
  setupChipSelection('rand-depts');
  setupChipSelection('rand-types');
  const slider = $('rand-count');
  slider.oninput = () => $('rand-count-val').textContent = slider.value;
  $('rand-start').onclick = () => {
    const count = parseInt($('rand-count').value);
    const dept = getActiveChip('rand-depts');
    const type = getActiveChip('rand-types');
    let pool = App.questions.filter(q => (dept==='all'||q.dept===dept) && (type==='all'||q.type===type));
    if (pool.length === 0) { showToast('没有符合条件的题目'); return; }
    const qs = shuffle(pool).slice(0, count);
    startQuiz('random', qs, { dept, type, count });
  };
  showView('config');
}

/* --- 冲刺掌握 (Mastery Challenge) --- */
function startMasteryChallenge() {
  // Find questions that are close to being mastered (srLevel 3-4)
  const closeToMastery = [];
  for (const [qid, s] of Object.entries(App.stats)) {
    if (s.srLevel >= 3 && s.srLevel < 5) {
      closeToMastery.push(parseInt(qid));
    }
  }
  if (closeToMastery.length === 0) {
    showToast('暂无即将掌握的题目，多刷几题吧');
    showView('dashboard');
    return;
  }
  const qs = closeToMastery.map(id => App.questions.find(q => q.id === id)).filter(Boolean);
  startQuiz('mastery', qs, {});
}

function showSequentialConfig() {
  App.currentMode = 'sequential';
  const depts = App.meta.departments || [];
  const types = App.meta.types || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择部门</div>
      <div class="config-options" id="seq-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">选择题型</div>
      <div class="config-options" id="seq-types">
        <div class="config-chip active" data-val="all">全部</div>
        ${types.map(t => `<div class="config-chip" data-val="${t}">${t}</div>`).join('')}
      </div>
    </div>
    <button class="config-start" id="seq-start">开始顺序刷题</button>
  `;
  $('mode-title').textContent = '顺序刷题';
  setupChipSelection('seq-depts');
  setupChipSelection('seq-types');
  $('seq-start').onclick = () => {
    const dept = getActiveChip('seq-depts');
    const type = getActiveChip('seq-types');
    let qs = App.questions.filter(q => (dept==='all'||q.dept===dept) && (type==='all'||q.type===type));
    qs.sort((a,b) => a.id - b.id);
    if (qs.length === 0) { showToast('没有符合条件的题目'); return; }
    startQuiz('sequential', qs, { dept, type });
  };
  showView('config');
}

function showExamConfig() {
  App.currentMode = 'exam';
  const depts = App.meta.departments || [];
  const types = App.meta.types || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">题目数量</div>
      <div class="config-range">
        <input type="range" id="exam-count" min="5" max="100" value="20">
        <span id="exam-count-val">20</span>
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">选择部门</div>
      <div class="config-options" id="exam-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">选择题型</div>
      <div class="config-options" id="exam-types">
        <div class="config-chip active" data-val="all">全部</div>
        ${types.map(t => `<div class="config-chip" data-val="${t}">${t}</div>`).join('')}
      </div>
    </div>
    <button class="config-start" id="exam-start">开始组卷刷题</button>
  `;
  $('mode-title').textContent = '组卷刷题';
  setupChipSelection('exam-depts');
  setupChipSelection('exam-types');
  const slider = $('exam-count');
  slider.oninput = () => $('exam-count-val').textContent = slider.value;
  $('exam-start').onclick = () => {
    const count = parseInt($('exam-count').value);
    const dept = getActiveChip('exam-depts');
    const type = getActiveChip('exam-types');
    let pool = App.questions.filter(q => (dept==='all'||q.dept===dept) && (type==='all'||q.type===type));
    if (pool.length === 0) { showToast('没有符合条件的题目'); return; }
    const qs = shuffle(pool).slice(0, count);
    startQuiz('exam', qs, { dept, type, count });
  };
  showView('config');
}

function showDepartmentConfig() {
  App.currentMode = 'department';
  const depts = App.meta.departments || [];
  const deptCounts = App.meta.deptCounts || {};
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择部门</div>
      <div class="config-options" id="dept-select">
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d} <span style="opacity:0.6;font-size:0.7rem">(${deptCounts[d]})</span></div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">题型筛选</div>
      <div class="config-options" id="dept-types">
        <div class="config-chip active" data-val="all">全部</div>
        <div class="config-chip" data-val="判断">判断</div>
        <div class="config-chip" data-val="单选">单选</div>
        <div class="config-chip" data-val="多选">多选</div>
      </div>
    </div>
    <button class="config-start" id="dept-start">开始部门刷题</button>
  `;
  $('mode-title').textContent = '按部门刷题';
  setupChipSelection('dept-select');
  setupChipSelection('dept-types');
  $('dept-start').onclick = () => {
    const dept = getActiveChip('dept-select');
    const type = getActiveChip('dept-types');
    if (!dept) { showToast('请选择部门'); return; }
    let qs = App.questions.filter(q => q.dept === dept && (type==='all'||q.type===type));
    qs.sort((a,b) => a.id - b.id);
    if (qs.length === 0) { showToast('没有符合条件的题目'); return; }
    startQuiz('department', qs, { dept, type });
  };
  showView('config');
}

function showSelectionConfig() {
  App.currentMode = 'selection';
  const depts = App.meta.departments || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择部门</div>
      <div class="config-options" id="sel-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <button class="config-start" id="sel-start">打开答题卡</button>
  `;
  $('mode-title').textContent = '选题模式';
  setupChipSelection('sel-depts');
  $('sel-start').onclick = () => {
    const dept = getActiveChip('sel-depts');
    let qs = App.questions.filter(q => dept==='all'||q.dept===dept);
    qs.sort((a,b) => a.id - b.id);
    renderAnswerCard(qs);
  };
  showView('config');
}

function showLoopConfig() {
  App.currentMode = 'loop';
  const depts = App.meta.departments || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择部门</div>
      <div class="config-options" id="loop-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">题目范围</div>
      <div class="config-count-input">
        <input type="number" id="loop-start" value="1" min="1" style="width:5rem"> 到
        <input type="number" id="loop-end" value="50" min="1" style="width:5rem">
      </div>
      <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.5rem">在该部门题库范围内选择连续题号</div>
    </div>
    <div class="config-section">
      <div class="config-label">每次题数</div>
      <div class="config-range">
        <input type="range" id="loop-count" min="5" max="50" value="20">
        <span id="loop-count-val">20</span>
      </div>
    </div>
    <div class="config-section">
      <div class="config-label" style="font-size:0.75rem;color:var(--text-muted)">说明：答错的题将按遗忘曲线再次出现，直至完全掌握（连续答对5次）才会从循环中消失</div>
    </div>
    <button class="config-start" id="loop-start-btn">开始循环刷题</button>
  `;
  $('mode-title').textContent = '循环刷题';
  setupChipSelection('loop-depts');
  const slider = $('loop-count');
  slider.oninput = () => $('loop-count-val').textContent = slider.value;
  $('loop-start-btn').onclick = () => {
    const dept = getActiveChip('loop-depts');
    const startN = parseInt($('loop-start').value) || 1;
    const endN = parseInt($('loop-end').value) || 50;
    const count = parseInt($('loop-count').value) || 20;
    let pool = App.questions.filter(q => (dept==='all'||q.dept===dept) && q.id >= startN && q.id <= endN);
    pool.sort((a,b) => a.id - b.id);
    if (pool.length === 0) { showToast('范围内无题目'); return; }
    startLoopQuiz(pool, count);
  };
  showView('config');
}

function showMemorizeConfig() {
  App.currentMode = 'memorize';
  const depts = App.meta.departments || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择范围</div>
      <div class="config-options" id="mem-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">题数</div>
      <div class="config-range">
        <input type="range" id="mem-count" min="5" max="100" value="20">
        <span id="mem-count-val">20</span>
      </div>
    </div>
    <button class="config-start" id="mem-start">开始背题</button>
  `;
  $('mode-title').textContent = '背题模式';
  setupChipSelection('mem-depts');
  const slider = $('mem-count');
  slider.oninput = () => $('mem-count-val').textContent = slider.value;
  $('mem-start').onclick = () => {
    const dept = getActiveChip('mem-depts');
    const count = parseInt($('mem-count').value);
    let pool = App.questions.filter(q => dept==='all'||q.dept===dept);
    const qs = shuffle(pool).slice(0, count);
    startMemorize(qs);
  };
  showView('config');
}

function showFlashcardConfig() {
  App.currentMode = 'flashcard';
  const depts = App.meta.departments || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择范围</div>
      <div class="config-options" id="fc-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">来源</div>
      <div class="config-options" id="fc-source">
        <div class="config-chip active" data-val="all">全部题目</div>
        <div class="config-chip" data-val="wrong">仅错题</div>
        <div class="config-chip" data-val="due">待复习</div>
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">题数</div>
      <div class="config-range">
        <input type="range" id="fc-count" min="5" max="100" value="20">
        <span id="fc-count-val">20</span>
      </div>
    </div>
    <button class="config-start" id="fc-start">开始闪卡学习</button>
  `;
  $('mode-title').textContent = '闪卡记忆';
  setupChipSelection('fc-depts');
  setupChipSelection('fc-source');
  const slider = $('fc-count');
  slider.oninput = () => $('fc-count-val').textContent = slider.value;
  $('fc-start').onclick = () => {
    const dept = getActiveChip('fc-depts');
    const source = getActiveChip('fc-source');
    const count = parseInt($('fc-count').value);
    let pool = App.questions.filter(q => dept==='all'||q.dept===dept);
    if (source === 'wrong') pool = pool.filter(q => App.wrongSet.has(q.id));
    else if (source === 'due') {
      const due = new Set(Storage.getDueQuestions());
      pool = pool.filter(q => due.has(q.id));
    }
    const qs = shuffle(pool).slice(0, count);
    if (qs.length === 0) { showToast('没有符合条件的题目'); return; }
    startFlashcards(qs);
  };
  showView('config');
}

function showGameConfig() {
  App.currentMode = 'game';
  const depts = App.meta.departments || [];
  const config = $('config-container');
  config.innerHTML = `
    <div class="config-section">
      <div class="config-label">选择范围</div>
      <div class="config-options" id="game-depts">
        <div class="config-chip active" data-val="all">全部</div>
        ${depts.map(d => `<div class="config-chip" data-val="${d}">${d}</div>`).join('')}
      </div>
    </div>
    <div class="config-section">
      <div class="config-label">难度</div>
      <div class="config-options" id="game-diff">
        <div class="config-chip active" data-val="easy">简单 (60s/题)</div>
        <div class="config-chip" data-val="normal">普通 (30s/题)</div>
        <div class="config-chip" data-val="hard">困难 (15s/题)</div>
      </div>
    </div>
    <button class="config-start" id="game-start">开始挑战</button>
  `;
  $('mode-title').textContent = '游戏记忆';
  setupChipSelection('game-depts');
  setupChipSelection('game-diff');
  $('game-start').onclick = () => {
    const dept = getActiveChip('game-depts');
    const diff = getActiveChip('game-diff');
    const timePerQ = diff==='easy'?60:diff==='normal'?30:15;
    let pool = App.questions.filter(q => dept==='all'||q.dept===dept);
    const qs = shuffle(pool).slice(0, 20);
    if (qs.length === 0) { showToast('没有题目'); return; }
    startGame(qs, timePerQ);
  };
  showView('config');
}

/* ===== Chip Selection Helper ===== */
function setupChipSelection(containerId) {
  const container = $(containerId);
  if (!container) return;
  container.querySelectorAll('.config-chip').forEach(chip => {
    chip.onclick = () => {
      Audio.playClick();
      container.querySelectorAll('.config-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    };
  });
}
function getActiveChip(containerId) {
  const active = $(containerId)?.querySelector('.config-chip.active');
  return active?.dataset.val || 'all';
}

/* ===== Quiz Engine ===== */
function startQuiz(mode, questions, opts = {}) {
  App.currentQuiz = {
    mode, questions, opts,
    index: 0,
    correct: 0,
    wrong: 0,
    answered: false,
    selectedOptions: new Set(),
    currentQuestion: null,
    results: [],
  };
  $('mode-title').textContent = MODES.find(m=>m.id===mode)?.name || '';
  showView('quiz');
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const quiz = App.currentQuiz;
  if (!quiz) return;
  const q = quiz.questions[quiz.index];
  quiz.currentQuestion = q;
  quiz.answered = false;
  quiz.selectedOptions = new Set();

  // Progress
  $('quiz-current').textContent = quiz.index + 1;
  $('quiz-total').textContent = quiz.questions.length;
  $('quiz-progress-fill').style.width = `${(quiz.index / quiz.questions.length) * 100}%`;

  // Question
  const typeClass = q.type === '判断' ? 'judge' : q.type === '单选' ? 'single' : 'multi';
  const letters = getOptionLetters(q);
  let optionsHtml = '';

  if (q.type === '判断') {
    optionsHtml = `
      <div class="quiz-option" data-opt="正确">
        <div class="quiz-option-marker">T</div>
        <div class="quiz-option-text">正确</div>
      </div>
      <div class="quiz-option" data-opt="错误">
        <div class="quiz-option-marker">F</div>
        <div class="quiz-option-text">错误</div>
      </div>`;
  } else {
    optionsHtml = letters.map(l => `
      <div class="quiz-option" data-opt="${l}">
        <div class="quiz-option-marker">${l}</div>
        <div class="quiz-option-text">${q.options[l] || ''}</div>
      </div>`).join('');
  }

  // SR level indicator
  const stat = Storage.getQuestionStat(q.id);
  const srDots = Array.from({length: 5}, (_, i) =>
    `<div class="sr-level-dot ${i < stat.srLevel ? (stat.srLevel >= 5 ? 'mastered' : 'active') : ''}"></div>`
  ).join('');

  $('quiz-body').innerHTML = `
    <div>
      <span class="quiz-type-badge ${typeClass}">${q.type}</span>
      <span class="quiz-type-badge dept">${q.dept}</span>
      <span class="quiz-type-badge dept">第${q.id}题</span>
    </div>
    <div class="quiz-question">${q.question}</div>
    <div class="quiz-options" id="quiz-options">${optionsHtml}</div>
    <div class="sr-level">${srDots}</div>
  `;

  // Footer
  $('quiz-footer').innerHTML = `
    <button class="action-btn" id="quiz-prev" ${quiz.index===0?'disabled':''}>上一题</button>
    <button class="action-btn primary" id="quiz-submit">提交</button>
    <button class="action-btn" id="quiz-next" disabled>下一题</button>
  `;

  // Bind events
  document.querySelectorAll('#quiz-options .quiz-option').forEach(opt => {
    opt.onclick = () => selectOption(opt, q);
  });
  $('quiz-prev').onclick = () => { if (quiz.index > 0) { quiz.index--; renderQuizQuestion(); } };
  $('quiz-submit').onclick = submitAnswer;
  $('quiz-next').onclick = () => {
    if (quiz.index < quiz.questions.length - 1) { quiz.index++; renderQuizQuestion(); }
    else finishQuiz();
  };
}

function selectOption(optEl, q) {
  if (App.currentQuiz.answered) return;
  Audio.playClick();
  const val = optEl.dataset.opt;
  if (q.type === '判断' || q.type === '单选') {
    document.querySelectorAll('#quiz-options .quiz-option').forEach(o => o.classList.remove('selected'));
    optEl.classList.add('selected');
    App.currentQuiz.selectedOptions = new Set([val]);
  } else {
    // Multiple choice - toggle
    optEl.classList.toggle('selected');
    if (App.currentQuiz.selectedOptions.has(val)) App.currentQuiz.selectedOptions.delete(val);
    else App.currentQuiz.selectedOptions.add(val);
  }
}

function submitAnswer() {
  const quiz = App.currentQuiz;
  if (quiz.answered) return;
  const q = quiz.currentQuestion;
  const selected = Array.from(quiz.selectedOptions).sort();
  if (selected.length === 0) { showToast('请选择答案'); return; }

  quiz.answered = true;
  const correctAns = q.type === '判断'
    ? [q.answer.trim()]
    : q.answer.split('').filter(c => /[A-F]/i.test(c)).sort();

  const isCorrect = JSON.stringify(selected) === JSON.stringify(correctAns);

  // Record
  Storage.recordAnswer(q.id, isCorrect);
  Storage.logSession(q.id, isCorrect);
  if (isCorrect) quiz.correct++; else quiz.wrong++;
  quiz.results.push({ qid: q.id, isCorrect });

  // Show result
  Audio.play(isCorrect);

  // Highlight options
  document.querySelectorAll('#quiz-options .quiz-option').forEach(opt => {
    const val = opt.dataset.opt;
    const isCorrectOpt = correctAns.includes(val);
    const isSelected = selected.includes(val);
    if (isCorrectOpt) opt.classList.add('correct');
    else if (isSelected) opt.classList.add('wrong');
  });

  // Update footer
  const stat = Storage.getQuestionStat(q.id);
  $('quiz-footer').innerHTML = `
    <div style="flex:1;display:flex;align-items:center;gap:0.5rem">
      <span style="font-size:0.8rem;color:${isCorrect?'var(--success)':'var(--danger)'};font-weight:700">${isCorrect?'答对了':'答错了'}</span>
      <span style="font-size:0.7rem;color:var(--text-muted)">累计: 对${stat.correct}次 错${stat.wrong}次</span>
      ${stat.srLevel >= 5 ? '<span class="loop-badge" style="background:var(--success-soft);color:var(--success)">已掌握</span>' : ''}
    </div>
    <button class="action-btn ${isCorrect?'success':'danger'}" id="quiz-next">${quiz.index < quiz.questions.length-1 ? '下一题' : '完成'}</button>
  `;
  $('quiz-next').onclick = () => {
    if (quiz.index < quiz.questions.length - 1) { quiz.index++; renderQuizQuestion(); }
    else finishQuiz();
  };
}

function finishQuiz() {
  const quiz = App.currentQuiz;
  Audio.playFinish();
  const total = quiz.questions.length;
  const correct = quiz.correct;
  const pct = total > 0 ? Math.round(correct / total * 100) : 0;

  $('quiz-body').innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-score">${pct}</div>
      <div class="quiz-result-detail">正确率 ${pct}%</div>
      <div class="quiz-result-stats">
        <div class="quiz-result-stat"><div class="num correct">${correct}</div><div class="lbl">答对</div></div>
        <div class="quiz-result-stat"><div class="num wrong">${quiz.wrong}</div><div class="lbl">答错</div></div>
        <div class="quiz-result-stat"><div class="num total">${total}</div><div class="lbl">总题数</div></div>
      </div>
      <div class="quiz-result-actions">
        <button class="action-btn" id="result-home">返回首页</button>
        <button class="action-btn primary" id="result-retry">再来一次</button>
      </div>
    </div>
  `;
  $('quiz-footer').innerHTML = '';
  $('result-home').onclick = () => { App.currentQuiz = null; showView('dashboard'); renderDashboard(); };
  $('result-retry').onclick = () => {
    if (quiz.mode === 'spaced') {
      startSpacedRepetition();
    } else if (quiz.mode === 'selection') {
      showSelectionConfig();
    } else if (quiz.mode === 'loop') {
      startLoopQuiz(quiz.pool, quiz.count);
    } else if (quiz.mode === 'daily') {
      startDailyChallenge();
    } else if (quiz.mode === 'mastery') {
      startMasteryChallenge();
    } else if (quiz.mode === 'sequential' || quiz.mode === 'department') {
      startQuiz(quiz.mode, shuffle(quiz.questions), quiz.opts);
    } else {
      // exam, flashcard, memorize, game - re-shuffle from same pool
      const qs = shuffle(App.questions.filter(q => {
        if (quiz.opts.dept && quiz.opts.dept !== 'all' && q.dept !== quiz.opts.dept) return false;
        if (quiz.opts.type && quiz.opts.type !== 'all' && q.type !== quiz.opts.type) return false;
        return true;
      })).slice(0, quiz.questions.length);
      startQuiz(quiz.mode, qs, quiz.opts);
    }
  };
  Storage.save();
}

/* ===== Loop Quiz (循环刷题) ===== */
function startLoopQuiz(pool, count) {
  // Build initial queue from pool
  const queue = pool.slice(0, count).map(q => q.id);
  App.currentQuiz = {
    mode: 'loop',
    pool, count,
    queue: [...queue],
    answeredQueue: [],
    index: 0,
    correct: 0,
    wrong: 0,
    loopRound: 1,
    answered: false,
    selectedOptions: new Set(),
    currentQuestion: null,
    results: [],
    masteredThisSession: new Set(),
  };
  $('mode-title').textContent = '循环刷题';
  showView('quiz');
  renderLoopQuestion();
}

function renderLoopQuestion() {
  const quiz = App.currentQuiz;
  if (!quiz || quiz.mode !== 'loop') return;
  if (quiz.queue.length === 0) { finishLoopQuiz(); return; }
  const qid = quiz.queue[0];
  const q = App.questions.find(q => q.id === qid);
  if (!q) { quiz.queue.shift(); renderLoopQuestion(); return; }
  quiz.currentQuestion = q;
  quiz.answered = false;
  quiz.selectedOptions = new Set();

  $('quiz-current').textContent = quiz.index + 1;
  $('quiz-total').textContent = quiz.queue.length + quiz.answeredQueue.length;
  const totalDone = quiz.index;
  const totalAll = quiz.queue.length + quiz.answeredQueue.length;
  $('quiz-progress-fill').style.width = `${totalAll > 0 ? (totalDone / totalAll) * 100 : 0}%`;

  const typeClass = q.type === '判断' ? 'judge' : q.type === '单选' ? 'single' : 'multi';
  let optionsHtml = '';
  if (q.type === '判断') {
    optionsHtml = `
      <div class="quiz-option" data-opt="正确"><div class="quiz-option-marker">T</div><div class="quiz-option-text">正确</div></div>
      <div class="quiz-option" data-opt="错误"><div class="quiz-option-marker">F</div><div class="quiz-option-text">错误</div></div>`;
  } else {
    const letters = getOptionLetters(q);
    optionsHtml = letters.map(l => `
      <div class="quiz-option" data-opt="${l}"><div class="quiz-option-marker">${l}</div><div class="quiz-option-text">${q.options[l] || ''}</div></div>`).join('');
  }

  const stat = Storage.getQuestionStat(q.id);
  const srDots = Array.from({length: 5}, (_, i) =>
    `<div class="sr-level-dot ${i < stat.srLevel ? (stat.srLevel >= 5 ? 'mastered' : 'active') : ''}"></div>`
  ).join('');

  $('quiz-body').innerHTML = `
    <div>
      <span class="quiz-type-badge ${typeClass}">${q.type}</span>
      <span class="quiz-type-badge dept">${q.dept}</span>
      <span class="quiz-type-badge dept">第${q.id}题</span>
      <span class="loop-badge">循环第${quiz.loopRound}轮</span>
    </div>
    <div class="loop-indicator">
      <span>剩余 ${quiz.queue.length} 题</span>
      <span>已掌握 ${quiz.masteredThisSession.size} 题</span>
    </div>
    <div class="quiz-question">${q.question}</div>
    <div class="quiz-options" id="quiz-options">${optionsHtml}</div>
    <div class="sr-level">${srDots}</div>
  `;

  $('quiz-footer').innerHTML = `
    <button class="action-btn" id="quiz-exit-loop">退出循环</button>
    <button class="action-btn primary" id="quiz-submit">提交</button>
  `;

  document.querySelectorAll('#quiz-options .quiz-option').forEach(opt => {
    opt.onclick = () => selectOption(opt, q);
  });
  $('quiz-submit').onclick = submitLoopAnswer;
  $('quiz-exit-loop').onclick = () => { finishLoopQuiz(); };
}

function submitLoopAnswer() {
  const quiz = App.currentQuiz;
  if (quiz.answered || quiz.mode !== 'loop') return;
  const q = quiz.currentQuestion;
  const selected = Array.from(quiz.selectedOptions).sort();
  if (selected.length === 0) { showToast('请选择答案'); return; }
  quiz.answered = true;
  const correctAns = q.type === '判断'
    ? [q.answer.trim()]
    : q.answer.split('').filter(c => /[A-F]/i.test(c)).sort();
  const isCorrect = JSON.stringify(selected) === JSON.stringify(correctAns);

  Storage.recordAnswer(q.id, isCorrect);
  Storage.logSession(q.id, isCorrect);
  if (isCorrect) quiz.correct++; else quiz.wrong++;

  Audio.play(isCorrect);

  document.querySelectorAll('#quiz-options .quiz-option').forEach(opt => {
    const val = opt.dataset.opt;
    if (correctAns.includes(val)) opt.classList.add('correct');
    else if (selected.includes(val)) opt.classList.add('wrong');
  });

  const stat = Storage.getQuestionStat(q.id);
  // Remove from queue
  quiz.queue.shift();
  quiz.index++;

  if (isCorrect && stat.srLevel >= 5) {
    quiz.masteredThisSession.add(q.id);
  } else if (!isCorrect) {
    // Add back to queue with delay (appears after current batch)
    const insertPos = Math.min(quiz.queue.length, quiz.count);
    quiz.queue.splice(insertPos, 0, q.id);
  } else if (isCorrect && stat.srLevel < 5) {
    // Still needs more review - add back with larger delay
    const insertPos = Math.min(quiz.queue.length, Math.ceil(quiz.count * 1.5));
    quiz.queue.splice(insertPos, 0, q.id);
  }

  $('quiz-footer').innerHTML = `
    <div style="flex:1;display:flex;align-items:center;gap:0.5rem">
      <span style="font-size:0.8rem;color:${isCorrect?'var(--success)':'var(--danger)'};font-weight:700">${isCorrect?'答对了':'答错了'}</span>
      ${!isCorrect ? '<span style="font-size:0.7rem;color:var(--text-muted)">该题将在稍后再次出现</span>' : ''}
      ${stat.srLevel >= 5 ? '<span class="loop-badge" style="background:var(--success-soft);color:var(--success)">已完全掌握</span>' : ''}
    </div>
    <button class="action-btn ${isCorrect?'success':'danger'}" id="quiz-next">${quiz.queue.length > 0 ? '下一题' : '完成'}</button>
  `;
  $('quiz-next').onclick = () => {
    if (quiz.queue.length > 0) renderLoopQuestion();
    else finishLoopQuiz();
  };
}

function finishLoopQuiz() {
  const quiz = App.currentQuiz;
  Audio.playFinish();
  $('quiz-body').innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-score">${quiz.masteredThisSession.size}</div>
      <div class="quiz-result-detail">本轮掌握题目数</div>
      <div class="quiz-result-stats">
        <div class="quiz-result-stat"><div class="num correct">${quiz.correct}</div><div class="lbl">答对</div></div>
        <div class="quiz-result-stat"><div class="num wrong">${quiz.wrong}</div><div class="lbl">答错</div></div>
        <div class="quiz-result-stat"><div class="num total">${quiz.masteredThisSession.size}</div><div class="lbl">已掌握</div></div>
      </div>
      <div class="quiz-result-actions">
        <button class="action-btn" id="result-home">返回首页</button>
        <button class="action-btn primary" id="result-retry">继续循环</button>
      </div>
    </div>
  `;
  $('quiz-footer').innerHTML = '';
  $('result-home').onclick = () => { App.currentQuiz = null; showView('dashboard'); renderDashboard(); };
  $('result-retry').onclick = () => {
    // Restart with unmastered questions
    const unmastered = quiz.pool.filter(q => {
      const s = Storage.getQuestionStat(q.id);
      return s.srLevel < 5;
    });
    if (unmastered.length === 0) { showToast('全部题目已掌握'); showView('dashboard'); renderDashboard(); return; }
    startLoopQuiz(unmastered, Math.min(quiz.count, unmastered.length));
  };
  Storage.save();
}

/* ===== Answer Card (选题模式) ===== */
function renderAnswerCard(questions) {
  $('mode-title').textContent = '答题卡';
  const filters = $('card-filters');
  filters.innerHTML = `
    <div class="config-chip active" data-filter="all">全部</div>
    <div class="config-chip" data-filter="correct">已答对</div>
    <div class="config-chip" data-filter="wrong">已答错</div>
    <div class="config-chip" data-filter="unanswered">未答</div>
  `;
  const grid = $('card-grid');
  grid.innerHTML = '';

  function renderGrid(filter) {
    grid.innerHTML = '';
    questions.forEach((q, i) => {
      const stat = Storage.getQuestionStat(q.id);
      let cls = 'card-cell';
      if (filter === 'correct' && stat.correct === 0) return;
      if (filter === 'wrong' && !App.wrongSet.has(q.id)) return;
      if (filter === 'unanswered' && stat.total > 0) return;
      if (stat.total > 0) {
        if (stat.correct > 0 && !App.wrongSet.has(q.id)) cls += ' correct';
        else cls += ' wrong';
      } else { cls += ' unanswered'; }
      const cell = el('div', cls, q.id);
      cell.onclick = () => {
        // Start quiz from this question
        const startIdx = questions.indexOf(q);
        const qs = questions.slice(startIdx);
        startQuiz('selection', qs, { startId: q.id });
      };
      grid.appendChild(cell);
    });
  }

  renderGrid('all');
  filters.querySelectorAll('.config-chip').forEach(chip => {
    chip.onclick = () => {
      Audio.playClick();
      filters.querySelectorAll('.config-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderGrid(chip.dataset.filter);
    };
  });
  showView('card');
}

/* ===== Spaced Repetition (遗忘曲线) ===== */
function startSpacedRepetition() {
  const due = Storage.getDueQuestions();
  if (due.length === 0) {
    // Check if any questions have been answered
    const hasAnswered = Object.values(App.stats).some(s => s.total > 0);
    if (!hasAnswered) {
      showToast('还没有答题记录，请先做一些题');
    } else {
      showToast('当前没有需要复习的题目，做得好');
    }
    showView('dashboard');
    return;
  }
  const qs = due.map(id => App.questions.find(q => q.id === id)).filter(Boolean);
  startQuiz('spaced', qs, { dueCount: due.length });
}

/* ===== Memorize Mode (背题模式) ===== */
let memState = { questions: [], index: 0, flipped: false };
function startMemorize(questions) {
  memState = { questions, index: 0, flipped: false };
  $('mode-title').textContent = '背题模式';
  showView('memorize');
  renderMemorize();
}

function renderMemorize() {
  const q = memState.questions[memState.index];
  if (!q) return;
  memState.flipped = false;
  $('mem-current').textContent = memState.index + 1;
  $('mem-total').textContent = memState.questions.length;
  $('mem-progress-fill').style.width = `${(memState.index / memState.questions.length) * 100}%`;

  let answerText = '';
  if (q.type === '判断') {
    answerText = q.answer.trim();
  } else {
    const ansLetters = q.answer.split('').filter(c => /[A-F]/i.test(c));
    answerText = ansLetters.map(l => `${l}. ${q.options[l] || ''}`).join('\n');
  }

  $('memorize-body').innerHTML = `
    <div class="memorize-card">
      <div>
        <span class="quiz-type-badge ${q.type==='判断'?'judge':q.type==='单选'?'single':'multi'}">${q.type}</span>
        <span class="quiz-type-badge dept">${q.dept}</span>
      </div>
      <div class="memorize-q">${q.question}</div>
      <div class="memorize-a" id="mem-answer">
        <div class="memorize-a-label">答案</div>
        <div class="memorize-a-text">${answerText}</div>
      </div>
    </div>
  `;
  $('mem-flip').textContent = '显示答案';
  $('mem-prev').disabled = memState.index === 0;
}

$('mem-flip')?.addEventListener('click', () => {
  Audio.playClick();
  memState.flipped = !memState.flipped;
  const ans = $('mem-answer');
  if (ans) ans.classList.toggle('show', memState.flipped);
  $('mem-flip').textContent = memState.flipped ? '隐藏答案' : '显示答案';
});

/* ===== Flashcard Mode (闪卡记忆) ===== */
let fcState = { questions: [], index: 0, flipped: false };
function startFlashcards(questions) {
  fcState = { questions, index: 0, flipped: false };
  $('mode-title').textContent = '闪卡记忆';
  showView('flashcard');
  renderFlashcard();
}

function renderFlashcard() {
  const q = fcState.questions[fcState.index];
  if (!q) return;
  fcState.flipped = false;
  $('fc-current').textContent = fcState.index + 1;
  $('fc-total').textContent = fcState.questions.length;
  $('fc-progress-fill').style.width = `${(fcState.index / fcState.questions.length) * 100}%`;

  let backText = '';
  if (q.type === '判断') {
    backText = q.answer.trim();
  } else {
    const ansLetters = q.answer.split('').filter(c => /[A-F]/i.test(c));
    backText = ansLetters.map(l => `${l}. ${q.options[l] || ''}`).join('\n');
  }

  $('flashcard-stage').innerHTML = `
    <div class="flashcard" id="flashcard">
      <div class="flashcard-face flashcard-front">
        <div class="flashcard-label">题目</div>
        <div class="flashcard-text">${q.question}</div>
      </div>
      <div class="flashcard-face flashcard-back">
        <div class="flashcard-label">答案</div>
        <div class="flashcard-text">${backText}</div>
      </div>
    </div>
  `;
  $('flashcard').onclick = flipFlashcard;
  $('fc-prev').disabled = fcState.index === 0;
}

function flipFlashcard() {
  Audio.playClick();
  fcState.flipped = !fcState.flipped;
  $('flashcard').classList.toggle('flipped', fcState.flipped);
}

/* ===== Game Mode (游戏记忆) ===== */
let gameState = { questions: [], index: 0, score: 0, timePerQ: 30, timer: null, timeLeft: 30, answered: false };
function startGame(questions, timePerQ) {
  gameState = { questions, index: 0, score: 0, timePerQ, timer: null, timeLeft: timePerQ, answered: false };
  $('mode-title').textContent = '游戏记忆';
  showView('game');
  renderGameQuestion();
}

function renderGameQuestion() {
  const gs = gameState;
  const q = gs.questions[gs.index];
  if (!q) { endGame(); return; }
  gs.answered = false;
  gs.timeLeft = gs.timePerQ;

  let optionsHtml = '';
  if (q.type === '判断') {
    optionsHtml = `
      <div class="quiz-option" data-opt="正确"><div class="quiz-option-marker">T</div><div class="quiz-option-text">正确</div></div>
      <div class="quiz-option" data-opt="错误"><div class="quiz-option-marker">F</div><div class="quiz-option-text">错误</div></div>`;
  } else {
    const letters = getOptionLetters(q);
    optionsHtml = letters.map(l => `
      <div class="quiz-option" data-opt="${l}"><div class="quiz-option-marker">${l}</div><div class="quiz-option-text">${q.options[l] || ''}</div></div>`).join('');
  }

  $('game-body').innerHTML = `
    <div>
      <span class="quiz-type-badge ${q.type==='判断'?'judge':q.type==='单选'?'single':'multi'}">${q.type}</span>
      <span class="quiz-type-badge dept">${q.dept}</span>
    </div>
    <div class="quiz-question">${q.question}</div>
    <div class="quiz-options game-quiz" id="game-options">${optionsHtml}</div>
  `;
  $('game-score-val').textContent = gs.score;
  $('game-timer-val').textContent = gs.timeLeft;

  document.querySelectorAll('#game-options .quiz-option').forEach(opt => {
    opt.onclick = () => answerGameQuestion(opt);
  });

  // Start timer
  if (gs.timer) clearInterval(gs.timer);
  gs.timer = setInterval(() => {
    gs.timeLeft--;
    $('game-timer-val').textContent = gs.timeLeft;
    if (gs.timeLeft <= 5) $('game-timer-val').style.color = 'var(--danger)';
    if (gs.timeLeft <= 0) { clearInterval(gs.timer); answerGameQuestion(null); }
  }, 1000);
}

function answerGameQuestion(optEl) {
  const gs = gameState;
  if (gs.answered) return;
  gs.answered = true;
  if (gs.timer) clearInterval(gs.timer);
  const q = gs.questions[gs.index];
  const correctAns = q.type === '判断'
    ? [q.answer.trim()]
    : q.answer.split('').filter(c => /[A-F]/i.test(c)).sort();
  let isCorrect = false;
  if (optEl) {
    const selected = [optEl.dataset.opt];
    isCorrect = JSON.stringify(selected) === JSON.stringify(correctAns);
  }

  Storage.recordAnswer(q.id, isCorrect);
  Storage.logSession(q.id, isCorrect);
  Audio.play(isCorrect);

  // Highlight
  document.querySelectorAll('#game-options .quiz-option').forEach(opt => {
    const val = opt.dataset.opt;
    if (correctAns.includes(val)) opt.classList.add('correct');
    else if (optEl && opt === optEl) opt.classList.add('wrong');
  });

  if (isCorrect) gs.score += Math.max(10, gs.timeLeft * 2);
  $('game-score-val').textContent = gs.score;

  setTimeout(() => {
    gs.index++;
    if (gs.index < gs.questions.length) renderGameQuestion();
    else endGame();
  }, 1200);
}

function endGame() {
  const gs = gameState;
  if (gs.timer) clearInterval(gs.timer);
  Audio.playFinish();
  const rank = gs.score >= 300 ? 'S' : gs.score >= 200 ? 'A' : gs.score >= 100 ? 'B' : gs.score >= 50 ? 'C' : 'D';
  $('game-body').innerHTML = `
    <div class="game-result">
      <div class="game-result-score">${gs.score}</div>
      <div class="game-result-rank">评级: ${rank}</div>
      <div style="font-size:0.85rem;color:var(--text-muted)">答完 ${gs.questions.length} 题</div>
      <div class="quiz-result-actions">
        <button class="action-btn" id="game-home">返回首页</button>
        <button class="action-btn primary" id="game-retry">再来一局</button>
      </div>
    </div>
  `;
  $('game-home').onclick = () => { showView('dashboard'); renderDashboard(); };
  $('game-retry').onclick = () => {
    const qs = shuffle(App.questions).slice(0, gs.questions.length);
    startGame(qs, gs.timePerQ);
  };
  Storage.save();
}

/* ===== Wrong Questions View ===== */
function showWrongQuestions() {
  $('mode-title').textContent = '错题集';
  const wrongIds = Array.from(App.wrongSet);
  const summary = $('wrong-summary');
  summary.innerHTML = `
    <div class="stat-card"><div class="stat-value">${wrongIds.length}</div><div class="stat-label">错题数</div></div>
    <div class="stat-card"><div class="stat-value">${Object.values(App.stats).reduce((a,s)=>a+s.wrong,0)}</div><div class="stat-label">累计答错</div></div>
  `;
  const list = $('wrong-list');
  if (wrongIds.length === 0) {
    list.innerHTML = '<div class="text-center text-muted" style="padding:3rem">暂无错题，继续保持</div>';
  } else {
    list.innerHTML = '';
    for (const id of wrongIds.slice(0, 100)) {
      const q = App.questions.find(q => q.id === id);
      if (!q) continue;
      const stat = Storage.getQuestionStat(id);
      let answerText = q.type === '判断' ? q.answer.trim() : q.answer.split('').filter(c=>/[A-F]/i.test(c)).join(', ');
      const item = el('div', 'wrong-item');
      item.innerHTML = `
        <div class="wrong-item-q"><span class="quiz-type-badge dept">第${q.id}题</span> ${q.question.substring(0, 100)}${q.question.length>100?'...':''}</div>
        <div class="wrong-item-meta">
          <span>${q.dept}</span> · <span>${q.type}</span> · <span>错${stat.wrong}次</span> · <span>对${stat.correct}次</span>
        </div>
        <div class="wrong-item-answer">正确答案: ${answerText}</div>
      `;
      list.appendChild(item);
    }
    if (wrongIds.length > 100) {
      list.appendChild(el('div', 'text-center text-muted', `<p style="padding:1rem">还有 ${wrongIds.length - 100} 道错题...</p>`));
    }
  }
  $('wrong-clear').onclick = () => {
    if (confirm('确定清空所有错题记录？')) {
      Storage.clearWrongSet();
      showWrongQuestions();
      showToast('错题已清空');
    }
  };
  showView('wrong');
}

/* ===== Stats View ===== */
function renderStats() {
  $('mode-title').textContent = '学习统计';
  const container = $('stats-container');
  const overall = Storage.getOverallStats();
  const accuracy = Storage.getAccuracy();

  // Department stats
  const deptStats = {};
  for (const q of App.questions) {
    if (!deptStats[q.dept]) deptStats[q.dept] = { total: 0, answered: 0, correct: 0, wrong: 0 };
    deptStats[q.dept].total++;
    const s = App.stats[q.id];
    if (s && s.total > 0) {
      deptStats[q.dept].answered++;
      deptStats[q.dept].correct += s.correct;
      deptStats[q.dept].wrong += s.wrong;
    }
  }

  // Type stats
  const typeStats = {};
  for (const q of App.questions) {
    if (!typeStats[q.type]) typeStats[q.type] = { total: 0, answered: 0, correct: 0 };
    typeStats[q.type].total++;
    const s = App.stats[q.id];
    if (s && s.total > 0) {
      typeStats[q.type].answered++;
      typeStats[q.type].correct += s.correct;
    }
  }

  // Heatmap (last 30 days)
  const today = new Date();
  let heatmapHtml = '<div class="heatmap-grid">';
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const log = App.dailyLog[key];
    let level = 0;
    if (log) {
      if (log.count >= 20) level = 4;
      else if (log.count >= 10) level = 3;
      else if (log.count >= 5) level = 2;
      else if (log.count > 0) level = 1;
    }
    heatmapHtml += `<div class="heatmap-cell${level>0?` l${level}`:''}" title="${key}: ${log?log.count:0}题"></div>`;
  }
  heatmapHtml += '</div>';
  heatmapHtml += '<div class="heatmap-legend"><span>少</span><div class="heatmap-cell"></div><div class="heatmap-cell l2"></div><div class="heatmap-cell l4"></div><span>多</span></div>';

  container.innerHTML = `
    <div class="stats-section">
      <h3>总览</h3>
      <div class="stats-grid">
        <div class="stats-mini"><div class="stats-mini-val">${overall.total}</div><div class="stats-mini-lbl">总题数</div></div>
        <div class="stats-mini"><div class="stats-mini-val">${overall.answered}</div><div class="stats-mini-lbl">已练习</div></div>
        <div class="stats-mini"><div class="stats-mini-val">${accuracy}%</div><div class="stats-mini-lbl">正确率</div></div>
        <div class="stats-mini"><div class="stats-mini-val">${overall.mastered}</div><div class="stats-mini-lbl">已掌握</div></div>
      </div>
    </div>
    <div class="stats-section">
      <h3>近30天活跃度</h3>
      <div class="heatmap-container">${heatmapHtml}</div>
    </div>
    <div class="stats-section">
      <h3>部门进度</h3>
      ${Object.entries(deptStats).map(([dept, s]) => {
        const pct = s.total > 0 ? Math.round(s.answered / s.total * 100) : 0;
        const acc = s.correct + s.wrong > 0 ? Math.round(s.correct / (s.correct + s.wrong) * 100) : 0;
        return `<div class="stats-bar-row">
          <div class="stats-bar-label">${dept}</div>
          <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${pct}%;background:var(--accent)"></div></div>
          <div class="stats-bar-value">${pct}%</div>
        </div>`;
      }).join('')}
    </div>
    <div class="stats-section">
      <h3>题型正确率</h3>
      ${Object.entries(typeStats).map(([type, s]) => {
        const acc = s.correct > 0 && s.answered > 0 ? Math.round(s.correct / (s.answered) * 100) : 0;
        const color = type === '判断' ? 'var(--success)' : type === '单选' ? 'var(--accent)' : 'var(--warning)';
        return `<div class="stats-bar-row">
          <div class="stats-bar-label">${type}</div>
          <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${acc}%;background:${color}"></div></div>
          <div class="stats-bar-value">${acc}%</div>
        </div>`;
      }).join('')}
    </div>
    <div class="stats-section">
      <h3>遗忘曲线复习</h3>
      <div class="stats-grid">
        <div class="stats-mini"><div class="stats-mini-val">${Storage.getDueQuestions().length}</div><div class="stats-mini-lbl">待复习</div></div>
        <div class="stats-mini"><div class="stats-mini-val">${overall.mastered}</div><div class="stats-mini-lbl">已掌握</div></div>
        <div class="stats-mini"><div class="stats-mini-val">${Object.values(App.stats).filter(s=>s.srLevel>0 && s.srLevel<5).length}</div><div class="stats-mini-lbl">学习中</div></div>
        <div class="stats-mini"><div class="stats-mini-val">${Object.values(App.stats).filter(s=>s.total===0).length || App.questions.length - overall.answered}</div><div class="stats-mini-lbl">未开始</div></div>
      </div>
    </div>
  `;
  showView('stats');
}

/* ===== Settings View ===== */
function renderSettings() {
  $('mode-title').textContent = '设置';
  const container = $('settings-container');
  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-row">
        <div>
          <div class="settings-row-label">答对/答错音效</div>
          <div class="settings-row-desc">答题时播放提示音</div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-switch">
            <input type="checkbox" id="set-sound" ${App.settings.soundEnabled?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">立即显示答案</div>
          <div class="settings-row-desc">提交后立即显示对错</div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-switch">
            <input type="checkbox" id="set-immediate" ${App.settings.showAnswerImmediately?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">主题特效</div>
          <div class="settings-row-desc">粒子动效与主题元素联动</div>
        </div>
        <div class="settings-row-control">
          <label class="toggle-switch">
            <input type="checkbox" id="set-effects" ${App.settings.effectsEnabled?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-row">
        <div>
          <div class="settings-row-label">字体大小</div>
          <div class="settings-row-desc">调整全局字体大小</div>
        </div>
        <div class="settings-row-control">
          <select class="settings-select" id="set-fontsize">
            <option value="14" ${App.settings.fontSize==14?'selected':''}>小</option>
            <option value="16" ${App.settings.fontSize==16?'selected':''}>中</option>
            <option value="18" ${App.settings.fontSize==18?'selected':''}>大</option>
            <option value="20" ${App.settings.fontSize==20?'selected':''}>特大</option>
          </select>
        </div>
      </div>
      <div class="settings-row">
        <div>
          <div class="settings-row-label">当前主题</div>
          <div class="settings-row-desc">${THEMES.find(t=>t.id===App.settings.theme)?.name || '默认'}</div>
        </div>
        <div class="settings-row-control">
          <button class="action-btn small" id="set-themes">更换</button>
        </div>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-row">
        <div>
          <div class="settings-row-label" style="color:var(--danger)">清空所有数据</div>
          <div class="settings-row-desc">删除所有答题记录、错题和统计</div>
        </div>
        <div class="settings-row-control">
          <button class="action-btn small danger" id="set-clear">清空</button>
        </div>
      </div>
    </div>
    <div style="text-align:center;padding:1rem 0;font-size:0.75rem;color:var(--text-muted)">
      拾知 v1.0 · 运营岗位资质题库
    </div>
  `;
  $('set-sound').onchange = (e) => { App.settings.soundEnabled = e.target.checked; Storage.save(); showToast(e.target.checked?'音效已开启':'音效已关闭'); if(e.target.checked) Audio.play(true); };
  $('set-immediate').onchange = (e) => { App.settings.showAnswerImmediately = e.target.checked; Storage.save(); };
  $('set-effects').onchange = (e) => {
    App.settings.effectsEnabled = e.target.checked;
    Storage.save();
    if (e.target.checked) {
      ThemeFX.start(App.settings.theme);
      showToast('特效已开启');
    } else {
      ThemeFX.stop();
      showToast('特效已关闭');
    }
  };
  $('set-fontsize').onchange = (e) => { App.settings.fontSize = parseInt(e.target.value); ThemeMgr.apply(); Storage.save(); };
  $('set-themes').onclick = () => renderThemeCustomizer();
  $('set-clear').onclick = () => {
    if (confirm('确定清空所有数据？此操作不可恢复')) {
      Storage.clearAllStats();
      renderSettings();
      showToast('数据已清空');
    }
  };
  showView('settings');
}

/* ===== Theme Customizer ===== */
function renderThemeCustomizer() {
  $('mode-title').textContent = '皮肤定制';
  const container = $('theme-customizer');
  container.innerHTML = `
    <div class="theme-custom-section">
      <h3>选择皮肤</h3>
      <div class="theme-grid" id="theme-grid">
        ${THEMES.map(t => {
          const isActive = App.settings.theme === t.id;
          return `<div class="theme-card ${isActive?'active':''}" data-theme="${t.id}">
            <div class="theme-preview" id="preview-${t.id}"></div>
            <div class="theme-name">${t.name}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="theme-custom-section">
      <h3>自定义调色</h3>
      <div class="slider-row">
        <label>色相</label>
        <input type="range" id="custom-hue" min="0" max="360" value="${App.settings.customHue ?? 0}">
        <span class="val" id="hue-val">${App.settings.customHue ?? '关'}</span>
      </div>
      <div class="slider-row">
        <label>饱和度</label>
        <input type="range" id="custom-sat" min="0" max="100" value="${App.settings.customSat ?? 50}">
        <span class="val" id="sat-val">${App.settings.customSat ?? 50}</span>
      </div>
      <div class="slider-row">
        <label>明度</label>
        <input type="range" id="custom-light" min="10" max="90" value="${App.settings.customLight ?? 50}">
        <span class="val" id="light-val">${App.settings.customLight ?? 50}</span>
      </div>
      <div class="slider-row">
        <label>亮度</label>
        <input type="range" id="custom-brightness" min="50" max="150" value="${App.settings.customBrightness ?? 100}">
        <span class="val" id="bright-val">${App.settings.customBrightness ?? 100}</span>
      </div>
      <div class="color-preview" id="color-preview"></div>
      <div style="display:flex;gap:0.75rem;margin-top:1rem">
        <button class="action-btn" id="custom-reset">重置自定义</button>
        <button class="action-btn primary" id="custom-apply">应用</button>
      </div>
    </div>
  `;

  // Render theme previews
  THEMES.forEach(t => {
    const preview = $(`preview-${t.id}`);
    if (preview) {
      // Set preview colors based on theme
      const tempEl = document.createElement('div');
      tempEl.style.display = 'none';
      tempEl.setAttribute('data-theme', t.id);
      document.body.appendChild(tempEl);
      const styles = getComputedStyle(tempEl);
      const bg = styles.getPropertyValue('--bg').trim();
      const accent = styles.getPropertyValue('--accent').trim();
      preview.style.background = `linear-gradient(135deg, ${bg} 0%, ${accent} 100%)`;
      document.body.removeChild(tempEl);
    }
  });

  // Theme selection
  document.querySelectorAll('.theme-card').forEach(card => {
    card.onclick = () => {
      Audio.playClick();
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      App.settings.theme = card.dataset.theme;
      App.settings.customHue = null;
      ThemeMgr.apply();
      Storage.save();
      renderThemeCustomizer();
    };
  });

  // Custom color sliders
  const hue = $('custom-hue');
  const sat = $('custom-sat');
  const light = $('custom-light');
  const br = $('custom-brightness');
  function updatePreview() {
    const h = parseInt(hue.value);
    const s = parseInt(sat.value);
    const l = parseInt(light.value);
    $('color-preview').style.background = `hsl(${h}, ${s}%, ${l}%)`;
    $('hue-val').textContent = h;
    $('sat-val').textContent = s;
    $('light-val').textContent = l;
    $('bright-val').textContent = br.value;
  }
  hue.oninput = updatePreview;
  sat.oninput = updatePreview;
  light.oninput = updatePreview;
  br.oninput = updatePreview;
  updatePreview();

  $('custom-apply').onclick = () => {
    App.settings.customHue = parseInt(hue.value);
    App.settings.customSat = parseInt(sat.value);
    App.settings.customLight = parseInt(light.value);
    App.settings.customBrightness = parseInt(br.value);
    ThemeMgr.apply();
    Storage.save();
    showToast('自定义配色已应用');
  };
  $('custom-reset').onclick = () => {
    App.settings.customHue = null;
    App.settings.customSat = null;
    App.settings.customLight = null;
    App.settings.customBrightness = null;
    ThemeMgr.apply();
    Storage.save();
    renderThemeCustomizer();
    showToast('已重置为默认配色');
  };
  showView('themes');
}

/* ===== Event Bindings ===== */
function bindEvents() {
  $('btn-home').onclick = () => { Audio.playClick(); showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('btn-settings').onclick = () => { Audio.playClick(); renderSettings(); };

  $('quiz-exit').onclick = () => { App.currentQuiz = null; showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('card-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('mem-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('fc-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('game-exit').onclick = () => { if(gameState.timer) clearInterval(gameState.timer); showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('wrong-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('stats-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('settings-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };
  $('themes-exit').onclick = () => { showView('dashboard'); renderDashboard(); $('mode-title').textContent=''; };

  // Memorize navigation
  $('mem-prev').onclick = () => { if (memState.index > 0) { memState.index--; renderMemorize(); } };
  $('mem-flip').onclick = () => {
    Audio.playClick();
    memState.flipped = !memState.flipped;
    const ans = $('mem-answer');
    if (ans) ans.classList.toggle('show', memState.flipped);
    $('mem-flip').textContent = memState.flipped ? '隐藏答案' : '显示答案';
  };
  $('mem-next').onclick = () => {
    if (memState.index < memState.questions.length - 1) { memState.index++; renderMemorize(); }
    else { showToast('已看完所有题目'); showView('dashboard'); renderDashboard(); }
  };

  // Flashcard navigation
  $('fc-prev').onclick = () => { if (fcState.index > 0) { fcState.index--; renderFlashcard(); } };
  $('fc-flip').onclick = flipFlashcard;
  $('fc-next').onclick = () => {
    if (fcState.index < fcState.questions.length - 1) { fcState.index++; renderFlashcard(); }
    else { showToast('闪卡学习完成'); showView('dashboard'); renderDashboard(); }
  };
}

/* ===== Init ===== */
async function init() {
  Storage.load();
  ThemeMgr.apply();
  bindEvents();
  await loadData();
  if (App.isReady) {
    renderDashboard();
    $('loading-overlay').classList.add('hidden');
    setTimeout(() => $('loading-overlay').remove(), 500);
  }
}

document.addEventListener('DOMContentLoaded', init);
