/* ===== ميدزون: الدخول بجوجل + AI + اللغة (عربي/English) ===== */
const Auth = {
  lang: localStorage.getItem('mzlang') || 'ar', cid: '', gis: 0,
  async init() {
    try {
      this.cid = (await (await fetch('/api/config')).json()).clientId || '';
      const m = await (await fetch('/api/me')).json();
      if (m.user) this.login(m.user); else if (DB.user) { DB.user = null; save(); }
    } catch (e) {}
    draw();
  },
  login(u) {
    const old = DB.user && DB.user.email;
    if (old && old !== u.email) {   // حساب تاني على نفس الجهاز: نحفظ القديم ونفتح بيانات الجديد
      ST.set('mz:' + old, DB);
      DB = Object.assign({ log: [], cards: [], sess: [], goal: 20, name: '', subs: [], user: null, yr: null, notes: {}, saved: [], pdf: {}, chat: [], posts: [] }, ST.get('mz:' + u.email, {}));
    }
    DB.user = { name: u.name, email: u.email, pic: u.pic || '' }; save();
  },
  async cred(r) {
    try {
      const res = await fetch('/api/auth/google', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ credential: r.credential }) });
      const j = await res.json();
      if (j.user) { this.login(j.user); B.err = ''; } else B.err = 'تعذّر تسجيل الدخول. جرّب تاني.';
    } catch (e) { B.err = 'تعذّر تسجيل الدخول. جرّب تاني.'; }
    draw();
  },
  out() { fetch('/api/logout', { method: 'POST' }).catch(() => {}); try { google.accounts.id.disableAutoSelect(); } catch (e) {} },
  btn() {
    const el = document.getElementById('gbtn'); if (!el) return;
    if (!this.cid) { el.innerHTML = '<div class="note">الدخول بجوجل لسه متظبطش (محتاج Client ID).</div>'; applyLang(); return; }
    const go = () => {
      google.accounts.id.initialize({ client_id: this.cid, callback: (r) => Auth.cred(r), auto_select: false, cancel_on_tap_outside: false });
      google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with', width: 280, locale: this.lang });
      google.accounts.id.prompt();   // بيطلّع قايمة حسابات جوجل
    };
    if (window.google && google.accounts) return go();
    if (this.gis) return; this.gis = 1;
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => { this.gis = 0; Auth.btn(); }; document.head.appendChild(s);
  },
};

/* ===== AI: بيكلّم /api/ai (Workers AI) بنفس شكل الدوال القديمة ===== */
const AIshim = Object.assign(
  async (ms, o = {}) => {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: ms, stream: !!o.onText, max: o.max || 1500, lang: Auth.lang }) });
    if (!r.ok) throw new Error('ai ' + r.status);
    if (!o.onText) return { text: (await r.json()).text || '' };
    const rd = r.body.getReader(), d = new TextDecoder(); let t = '';
    for (;;) { const { done, value } = await rd.read(); if (done) break; t += d.decode(value, { stream: true }); o.onText({ text: t }); }
    return { text: t };
  },
  { json: async (p) => {
      const t = (await AIshim([{ role: 'user', content: p + '\n\nReturn raw JSON only, no markdown fences.' }], { max: 3800 })).text;
      const m = t.match(/[\[{][\s\S]*[\]}]/); if (!m) throw new Error('bad json'); return JSON.parse(m[0]);
  } });

/* ===== اللغة: قاموس عربي -> English؛ اللي مالوش ترجمة بيفضل عربي (مكس) ===== */
const DICT = {
'اليوم':'Today','المكتبة':'Library','المجتمع':'Community','حسابي':'Me','بحث':'Search','رجوع':'Back','التنقل':'Navigation',
'جاهز تذاكر النهاردة؟':'Ready to study today?','ابدأ اختبار جديد':'Start a new quiz','السلسلة':'Streak','يوم':'day','أيام':'days','إجابة صح':'correct',
'الأسبوع':'This week','أدواتك':'Your tools','فلاش كاردز':'Flashcards','المساعد الذكي':'AI Assistant','اسأل أو لخّص':'Ask or summarize','المحفوظات':'Saved',
'المواد والاختبارات':'Subjects & quizzes','الجلسات الأخيرة':'Recent sessions','مفيش مستحق':'Nothing due','لسه ما عملتش اختبار. ابدأ أول اختبار من الزرار فوق.':'No quiz yet. Start your first one above.',
'المواد':'Subjects','الاختبارات':'Quizzes','البطاقات':'Cards','الكل':'All','اختبار جديد':'New quiz','اختباراتك هتظهر هنا.':'Your quizzes will show here.','الراوندات':'Rounds',
'أطفال':'Pediatrics','مجاني':'Free','نسا وتوليد':'OB/GYN','قريبًا':'Soon','طب الأطفال':'Pediatrics','الفرقة':'Year','الهدف اليومي':'Daily goal','أدائي':'My performance',
'نسبة الدقة':'Accuracy','أسئلة محلولة':'Solved questions','الشباتر من الأضعف للأقوى':'Chapters, weakest to strongest','اشتراكاتي':'My subscriptions','بياناتي':'My data',
'كل بياناتك بتتحفظ على جهازك بس.':'Your data is saved on this device only.','مسح بياناتي':'Erase my data','اضغط تاني للتأكيد':'Tap again to confirm','تسجيل الخروج':'Sign out',
'الأولى':'1st','الثانية':'2nd','الثالثة':'3rd','الرابعة':'4th','الخامسة':'5th','السادسة':'6th','سجّل دخولك':'Sign in','منصتك الطبية للمذاكرة':'Your medical study platform',
'شروحات وكويزات وفلاش كاردز ومساعد ذكي في مكان واحد.':'Lectures, quizzes, flashcards and an AI tutor in one place.','علشان نحفظ تقدمك ونفتحلك محتوى فرقتك.':'So we can save your progress and unlock your year.',
'أنت في أنهي فرقة؟':'Which year are you in?','هنفتحلك محتوى فرقتك.':'We will open your year content.','شرح':'Lectures','كراشات':'Crash courses','ملخصات':'Summaries',
'عملي':'Practical','الحل':'Solutions','نصائح':'Tips','الكويزات':'Quizzes','دوّر في القسم ده':'Search this section','دوّر في مادة الأطفال':'Search pediatrics',
'مفيش نتائج مطابقة. جرّب كلمة تانية.':'No matches. Try another word.','مفيش نتائج. جرّب كلمة تانية.':'No results. Try another word.','اكتب اسم شابتر أو موضوع.':'Type a chapter or topic.',
'كويز':'Quiz','كل محاضرة ليها كويز بيتجهز جديد في كل مرة، مع شرح كل اختيار.':'Every lecture has a fresh AI quiz each time, with an explanation for each option.',
'الشابتر':'Chapter','عدد الأسئلة':'Number of questions','ولّد الاختبار':'Generate quiz','بنجهّز الأسئلة...':'Preparing questions...','معرفناش نجهّز الأسئلة. جرّب تاني.':'Could not prepare questions. Try again.',
'خلصت الاختبار':'Quiz finished','راجع البطاقات':'Review cards','السؤال التالي':'Next question','إنهاء':'Finish','شرح AI':'AI explanation','احفظ للرجوع':'Save for later','اتحفظ ✓':'Saved ✓',
'ملاحظة':'Note','اشرحلي أكتر':'Explain more','شاركه في الشات':'Share to chat','اتبعت في شات الفرقة.':'Sent to the year chat.','اكتب ملاحظتك':'Write your note',
'بنجهّز الشرح...':'Preparing explanation...','حصلت مشكلة. جرّب تاني.':'Something went wrong. Try again.','اعرض الإجابة':'Show answer','صعب':'Hard','متوسط':'Medium','سهل':'Easy','بكرة':'tomorrow',
'بطاقات جديدة من شابتر':'New cards from a chapter','ولّد بطاقات':'Generate cards','بنجهّز البطاقات...':'Preparing cards...','معرفناش نجهّز الكروت. جرّب تاني.':'Could not prepare cards. Try again.',
'اسأل':'Ask','لخّص محاضرة':'Summarize lecture','اسأل أي سؤال في المادة.':'Ask anything about the subject.','اسأل في أي نقطة':'Ask about anything','إرسال':'Send','لخّص':'Summarize',
'حوّلها لبطاقات':'Turn into cards','الصق نص المحاضرة هنا':'Paste the lecture text here','نص المحاضرة':'Lecture text','بنجهّز...':'Working...','اكتب سؤالك':'Type your question',
'الشات':'Chat','المشاركات':'Shares','قنوات':'Channels','انشر':'Post','العنوان':'Title','وصف قصير (اختياري)':'Short description (optional)','فتح الملف':'Open file','ملخص':'Summary',
'شارك كويز أو ملخص':'Share a quiz or summary','مشاركات الفرقة':'Year shares','قناة التليجرام':'Telegram channel','الدعم على واتساب':'WhatsApp support','اكتب رسالة':'Write a message',
'رسالتك':'Your message','ابدأ الكلام مع زمايلك في الفرقة.':'Start talking with your classmates.','لسه مفيش مشاركات. كن أول واحد.':'No shares yet. Be the first.','الاشتراك':'Subscription',
'اشترك في فرقة':'Subscribe to a year','سجّل طلب الاشتراك':'Request subscription','طلباتي':'My requests','المدة':'Duration','طريقة الدفع':'Payment method','الترم الأول':'Term 1',
'الترم الثاني':'Term 2','فودافون كاش':'Vodafone Cash','إنستاباي':'InstaPay','معلق':'Pending','مفعّل':'Active','ابعت الإيصال':'Send receipt','لوحة الأدمن':'Admin panel','فعّل':'Approve',
'ارفض':'Reject','باقي الفرق':'Other years','شيلها من المحفوظات':'Remove from saved','الجزء الأول':'Part 1','الجزء الثاني':'Part 2','يوتيوب':'YouTube','تليجرام':'Telegram',
'افتح الفيديوهات ←':'Open videos ←','د. محمد إسماعيل':'Dr. Mohamed Ismail','د. علي القزاز':'Dr. Ali El-Qazzaz','متابعة':'Continue','الاسم':'Name',
'الأسئلة والشرح بيتولدوا بالذكاء الاصطناعي، فراجع أي معلومة مهمة من مصدرك قبل ما تحفظها.':'Questions and explanations are AI-generated. Verify important facts from your source before memorizing.',
'لسه ما حفظتش أسئلة. اضغط "احفظ للرجوع" تحت أي سؤال.':'Nothing saved yet. Tap "Save for later" under any question.',
'بنجهّز الذكاء الاصطناعي...':'Getting the AI ready...','الدخول بجوجل لسه متظبطش (محتاج Client ID).':'Google sign-in is not configured yet (Client ID needed).','تعذّر تسجيل الدخول. جرّب تاني.':'Sign-in failed. Try again.'
};
let EXPLAIN_AUTO = null;
const RX = [
[/^منذ (\d+) دقيقة$/, '$1 min ago'], [/^منذ (\d+) ساعة$/, '$1 h ago'], [/^منذ (\d+) يوم$/, '$1 d ago'], [/^دلوقتي$/, 'now'], [/^من (\d+)$/, 'of $1'],
[/^سؤال (\d+) من (\d+)$/, 'Question $1 of $2'], [/^(\d+) مستحقة$/, '$1 due'], [/^(\d+) سؤال$/, '$1 questions'], [/^أهلاً (.*?) · .*$/, 'Hi $1'],
[/^الفرقة (.+)$/, (m, y) => 'Year ' + (DICT[y] || y)], [/^الدرجة: (\d+) من (\d+) · (.*)$/, 'Score: $1 / $2 · $3'], [/^كويز: (.*)$/, 'Quiz: $1'],
[/^(\d+) محاضرة · (\d+) فيديو · .*$/, '$1 lectures · $2 videos · quizzes, crash courses, summaries'], [/^(\d+) بطاقة · (\d+) مستحقة$/, '$1 cards · $2 due'],
[/^عندك (\d+) بطاقة، (\d+) منها مستحقة دلوقتي\.$/, 'You have $1 cards, $2 due now.'], [/^جاوبت صح على (\d+) من (\d+)\..*$/, 'You got $1 of $2 right. Missed questions were added to flashcards.'],
[/^اتضافت (\d+) .*$/, 'Added $1 new cards.']
];
function tr(s) {
  const k = s.trim(); if (!k) return s;
  if (!EXPLAIN_AUTO) { EXPLAIN_AUTO = {}; try { EXPLAIN.forEach(c => EXPLAIN_AUTO[c.ar] = c.en); } catch (e) {} }
  let r = DICT[k] || EXPLAIN_AUTO[k];
  if (!r) for (const [re, to] of RX) if (re.test(k)) { r = k.replace(re, to); break; }
  return r ? s.replace(k, r) : s;
}
function applyLang() {
  const en = Auth.lang === 'en', h = document.documentElement;
  h.lang = en ? 'en' : 'ar'; h.dir = en ? 'ltr' : 'rtl';
  const lg = document.getElementById('lg'); if (lg) lg.textContent = en ? 'عربي' : 'EN';
  if (!en) return;
  const w = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) if (/[\u0600-\u06FF]/.test(n.nodeValue)) { const v = tr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
  document.querySelectorAll('#app [placeholder],#app [aria-label]').forEach(e => ['placeholder', 'aria-label'].forEach(a => { const v = e.getAttribute(a); if (v && /[\u0600-\u06FF]/.test(v)) e.setAttribute(a, tr(v)); }));
}
function setLang(l) { Auth.lang = l; localStorage.setItem('mzlang', l); draw(); }
document.addEventListener('DOMContentLoaded', () => {
  const b = document.createElement('button'); b.id = 'lg'; b.className = 'lg'; b.type = 'button'; b.setAttribute('aria-label', 'Language'); document.body.appendChild(b);
  b.onclick = () => setLang(Auth.lang === 'en' ? 'ar' : 'en'); applyLang();
});
