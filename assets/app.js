/* ============ 班主任工作台 · 应用逻辑 ============ */
(function () {
  'use strict';

  var U = window.U, Charts = window.Charts, Store = window.Store;
  var S;
  var view = 'dashboard';
  var ui = { query: '', examId: null, scoreTab: 'entry', pickedSeat: null, trendSid: '', recFilter: 'all', pointFilter: 'all' };

  /* ================= 基础工具 ================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) { return U.esc(s); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function num(v, d) { var n = parseFloat(v); return isFinite(n) ? n : (d || 0); }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
  function sortDesc(arr, key) { return arr.slice().sort(function (a, b) { return (b[key] || 0) - (a[key] || 0); }); }
  function byDateDesc(a, b) { return String(b.date).localeCompare(String(a.date)); }
  function todayStr() { return U.dstr(); }

  function toast(msg, type) {
    var root = document.getElementById('toastRoot');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 220);
    }, 2000);
  }

  function save(renderAfter) {
    var ok = Store.save();
    if (!ok) toast('保存失败：浏览器存储空间可能已满', 'err');
    if (renderAfter) render();
  }

  /* ================= 模态框 ================= */
  function openModal(o) {
    var root = document.getElementById('modalRoot');
    root.innerHTML =
      '<div class="modal-mask">' +
      '<div class="modal ' + (o.cls || '') + '" role="dialog">' +
      '<div class="modal-head"><h3>' + esc(o.title) + '</h3><button class="x" data-act="closeModal">×</button></div>' +
      '<div class="modal-body">' + o.body + '</div>' +
      (o.footer === null ? '' : '<div class="modal-foot">' + (o.footer || '<button class="btn" data-act="closeModal">关闭</button>') + '</div>') +
      '</div></div>';
    var first = root.querySelector('input,select,textarea');
    if (first && o.autofocus !== false) setTimeout(function () { first.focus(); }, 60);
  }
  function closeModal() { document.getElementById('modalRoot').innerHTML = ''; }

  function confirmBox(title, text, onOk, okText) {
    openModal({
      title: title, cls: 'narrow',
      body: '<p style="font-size:13.5px;line-height:1.7;color:#475569">' + text + '</p>',
      footer: '<button class="btn" data-act="closeModal">取消</button>' +
        '<button class="btn danger" id="cfmOk">' + (okText || '确认删除') + '</button>'
    });
    $('#cfmOk').onclick = function () { closeModal(); onOk(); };
  }

  /* ================= 派生数据 ================= */
  function activeStudents() {
    return S.students.filter(function (s) { return !s.archived; });
  }
  function stu(sid) {
    return S.students.find(function (s) { return s.id === sid; }) || { id: sid, name: '（已删除）', group: 0, no: '—' };
  }
  function pointsOf(sid) {
    return sum(S.discipline.filter(function (d) { return d.sid === sid; }).map(function (d) { return +d.points || 0; }));
  }
  function awardCount(sid) {
    return S.discipline.filter(function (d) { return d.sid === sid && d.type === 'award'; }).length;
  }
  function examById(id) { return S.exams.find(function (e) { return e.id === id; }); }
  function curExam() {
    if (!S.exams.length) return null;
    var e = examById(ui.examId);
    if (!e) { e = S.exams[S.exams.length - 1]; ui.examId = e.id; }
    return e;
  }
  function scoreOf(examId, sid, sub) {
    var r = S.scores.find(function (x) { return x.examId === examId && x.sid === sid && x.sub === sub; });
    return r ? r.val : null;
  }
  function totalOf(examId, sid) {
    var rows = S.scores.filter(function (x) { return x.examId === examId && x.sid === sid; });
    if (!rows.length) return null;
    return sum(rows.map(function (r) { return +r.val; }));
  }
  function examRanking(examId) {
    var list = activeStudents().map(function (s) {
      return { sid: s.id, total: totalOf(examId, s.id), name: s.name, no: s.no };
    }).filter(function (x) { return x.total !== null; });
    list.sort(function (a, b) { return b.total - a.total; });
    list.forEach(function (x, i) { x.rank = i + 1; });
    return list;
  }
  function subjectStats(examId, sub) {
    var vals = activeStudents().map(function (s) { return scoreOf(examId, s.id, sub); })
      .filter(function (v) { return v !== null; }).map(Number);
    if (!vals.length) return null;
    return {
      sub: sub, n: vals.length,
      avg: Math.round(sum(vals) / vals.length * 10) / 10,
      max: Math.max.apply(null, vals),
      min: Math.min.apply(null, vals),
      pass: pct(vals.filter(function (v) { return v >= 60; }).length, vals.length),
      excellent: pct(vals.filter(function (v) { return v >= 85; }).length, vals.length)
    };
  }
  function failCount(examId, sid) {
    var e = examById(examId); if (!e) return 0;
    return e.subjects.filter(function (sub) { var v = scoreOf(examId, sid, sub); return v !== null && v < 60; }).length;
  }
  function groupOf(n) {
    var list = [];
    for (var g = 0; g <= (n || 6); g++) list.push(g);
    return list;
  }
  function avatarCls(g) { return 'avatar g' + (g >= 0 && g <= 6 ? g : 0); }

  /* ================= 导航 ================= */
  var NAV = [
    { group: '概览', items: [{ id: 'dashboard', label: '仪表盘', icon: '▦' }] },
    {
      group: '班级', items: [
        { id: 'students', label: '学生档案', icon: '☰' },
        { id: 'seats', label: '座位表', icon: '▤' },
        { id: 'groups', label: '分组与值日', icon: '◫' }
      ]
    },
    {
      group: '日常事务', items: [
        { id: 'attendance', label: '考勤登记', icon: '✓' },
        { id: 'points', label: '奖惩积分', icon: '★' },
        { id: 'fees', label: '班费事务', icon: '¥' }
      ]
    },
    {
      group: '教学', items: [
        { id: 'scores', label: '成绩分析', icon: '◔' },
        { id: 'teach', label: '课表与作业', icon: '▥' }
      ]
    },
    {
      group: '家校', items: [
        { id: 'notices', label: '通知发布', icon: '✉' },
        { id: 'comms', label: '家校沟通', icon: '☎' },
        { id: 'records', label: '工作留痕', icon: '▣' }
      ]
    },
    { group: '系统', items: [{ id: 'backup', label: '数据备份', icon: '⛁' }] }
  ];

  var META = {
    dashboard: ['仪表盘', '今日待办 · 班级动态 · 风险预警'],
    students: ['学生档案', '花名册 · 联系方式 · 成长记录'],
    seats: ['座位表', '可视化排座 · 点击两张座位互换'],
    groups: ['分组与值日', '学习小组 · 值日轮值 · 岗位职责'],
    attendance: ['考勤登记', '出勤 · 请假 · 迟到 · 缺勤'],
    points: ['奖惩积分', '量化积分 · 红花榜 · 阈值预警'],
    fees: ['班费事务', '收支流水 · 缴费状态 · 公示'],
    scores: ['成绩分析', '录入 · 统计 · 趋势 · 学业预警'],
    teach: ['课表与作业', '周课表 · 作业跟进 · 班会模板'],
    notices: ['通知发布', '发布通知 · 已读回执'],
    comms: ['家校沟通', '通话 · 面谈 · 会议记录'],
    records: ['工作留痕', '班会 · 安全教育 · 家访归档'],
    backup: ['数据备份', '导出迁移 · 恢复 · 存储占用']
  };

  function renderNav() {
    var todo = S.tasks.filter(function (t) { return !t.done; }).length;
    var alerts = activeStudents().filter(function (s) { return pointsOf(s.id) < S.settings.pointThreshold; }).length;
    var html = NAV.map(function (g) {
      return '<div class="nav-group"><div class="nav-group-label">' + g.group + '</div>' +
        g.items.map(function (it) {
          var badge = '';
          if (it.id === 'dashboard' && todo) badge = '<span class="badge-dot">' + todo + '</span>';
          if (it.id === 'points' && alerts) badge = '<span class="badge-dot">' + alerts + '</span>';
          return '<button class="nav-item' + (view === it.id ? ' active' : '') + '" data-act="go" data-view="' + it.id + '">' +
            '<span class="ni">' + it.icon + '</span>' + it.label + badge + '</button>';
        }).join('') + '</div>';
    }).join('');
    document.getElementById('nav').innerHTML = html;
  }

  function render() {
    var m = META[view] || META.dashboard;
    document.getElementById('pageTitle').textContent = m[0];
    document.getElementById('pageSub').textContent = m[1];
    document.getElementById('brandClass').textContent = (S.settings.className || '我的班级') + ' · ' + (S.settings.teacher || '班主任');
    document.getElementById('termPill').textContent = S.settings.term || '';
    renderNav();
    var host = document.getElementById('view');
    host.innerHTML = (VIEWS[view] || VIEWS.dashboard)();
    if (AFTER[view]) AFTER[view]();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ================= 视图：仪表盘 ================= */
  function vDashboard() {
    var act = activeStudents();
    var today = todayStr();
    var attToday = S.attendance.filter(function (a) { return a.date === today; });
    var awayToday = attToday.filter(function (a) { return a.type === 'leave' || a.type === 'absent'; });
    var rate = act.length ? Math.round(((act.length - awayToday.length) / act.length) * 100) : 100;
    var todo = S.tasks.filter(function (t) { return !t.done; });
    var warn = act.filter(function (s) { return pointsOf(s.id) < S.settings.pointThreshold; });
    var days = U.daysBetween(today, S.settings.examTarget || today);
    var wd = new Date().getDay();
    var row = (wd >= 1 && wd <= 5) ? (S.timetable[wd - 1] || []) : null;

    /* 近 30 天汇总 */
    var from = U.shift(-30);
    var in30 = function (d) { return d >= from && d <= today; };
    var att30 = S.attendance.filter(function (a) { return in30(a.date); });
    var dis30 = S.discipline.filter(function (d) { return in30(d.date); });
    var comm30 = S.comms.filter(function (c) { return in30(c.date); });
    var rec30 = S.records.filter(function (r) { return in30(r.date); });

    /* 出勤趋势 */
    var labels = [], data = [], d = 0, cnt = 0;
    while (cnt < 14 && d < 60) {
      var ds = U.shift(-d); d++;
      var w = U.parseDate(ds).getDay();
      if (w === 0 || w === 6) continue;
      var recs = S.attendance.filter(function (a) { return a.date === ds && (a.type === 'leave' || a.type === 'absent'); });
      labels.push(U.fmtCn(ds));
      data.push(act.length ? Math.round(((act.length - recs.length) / act.length) * 1000) / 10 : 100);
      cnt++;
    }

    /* 班级动态 */
    var dyn = [];
    S.attendance.filter(function (a) { return in30(a.date); }).forEach(function (a) {
      var nm = stu(a.sid).name;
      var map = { leave: ['请假', 'amber'], absent: ['缺勤', 'red'], late: ['迟到', 'amber'], early: ['早退', 'amber'] };
      var mm = map[a.type] || ['考勤', 'blue'];
      dyn.push({ date: a.date, icon: '✓', cls: mm[1], title: nm + ' ' + mm[0], meta: a.reason || '' });
    });
    S.discipline.filter(function (x) { return in30(x.date); }).forEach(function (x) {
      var isGood = x.points > 0;
      dyn.push({
        date: x.date, icon: isGood ? '★' : '!', cls: isGood ? 'green' : 'red',
        title: stu(x.sid).name + ' · ' + x.title,
        meta: (x.points ? (x.points > 0 ? '+' : '') + x.points + ' 分' : '记录') + (x.note ? ' · ' + x.note : '')
      });
    });
    S.comms.forEach(function (c) { dyn.push({ date: c.date, icon: '☎', cls: 'blue', title: stu(c.sid).name + ' 家长' + c.type, meta: c.summary }); });
    S.records.forEach(function (r) { dyn.push({ date: r.date, icon: '▣', cls: 'blue', title: r.category + '：' + r.title, meta: '' }); });
    dyn.sort(byDateDesc);

    var maxPoint = Math.max.apply(null, act.map(function (s) { return pointsOf(s.id); }).concat([1]));
    var star = act.slice().sort(function (a, b) { return awardCount(b.id) - awardCount(a.id); })[0];
    var totalPts = sum(act.map(function (s) { return pointsOf(s.id); }));

    var h = '';
    h += '<div class="grid g4 mb16">';
    h += stat('在册学生', act.length + '<small>人</small>',
      '男 ' + act.filter(function (s) { return s.gender === '男'; }).length + ' · 女 ' + act.filter(function (s) { return s.gender === '女'; }).length, '☰');
    h += stat('今日出勤率', rate + '<small>%</small>',
      '请假 ' + attToday.filter(function (a) { return a.type === 'leave'; }).length + ' · 缺勤 ' + attToday.filter(function (a) { return a.type === 'absent'; }).length, '✓');
    h += stat('待办事项', todo.length + '<small>项</small>',
      '今日 ' + todo.filter(function (t) { return t.date === today; }).length + ' 项 · 逾期 ' + todo.filter(function (t) { return t.date < today; }).length + ' 项', '☑');
    h += stat((S.settings.examTargetName || '考试') + '倒计时', (days >= 0 ? days : 0) + '<small>天</small>',
      (S.settings.examTarget || '') + ' · 距今天', '◔');
    h += '</div>';

    /* 课表 + 待办 */
    h += '<div class="grid g-2-1 mb16">';
    h += '<div class="card"><div class="card-head"><h3>今日课表</h3><span class="sub">' +
      (row ? ['周一', '周二', '周三', '周四', '周五'][wd - 1] : '周末 · 无课') + '</span>' +
      '<div class="right"><button class="btn sm ghost" data-act="go" data-view="teach">编辑课表</button></div></div>';
    h += '<div class="card-body">';
    if (row && row.length) {
      h += '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:9px">';
      row.forEach(function (sub, i) {
        var isNow = i === 0;
        h += '<div style="border:1px solid ' + (isNow ? '#c7d9fb' : '#eef1f6') + ';background:' + (isNow ? '#f5f9ff' : '#fcfdff') + ';border-radius:10px;padding:9px 8px;text-align:center">' +
          '<div style="font-size:10.5px;color:#8a94a6">第' + (i + 1) + '节</div>' +
          '<div style="font-size:13px;font-weight:650;margin-top:2px">' + esc(sub || '—') + '</div></div>';
      });
      h += '</div>';
    } else {
      h += '<div class="empty"><span class="em">☕</span>今天没有课，记得关注班级群消息</div>';
    }
    h += '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>今日待办</h3><div class="right">' +
      '<button class="btn sm ghost" data-act="addTask">＋ 添加</button></div></div><div class="card-body tight"><div class="list">';
    if (!todo.length) {
      h += '<div class="empty"><span class="em">🎉</span>待办全部完成</div>';
    } else {
      todo.slice(0, 6).forEach(function (t) {
        var overdue = t.date < today;
        h += '<div class="list-item"><button class="li-ico ' + (overdue ? 'red' : 'blue') + '" data-act="toggleTask" data-id="' + t.id + '" style="border:0;cursor:pointer">' +
          (overdue ? '!' : '○') + '</button>' +
          '<div class="li-main"><div class="li-title">' + esc(t.title) + '</div>' +
          '<div class="li-meta">' + esc(t.type || '常规') + ' · ' + U.fmtCn(t.date) + (overdue ? ' · <span style="color:#e5484d">已逾期</span>' : '') + '</div></div></div>';
      });
    }
    h += '</div></div></div></div>';

    /* 趋势 */
    var yMin = Math.max(0, Math.min(92, Math.floor(Math.min.apply(null, data.concat([100])) - 2)));
    h += '<div class="card mb16"><div class="card-head"><h3>出勤率趋势</h3><span class="sub">最近 14 个教学日</span>' +
      '<div class="right"><button class="btn sm ghost" data-act="go" data-view="attendance">去登记</button></div></div>' +
      '<div class="card-body">' + Charts.line(labels, [{ name: '出勤率(%)', data: data }], { height: 170, min: yMin, max: 100 }) + '</div></div>';

    /* 汇总 + 动态 + 预警 */
    h += '<div class="grid g3">';
    h += '<div class="card"><div class="card-head"><h3>近 30 天概览</h3></div><div class="card-body">';
    var rows30 = [
      ['请假 / 缺勤', att30.filter(function (a) { return a.type === 'leave' || a.type === 'absent'; }).length + ' 人次', 'amber'],
      ['表扬记录', dis30.filter(function (x) { return x.points > 0; }).length + ' 条', 'green'],
      ['违纪记录', dis30.filter(function (x) { return x.type === 'violation'; }).length + ' 条', 'red'],
      ['家校沟通', comm30.length + ' 次', 'blue'],
      ['工作留痕', rec30.length + ' 条', 'gray']
    ];
    rows30.forEach(function (r) {
      h += '<div class="bar-row" style="margin-bottom:9px"><span style="min-width:70px;color:#475569;text-align:left;font-size:12.5px">' + r[0] + '</span>' +
        '<span class="bdg ' + r[2] + '" style="margin-left:auto">' + r[1] + '</span></div>';
    });
    h += '<div class="note" style="margin-top:6px"><span>全班累计积分 <b>' + totalPts + '</b> 分，人均 <b>' + (act.length ? (totalPts / act.length).toFixed(1) : 0) + '</b> 分</span></div>';
    h += '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>班级动态</h3><div class="right"><button class="btn sm ghost" data-act="go" data-view="records">全部</button></div></div>' +
      '<div class="card-body tight"><div class="list">';
    if (!dyn.length) h += '<div class="empty"><span class="em">📭</span>暂无动态</div>';
    dyn.slice(0, 6).forEach(function (x) {
      h += '<div class="list-item"><div class="li-ico ' + x.cls + '">' + x.icon + '</div>' +
        '<div class="li-main"><div class="li-title">' + esc(x.title) + '</div>' +
        '<div class="li-meta">' + U.fmtCn(x.date) + (x.meta ? ' · ' + esc(x.meta).slice(0, 46) : '') + '</div></div></div>';
    });
    h += '</div></div></div>';

    h += '<div class="card"><div class="card-head"><h3>需要关注</h3><span class="sub">积分预警 ' + warn.length + ' 人</span></div><div class="card-body">';
    if (!warn.length) {
      h += '<div class="note ok" style="margin-bottom:10px"><span>暂无积分预警，班级状态良好</span></div>';
    } else {
      h += '<div class="note warn mb12"><span><b>' + warn.length + '</b> 名学生积分低于 ' + S.settings.pointThreshold + ' 分，建议约谈</span></div>';
      warn.slice(0, 5).forEach(function (s) {
        h += '<div class="rank-row"><div class="rank-name">' + esc(s.name) + '</div>' +
          '<span class="bdg red">' + pointsOf(s.id) + ' 分</span>' +
          '<button class="btn xs ghost" data-act="studentProfile" data-id="' + s.id + '">查看</button></div>';
      });
    }
    if (star) {
      h += '<div class="note" style="margin-top:12px"><span>🌸 红花榜第一：<b>' + esc(star.name) + '</b>（' + awardCount(star.id) + ' 朵）</span></div>';
    }
    h += '</div></div>';
    h += '</div>';
    return h;
  }

  function stat(label, val, foot, chev) {
    return '<div class="stat"><div class="lbl">' + label + '</div><div class="val">' + val + '</div>' +
      '<div class="foot">' + foot + '</div><div class="chev">' + (chev || '') + '</div></div>';
  }

  /* ================= 视图：学生档案 ================= */
  function matchStudent(s, q) {
    if (!q) return true;
    q = q.toLowerCase();
    var hay = [s.name, s.no, s.phone, s.parent, s.parentPhone, s.dorm, '第' + s.group + '组'].join(' ').toLowerCase();
    var py = U.initials(s.name).toLowerCase();
    return hay.indexOf(q) > -1 || py.indexOf(q) === 0 || py.indexOf(q) > -1;
  }

  function studentRows() {
    var list = activeStudents().filter(function (s) { return matchStudent(s, ui.query); });
    if (!list.length) return '<tr><td colspan="9"><div class="empty"><span class="em">🔍</span>没有匹配的学生</div></td></tr>';
    return list.map(function (s) {
      var pts = pointsOf(s.id);
      return '<tr>' +
        '<td class="mono muted">' + esc(s.no) + '</td>' +
        '<td><div class="row-name"><div class="' + avatarCls(s.group) + '">' + esc(s.name.slice(0, 1)) + '</div>' +
        '<div><div style="font-weight:600">' + esc(s.name) + '</div><div class="small muted">' + esc(U.initials(s.name).toUpperCase()) + '</div></div></div></td>' +
        '<td>' + esc(s.gender) + '</td>' +
        '<td><span class="bdg line">第' + s.group + '组</span></td>' +
        '<td class="small muted">' + (s.row !== undefined && s.col !== undefined ? (s.row + 1) + '排' + (s.col + 1) + '座' : '未排') + '</td>' +
        '<td class="small">' + esc(s.parent || '—') + '<div class="muted mono" style="font-size:11px">' + esc(s.parentPhone || '') + '</div></td>' +
        '<td class="num"><span class="bdg ' + (pts > 0 ? 'green' : pts < 0 ? 'red' : 'gray') + '">' + (pts > 0 ? '+' : '') + pts + '</span></td>' +
        '<td class="num"><span class="flower">' + '🌸'.repeat(Math.min(awardCount(s.id), 5)) + '</span></td>' +
        '<td class="right nowrap">' +
        '<button class="btn xs ghost" data-act="studentProfile" data-id="' + s.id + '">档案</button> ' +
        '<button class="btn xs ghost" data-act="editStudent" data-id="' + s.id + '">编辑</button> ' +
        '<button class="btn xs ghost danger" data-act="delStudent" data-id="' + s.id + '">删除</button>' +
        '</td></tr>';
    }).join('');
  }

  function vStudents() {
    var act = activeStudents();
    var h = '';
    h += '<div class="toolbar">' +
      '<div class="search-box"><input class="inp" id="stuSearch" placeholder="搜索姓名 / 拼音首字母 / 学号 / 电话" value="' + esc(ui.query) + '"></div>' +
      '<button class="btn primary" data-act="addStudent">＋ 新增学生</button>' +
      '<button class="btn" data-act="importStudents">从 Excel 导入</button>' +
      '<button class="btn" data-act="exportStudents">导出名单</button>' +
      '<div class="spacer"></div>' +
      '<span class="small muted">共 ' + act.length + ' 人 · 6 组</span>' +
      '</div>';

    h += '<div class="card"><div class="tbl-wrap" style="max-height:calc(100vh - 240px)"><table class="tbl">' +
      '<thead><tr><th>学号</th><th>姓名</th><th>性别</th><th>分组</th><th>座位</th><th>家长 / 电话</th><th class="num">积分</th><th class="num">红花</th><th class="right">操作</th></tr></thead>' +
      '<tbody id="stuBody">' + studentRows() + '</tbody></table></div></div>';

    h += '<div class="note mt16"><span><b>拼音检索：</b>直接输入首字母即可，例如「zs」可检索到「张三」。导入支持从 Excel 复制单元格后粘贴，表头识别：姓名、学号、性别、分组、家长、电话。</span></div>';
    return h;
  }

  function studentForm(s) {
    s = s || {};
    return '<form data-form="student" data-id="' + (s.id || '') + '">' +
      '<div class="form-row">' +
      '<div class="field"><label>姓名 *</label><input class="inp" name="name" required value="' + esc(s.name || '') + '"></div>' +
      '<div class="field"><label>学号</label><input class="inp" name="no" value="' + esc(s.no || '') + '"></div>' +
      '</div>' +
      '<div class="form-row three mt12">' +
      '<div class="field"><label>性别</label><select class="sel" name="gender"><option' + (s.gender === '男' ? ' selected' : '') + '>男</option><option' + (s.gender === '女' ? ' selected' : '') + '>女</option></select></div>' +
      '<div class="field"><label>分组</label><select class="sel" name="group">' + [1, 2, 3, 4, 5, 6].map(function (g) { return '<option value="' + g + '"' + (s.group === g ? ' selected' : '') + '>第' + g + '组</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>宿舍</label><input class="inp" name="dorm" value="' + esc(s.dorm || '') + '"></div>' +
      '</div>' +
      '<div class="form-row mt12">' +
      '<div class="field"><label>家长姓名</label><input class="inp" name="parent" value="' + esc(s.parent || '') + '"></div>' +
      '<div class="field"><label>家长电话</label><input class="inp" name="parentPhone" value="' + esc(s.parentPhone || '') + '"></div>' +
      '</div>' +
      '<div class="field mt12"><label>学生电话</label><input class="inp" name="phone" value="' + esc(s.phone || '') + '"></div>' +
      '<div class="field mt12"><label>标签（逗号分隔，如：走读、体育生、需关注）</label><input class="inp" name="tags" value="' + esc((s.tags || []).join('，')) + '"></div>' +
      '</form>';
  }

  function vSeats() {
    var rows = S.settings.seatRows || 6, cols = S.settings.seatCols || 7;
    var h = '<div class="toolbar">' +
      '<button class="btn primary" data-act="seatRandom">随机排座</button>' +
      '<button class="btn" data-act="seatByNo">按学号排列</button>' +
      '<button class="btn" data-act="seatClear">清空座位</button>' +
      '<button class="btn" data-act="printView">打印座位表</button>' +
      '<div class="spacer"></div><span class="small muted">点击两个座位可互换位置</span></div>';

    h += '<div class="card"><div class="card-body">';
    h += '<div class="podium">讲 台</div><div class="seat-grid" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">';
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var s = activeStudents().find(function (x) { return x.row === r && x.col === c; });
        if (s) {
          h += '<div class="seat' + (ui.pickedSeat === s.id ? ' picked' : '') + '" data-act="seatPick" data-id="' + s.id + '">' +
            '<span class="g-tag">' + s.group + '</span>' +
            '<div class="s-name">' + esc(s.name) + '</div><div class="s-meta">' + esc(s.no) + '</div></div>';
        } else {
          h += '<div class="seat empty-seat" data-act="seatPick" data-rid="' + r + '" data-cid="' + c + '">空位</div>';
        }
      }
    }
    h += '</div></div></div>';

    var unseated = activeStudents().filter(function (s) { return s.row === undefined || s.row === null; });
    if (unseated.length) {
      h += '<div class="card mt16"><div class="card-head"><h3>未排座学生</h3><span class="sub">' + unseated.length + ' 人</span></div><div class="card-body"><div class="chips">' +
        unseated.map(function (s) { return '<span class="chip">' + esc(s.name) + '</span>'; }).join('') + '</div></div></div>';
    }
    return h;
  }

  function vGroups() {
    var act = activeStudents();
    var groups = {};
    act.forEach(function (s) { (groups[s.group] = groups[s.group] || []).push(s); });
    var lastExam = curExam();

    var h = '<div class="sec-head"><h2>学习小组</h2><div class="line"></div>' +
      '<div class="right"><button class="btn sm" data-act="regroup">重新分组</button></div></div>';
    h += '<div class="grid g3">';
    Object.keys(groups).sort().forEach(function (g) {
      var members = groups[g];
      var pts = sum(members.map(function (s) { return pointsOf(s.id); }));
      var avg = '—';
      if (lastExam) {
        var tots = members.map(function (s) { return totalOf(lastExam.id, s.id); }).filter(function (x) { return x !== null; });
        if (tots.length) avg = (sum(tots) / tots.length).toFixed(1);
      }
      h += '<div class="card"><div class="card-head"><h3>第 ' + g + ' 组</h3>' +
        '<span class="sub">' + members.length + ' 人</span>' +
        '<div class="right"><span class="bdg ' + (pts >= 0 ? 'green' : 'red') + '">' + pts + ' 分</span></div></div>' +
        '<div class="card-body"><div class="chips">' +
        members.map(function (s) { return '<span class="chip" data-act="studentProfile" data-id="' + s.id + '" style="cursor:pointer">' + esc(s.name) + '</span>'; }).join('') +
        '</div><div class="small muted mt12">小组均分：<b style="color:#131a26">' + avg + '</b></div></div></div>';
    });
    h += '</div>';

    /* 值日表 */
    var groupKeys = Object.keys(groups).sort();
    var duties = ['扫地拖地', '擦黑板讲台', '倒垃圾', '摆桌椅', '关门窗电源'];
    h += '<div class="sec-head"><h2>值日轮值表</h2><div class="line"></div>' +
      '<div class="right"><button class="btn sm" data-act="printView">打印值日表</button></div></div>';
    h += '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>周次</th><th>值日组</th><th>组长</th><th>成员</th><th>分工</th></tr></thead><tbody>';
    for (var w = 0; w < 6; w++) {
      var gk = groupKeys[w % groupKeys.length];
      var members2 = groups[gk] || [];
      var leader = members2[0];
      h += '<tr><td class="nowrap">第 ' + (w + 1) + ' 周</td>' +
        '<td><span class="bdg blue">第 ' + gk + ' 组</span></td>' +
        '<td>' + esc(leader ? leader.name : '—') + '</td>' +
        '<td class="small">' + members2.map(function (s) { return esc(s.name); }).join('、') + '</td>' +
        '<td class="small muted">' + duties.map(function (d, i) { return d + (i < members2.length ? '：' + esc(members2[i].name) : ''); }).join('；') + '</td></tr>';
    }
    h += '</tbody></table></div></div>';
    return h;
  }

  /* ================= 视图：考勤 ================= */
  function vAttendance() {
    if (!ui.attDate) ui.attDate = todayStr();
    var date = ui.attDate;
    var act = activeStudents();
    var recs = S.attendance.filter(function (a) { return a.date === date; });
    var get = function (sid) { var r = recs.find(function (x) { return x.sid === sid; }); return r ? r.type : 'present'; };
    var absent = recs.filter(function (r) { return r.type === 'absent'; }).length;
    var leave = recs.filter(function (r) { return r.type === 'leave'; }).length;

    var h = '<div class="toolbar">' +
      '<div class="field" style="min-width:160px"><input class="inp" type="date" id="attDate" value="' + date + '"></div>' +
      '<button class="btn" data-act="attAllPresent">全班到齐</button>' +
      '<div class="spacer"></div>' +
      '<span class="bdg green">应到 ' + act.length + '</span>' +
      '<span class="bdg amber">请假 ' + leave + '</span>' +
      '<span class="bdg red">缺勤 ' + absent + '</span></div>';

    h += '<div class="card"><div class="tbl-wrap" style="max-height:calc(100vh - 250px)"><table class="tbl"><thead><tr>' +
      '<th>学号</th><th>姓名</th><th>分组</th><th>状态</th><th>说明</th></tr></thead><tbody>';
    act.forEach(function (s) {
      var cur = get(s.id);
      var types = [['present', '正常', ''], ['leave', '请假', 'amber'], ['late', '迟到', 'amber'], ['absent', '缺勤', 'red'], ['early', '早退', 'amber']];
      var reason = (recs.find(function (x) { return x.sid === s.id; }) || {}).reason || '';
      h += '<tr><td class="mono muted">' + esc(s.no) + '</td>' +
        '<td><div class="row-name"><div class="' + avatarCls(s.group) + '">' + esc(s.name.slice(0, 1)) + '</div><div style="font-weight:600">' + esc(s.name) + '</div></div></td>' +
        '<td class="small muted">第' + s.group + '组</td>' +
        '<td><div class="chips">' + types.map(function (t) {
          return '<button class="chip' + (cur === t[0] ? ' on' : '') + '" data-act="setAtt" data-sid="' + s.id + '" data-type="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div></td>' +
        '<td class="small muted">' + esc(reason) + '</td></tr>';
    });
    h += '</tbody></table></div></div>';

    /* 本月统计 */
    var month = date.slice(0, 7);
    var mrecs = S.attendance.filter(function (a) { return String(a.date).slice(0, 7) === month; });
    var byStu = {};
    mrecs.forEach(function (r) { byStu[r.sid] = (byStu[r.sid] || 0) + 1; });
    var top = Object.keys(byStu).map(function (k) { return { sid: k, n: byStu[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);

    h += '<div class="grid g2 mt16">';
    h += '<div class="card"><div class="card-head"><h3>本月考勤汇总</h3><span class="sub">' + month + '</span></div><div class="card-body">' +
      '<div class="grid g3" style="gap:10px">' +
      '<div><div class="small muted">请假</div><div style="font-size:20px;font-weight:700">' + mrecs.filter(function (r) { return r.type === 'leave'; }).length + '</div></div>' +
      '<div><div class="small muted">迟到</div><div style="font-size:20px;font-weight:700">' + mrecs.filter(function (r) { return r.type === 'late'; }).length + '</div></div>' +
      '<div><div class="small muted">缺勤</div><div style="font-size:20px;font-weight:700;color:#e5484d">' + mrecs.filter(function (r) { return r.type === 'absent'; }).length + '</div></div>' +
      '</div></div></div>';
    h += '<div class="card"><div class="card-head"><h3>需关注名单</h3><span class="sub">本月考勤异常次数最多</span></div><div class="card-body">';
    if (!top.length) h += '<div class="empty" style="padding:18px">本月暂无异常记录</div>';
    top.forEach(function (t) {
      h += '<div class="rank-row"><div class="rank-name">' + esc(stu(t.sid).name) + '</div>' +
        '<span class="bdg amber">' + t.n + ' 次</span>' +
        '<button class="btn xs ghost" data-act="studentProfile" data-id="' + t.sid + '">查看</button></div>';
    });
    h += '</div></div></div>';
    return h;
  }

  /* ================= 视图：奖惩积分 ================= */
  function vPoints() {
    var act = activeStudents();
    var rank = act.map(function (s) { return { sid: s.id, name: s.name, pts: pointsOf(s.id) }; }).sort(function (a, b) { return b.pts - a.pts; });
    var flowers = act.map(function (s) { return { sid: s.id, name: s.name, n: awardCount(s.id) }; }).sort(function (a, b) { return b.n - a.n; });
    var warn = act.filter(function (s) { return pointsOf(s.id) < S.settings.pointThreshold; });

    var h = '<div class="grid g-2-1 mb16">';
    h += '<div class="card"><div class="card-head"><h3>快速登记</h3><span class="sub">表扬 · 违纪 · 谈心 · 竞赛</span></div><div class="card-body">' +
      '<form data-form="discipline"><div class="form-row three">' +
      '<div class="field"><label>学生</label><select class="sel" name="sid">' + act.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '（' + s.no + '）</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>类型</label><select class="sel" name="type">' +
      '<option value="award">表扬 / 加分</option><option value="violation">违纪 / 扣分</option>' +
      '<option value="talk">谈心谈话</option><option value="contest">竞赛获奖</option></select></div>' +
      '<div class="field"><label>积分（可负）</label><input class="inp" name="points" type="number" value="3"></div>' +
      '</div>' +
      '<div class="form-row three mt12">' +
      '<div class="field"><label>事项</label><input class="inp" name="title" placeholder="如：主动帮助同学" required></div>' +
      '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div>' +
      '<div class="field"><label>备注</label><input class="inp" name="note" placeholder="可选"></div>' +
      '</div>' +
      '<div class="mt12 right"><button class="btn primary" type="submit">保存记录</button></div></form>' +
      '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>积分榜</h3><span class="sub">前 10 名</span></div><div class="card-body">';
    rank.slice(0, 10).forEach(function (r, i) {
      h += '<div class="rank-row"><div class="rank-no ' + (i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '') + '">' + (i + 1) + '</div>' +
        '<div class="rank-name">' + esc(r.name) + '</div><div class="rank-val">' + r.pts + '</div></div>';
    });
    h += '</div></div></div>';

    h += '<div class="grid g3">';
    h += '<div class="card"><div class="card-head"><h3>红花榜</h3><span class="sub">表扬次数</span></div><div class="card-body">';
    flowers.filter(function (f) { return f.n > 0; }).slice(0, 6).forEach(function (f, i) {
      h += '<div class="rank-row"><div class="rank-no">' + (i + 1) + '</div><div class="rank-name">' + esc(f.name) + '</div>' +
        '<span class="flower">' + '🌸'.repeat(Math.min(f.n, 6)) + '</span></div>';
    });
    if (!flowers.filter(function (f) { return f.n > 0; }).length) h += '<div class="empty" style="padding:16px">暂无表扬记录</div>';
    h += '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>阈值预警</h3><span class="sub">低于 ' + S.settings.pointThreshold + ' 分</span></div><div class="card-body">';
    if (!warn.length) h += '<div class="note ok"><span>暂无预警学生</span></div>';
    warn.slice(0, 6).forEach(function (s) {
      h += '<div class="rank-row"><div class="rank-name">' + esc(s.name) + '</div><span class="bdg red">' + pointsOf(s.id) + '</span>' +
        '<button class="btn xs ghost" data-act="studentProfile" data-id="' + s.id + '">查看</button></div>';
    });
    h += '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>积分分布</h3></div><div class="card-body">' +
      Charts.bar(rank.slice(0, 8).map(function (r) { return { label: r.name.slice(-2), value: Math.abs(r.pts), color: r.pts >= 0 ? '#0f9d76' : '#e5484d' }; }), { height: 150 }) +
      '</div></div>';
    h += '</div>';

    /* 记录列表 */
    var rec = S.discipline.slice().sort(byDateDesc);
    if (ui.pointFilter !== 'all') rec = rec.filter(function (x) { return x.type === ui.pointFilter; });
    var typeName = { award: '表扬', violation: '违纪', talk: '谈心', contest: '竞赛' };
    h += '<div class="sec-head"><h2>记录明细</h2><div class="line"></div><div class="right">' +
      ['all', 'award', 'violation', 'talk', 'contest'].map(function (t) {
        return '<button class="btn sm ' + (ui.pointFilter === t ? 'primary' : 'ghost') + '" data-act="pointFilter" data-t="' + t + '">' + (t === 'all' ? '全部' : typeName[t]) + '</button>';
      }).join('') + '</div></div>';

    h += '<div class="card"><div class="tbl-wrap" style="max-height:420px"><table class="tbl"><thead><tr>' +
      '<th>日期</th><th>学生</th><th>类型</th><th>事项</th><th class="num">积分</th><th>备注</th><th></th></tr></thead><tbody>';
    if (!rec.length) h += '<tr><td colspan="7"><div class="empty">暂无记录</div></td></tr>';
    rec.slice(0, 60).forEach(function (x) {
      var cls = x.type === 'violation' ? 'red' : x.type === 'talk' ? 'gray' : x.type === 'contest' ? 'violet' : 'green';
      h += '<tr><td class="mono small">' + U.fmtCn(x.date) + '</td>' +
        '<td>' + esc(stu(x.sid).name) + '</td>' +
        '<td><span class="bdg ' + cls + '">' + typeName[x.type] + '</span></td>' +
        '<td>' + esc(x.title) + '</td>' +
        '<td class="num" style="color:' + (x.points > 0 ? '#0f9d76' : x.points < 0 ? '#e5484d' : '#8a94a6') + ';font-weight:650">' + (x.points > 0 ? '+' : '') + (x.points || 0) + '</td>' +
        '<td class="small muted">' + esc(x.note || '') + '</td>' +
        '<td class="right"><button class="btn xs ghost danger" data-act="delDiscipline" data-id="' + x.id + '">删</button></td></tr>';
    });
    h += '</tbody></table></div></div>';
    return h;
  }

  /* ================= 视图：班费 ================= */
  function vFees() {
    var income = sum(S.fees.filter(function (f) { return f.type === 'income'; }).map(function (f) { return +f.amount; }));
    var expense = sum(S.fees.filter(function (f) { return f.type === 'expense'; }).map(function (f) { return +f.amount; }));
    var bal = income - expense;
    var members = S.feeMembers || [];
    var unpaid = members.filter(function (m) { return !m.paid; });

    var h = '<div class="grid g4 mb16">' +
      stat('当前余额', '¥' + bal, '累计收入 ¥' + income) +
      stat('累计支出', '¥' + expense, '共 ' + S.fees.filter(function (f) { return f.type === 'expense'; }).length + ' 笔') +
      stat('已缴费', (members.length - unpaid.length) + '<small>/' + members.length + '</small>', '缴费率 ' + pct(members.length - unpaid.length, members.length) + '%') +
      stat('未缴费', unpaid.length + '<small>人</small>', '按 ¥' + (members[0] ? members[0].amount : 100) + '/人收取') +
      '</div>';

    h += '<div class="grid g-2-1">';
    h += '<div class="card"><div class="card-head"><h3>收支流水</h3><div class="right"><button class="btn sm primary" data-act="addFee">＋ 记一笔</button></div></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>日期</th><th>项目</th><th>类型</th><th class="num">金额</th><th></th></tr></thead><tbody>';
    S.fees.slice().sort(byDateDesc).forEach(function (f) {
      h += '<tr><td class="mono small">' + U.fmtCn(f.date) + '</td><td>' + esc(f.item) +
        (f.note ? '<div class="small muted">' + esc(f.note) + '</div>' : '') + '</td>' +
        '<td><span class="bdg ' + (f.type === 'income' ? 'green' : 'amber') + '">' + (f.type === 'income' ? '收入' : '支出') + '</span></td>' +
        '<td class="num" style="font-weight:650;color:' + (f.type === 'income' ? '#0f9d76' : '#131a26') + '">' + (f.type === 'income' ? '+' : '-') + '¥' + f.amount + '</td>' +
        '<td class="right"><button class="btn xs ghost danger" data-act="delFee" data-id="' + f.id + '">删</button></td></tr>';
    });
    h += '</tbody></table></div></div>';

    h += '<div class="card"><div class="card-head"><h3>缴费状态</h3><span class="sub">点击切换</span></div><div class="card-body">' +
      '<div class="chips">' + members.map(function (m) {
        return '<span class="chip' + (m.paid ? ' on' : '') + '" data-act="togglePaid" data-sid="' + m.sid + '" style="cursor:pointer">' +
          esc(stu(m.sid).name) + (m.paid ? ' ✓' : ' ✕') + '</span>';
      }).join('') + '</div></div></div>';
    h += '</div>';
    return h;
  }

  /* ================= 视图：成绩 ================= */
  function vScores() {
    var e = curExam();
    var h = '<div class="toolbar">' +
      '<select class="sel" id="examSel" style="max-width:220px">' + S.exams.map(function (x) {
        return '<option value="' + x.id + '"' + (e && x.id === e.id ? ' selected' : '') + '>' + esc(x.name) + '（' + U.fmtCn(x.date) + '）</option>';
      }).join('') + '</select>' +
      '<button class="btn" data-act="newExam">＋ 新建考试</button>' +
      '<div class="spacer"></div>' +
      ['entry', 'stats', 'trend', 'warn'].map(function (t) {
        var lbl = { entry: '成绩录入', stats: '统计排名', trend: '趋势分析', warn: '学业预警' }[t];
        return '<button class="btn sm ' + (ui.scoreTab === t ? 'primary' : 'ghost') + '" data-act="scoreTab" data-t="' + t + '">' + lbl + '</button>';
      }).join('') +
      '</div>';

    if (!S.exams.length) return h + '<div class="card"><div class="empty"><span class="em">📊</span>还没有考试数据，先新建一场考试</div></div>';
    if (!e) e = S.exams[S.exams.length - 1];

    if (ui.scoreTab === 'entry') h += scoreEntry(e);
    else if (ui.scoreTab === 'stats') h += scoreStats(e);
    else if (ui.scoreTab === 'trend') h += scoreTrend(e);
    else h += scoreWarn(e);
    return h;
  }

  function scoreEntry(e) {
    var act = activeStudents();
    var h = '<div class="card"><div class="card-head"><h3>成绩录入</h3><span class="sub">' + esc(e.name) + ' · 满分 ' + (e.full || 100) + ' · 失焦自动保存</span>' +
      '<div class="right"><button class="btn sm ghost" data-act="exportScores">导出成绩表</button></div></div>' +
      '<div class="tbl-wrap" style="max-height:calc(100vh - 280px)"><table class="tbl compact"><thead><tr><th>学号</th><th>姓名</th>' +
      e.subjects.map(function (s) { return '<th class="num">' + esc(s) + '</th>'; }).join('') +
      '<th class="num">总分</th><th class="num">排名</th></tr></thead><tbody>';
    var ranking = examRanking(e.id);
    act.forEach(function (s) {
      var t = totalOf(e.id, s.id);
      var rk = ranking.find(function (x) { return x.sid === s.id; });
      h += '<tr><td class="mono muted">' + esc(s.no) + '</td><td style="font-weight:600">' + esc(s.name) + '</td>';
      e.subjects.forEach(function (sub) {
        var v = scoreOf(e.id, s.id, sub);
        h += '<td class="num"><input class="inp" data-score="' + s.id + '|' + sub + '" value="' + (v === null ? '' : v) + '" ' +
          'style="width:60px;padding:4px 5px;text-align:center;border-color:' + (v !== null && v < 60 ? '#f3c9c9' : '#e6e9f0') + '" inputmode="numeric"></td>';
      });
      h += '<td class="num" style="font-weight:650">' + (t === null ? '—' : t) + '</td>' +
        '<td class="num">' + (rk ? rk.rank : '—') + '</td></tr>';
    });
    h += '</tbody></table></div></div>';
    return h;
  }

  function scoreStats(e) {
    var stats = e.subjects.map(function (sub) { return subjectStats(e.id, sub); }).filter(Boolean);
    var ranking = examRanking(e.id);
    var n = ranking.length;
    var tiers = [
      { name: 'A 层（培优）', list: ranking.slice(0, Math.max(1, Math.round(n * 0.3))), cls: 'green' },
      { name: 'B 层（稳步）', list: ranking.slice(Math.round(n * 0.3), Math.round(n * 0.7)), cls: 'blue' },
      { name: 'C 层（辅差）', list: ranking.slice(Math.round(n * 0.7)), cls: 'amber' }
    ];
    var h = '<div class="card mb16"><div class="card-head"><h3>学科统计</h3><span class="sub">' + esc(e.name) + ' · ' + n + ' 人参考</span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>学科</th><th class="num">平均分</th><th class="num">最高</th><th class="num">最低</th><th>及格率</th><th>优秀率</th></tr></thead><tbody>';
    stats.forEach(function (s) {
      h += '<tr><td style="font-weight:600">' + esc(s.sub) + '</td>' +
        '<td class="num">' + s.avg + '</td><td class="num">' + s.max + '</td><td class="num">' + s.min + '</td>' +
        '<td><div class="bar-row"><div class="bar green"><i style="width:' + s.pass + '%"></i></div><span>' + s.pass + '%</span></div></td>' +
        '<td><div class="bar-row"><div class="bar"><i style="width:' + s.excellent + '%"></i></div><span>' + s.excellent + '%</span></div></td></tr>';
    });
    h += '</tbody></table></div></div>';

    h += '<div class="grid g2">';
    h += '<div class="card"><div class="card-head"><h3>总分排名</h3><span class="sub">前 15 名</span></div><div class="tbl-wrap" style="max-height:420px"><table class="tbl compact"><thead><tr><th>名次</th><th>姓名</th><th class="num">总分</th><th class="num">均分</th></tr></thead><tbody>';
    ranking.slice(0, 15).forEach(function (r) {
      h += '<tr><td class="num" style="font-weight:700;color:' + (r.rank <= 3 ? '#d4a017' : '#8a94a6') + '">' + r.rank + '</td>' +
        '<td>' + esc(r.name) + '</td><td class="num" style="font-weight:650">' + r.total + '</td>' +
        '<td class="num muted">' + (r.total / e.subjects.length).toFixed(1) + '</td></tr>';
    });
    h += '</tbody></table></div></div>';

    h += '<div class="card"><div class="card-head"><h3>分层建议</h3><span class="sub">按总分前 30% / 40% / 30%</span></div><div class="card-body">';
    tiers.forEach(function (t) {
      h += '<div class="mb12"><div class="flex between center mb8"><b style="font-size:13px">' + t.name + '</b>' +
        '<span class="bdg ' + t.cls + '">' + t.list.length + ' 人</span></div><div class="chips">' +
        t.list.map(function (x) { return '<span class="chip">' + esc(x.name) + '</span>'; }).join('') + '</div></div>';
    });
    h += '</div></div></div>';
    return h;
  }

  function scoreTrend(e) {
    var labels = S.exams.map(function (x) { return x.name; });
    var series = e.subjects.slice(0, 4).map(function (sub, i) {
      return {
        name: sub,
        color: Charts.PALETTE[i],
        data: S.exams.map(function (x) {
          var st = subjectStats(x.id, sub);
          return st ? st.avg : null;
        })
      };
    });
    var flat = [];
    series.forEach(function (s) { s.data.forEach(function (v) { if (v !== null && v !== undefined) flat.push(v); }); });
    var yMin2 = Math.max(0, Math.floor(Math.min.apply(null, flat.concat([100])) - 4));
    var h = '<div class="card mb16"><div class="card-head"><h3>班级平均分趋势</h3><span class="sub">各学科历次考试</span></div>' +
      '<div class="card-body">' + Charts.line(labels, series, { height: 230, min: yMin2, max: 100 }) + '</div></div>';

    /* 个人排名变化 */
    var act = activeStudents();
    if (!ui.trendSid && act.length) ui.trendSid = act[0].id;
    var ranks = S.exams.map(function (x) {
      var r = examRanking(x.id).find(function (y) { return y.sid === ui.trendSid; });
      return r ? r.rank : null;
    });
    h += '<div class="grid g-2-1"><div class="card"><div class="card-head"><h3>个人排名变化</h3>' +
      '<div class="right"><select class="sel" id="trendSel" style="width:150px">' + act.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === ui.trendSid ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('') + '</select></div></div>' +
      '<div class="card-body">' + Charts.line(labels, [{ name: '班级排名（数字越小越好）', data: ranks, color: '#8b5cf6' }], { height: 180, reversed: true, area: false }) + '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>进退步榜</h3><span class="sub">对比最近两次考试</span></div><div class="card-body">';
    if (S.exams.length >= 2) {
      var prev = S.exams[S.exams.length - 2], cur = S.exams[S.exams.length - 1];
      var pr = examRanking(prev.id), cr = examRanking(cur.id);
      var delta = cr.map(function (r) {
        var p = pr.find(function (x) { return x.sid === r.sid; });
        return { name: r.name, d: p ? p.rank - r.rank : 0, sid: r.sid };
      }).filter(function (x) { return x.d !== 0; }).sort(function (a, b) { return b.d - a.d; });
      h += '<div class="small muted mb8">进步最大</div>';
      delta.slice(0, 4).forEach(function (x) {
        h += '<div class="rank-row"><div class="rank-name">' + esc(x.name) + '</div><span class="bdg green">↑ ' + x.d + ' 名</span></div>';
      });
      h += '<div class="small muted mt12 mb8">退步提醒</div>';
      delta.slice(-4).reverse().forEach(function (x) {
        h += '<div class="rank-row"><div class="rank-name">' + esc(x.name) + '</div><span class="bdg red">↓ ' + Math.abs(x.d) + ' 名</span></div>';
      });
    } else {
      h += '<div class="empty" style="padding:16px">至少需要两次考试才能对比</div>';
    }
    h += '</div></div></div>';
    return h;
  }

  function scoreWarn(e) {
    var act = activeStudents();
    var list = act.map(function (s) { return { s: s, fails: failCount(e.id, s.id), total: totalOf(e.id, s.id) }; })
      .filter(function (x) { return x.fails >= 2; })
      .sort(function (a, b) { return b.fails - a.fails; });

    var h = '<div class="grid g2">';
    h += '<div class="card"><div class="card-head"><h3>学业预警</h3><span class="sub">不及格科目 ≥ 2 门</span></div><div class="card-body">';
    if (!list.length) h += '<div class="note ok"><span>本次考试无多科不及格学生</span></div>';
    list.forEach(function (x) {
      h += '<div class="rank-row"><div class="rank-name">' + esc(x.s.name) + '</div>' +
        '<span class="bdg red">' + x.fails + ' 门不及格</span>' +
        '<span class="small muted">总分 ' + (x.total === null ? '—' : x.total) + '</span>' +
        '<button class="btn xs ghost" data-act="studentProfile" data-id="' + x.s.id + '">查看</button></div>';
    });
    h += '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>单科末位名单</h3><span class="sub">各科后 5 名</span></div><div class="card-body">';
    e.subjects.forEach(function (sub) {
      var vals = act.map(function (s) { return { name: s.name, v: scoreOf(e.id, s.id, sub) }; })
        .filter(function (x) { return x.v !== null; }).sort(function (a, b) { return a.v - b.v; }).slice(0, 5);
      h += '<div class="mb12"><div class="small" style="font-weight:600;margin-bottom:4px">' + esc(sub) + '</div><div class="chips">' +
        vals.map(function (x) { return '<span class="chip">' + esc(x.name) + ' <b style="color:#e5484d">' + x.v + '</b></span>'; }).join('') + '</div></div>';
    });
    h += '</div></div></div>';
    return h;
  }

  /* ================= 视图：课表与作业 ================= */
  function vTeach() {
    var days = ['周一', '周二', '周三', '周四', '周五'];
    var periods = S.periods || ['第1节', '第2节', '第3节', '第4节', '第5节', '第6节', '第7节'];
    var todayWd = new Date().getDay();

    var h = '<div class="card mb16"><div class="card-head"><h3>周课表</h3><span class="sub">点击单元格直接修改，自动保存</span></div>' +
      '<div class="card-body"><div class="tt-wrap"><table class="tt"><thead><tr><th style="width:92px">节次</th>' +
      days.map(function (d, i) { return '<th' + (todayWd === i + 1 ? ' style="color:#2563eb"' : '') + '>' + d + '</th>'; }).join('') +
      '</tr></thead><tbody>';
    for (var p = 0; p < periods.length; p++) {
      h += '<tr><td class="tt-time">' + esc(periods[p]) + '</td>';
      for (var d2 = 0; d2 < 5; d2++) {
        var val = (S.timetable[d2] || [])[p] || '';
        h += '<td class="' + (todayWd === d2 + 1 ? 'today' : '') + '"><input class="cell-in" data-tt="' + d2 + '|' + p + '" value="' + esc(val) + '"></td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table></div></div></div>';

    /* 作业 */
    h += '<div class="grid g-2-1"><div class="card"><div class="card-head"><h3>作业跟进</h3>' +
      '<div class="right"><button class="btn sm primary" data-act="addHomework">＋ 布置作业</button></div></div><div class="card-body">';
    if (!S.homework.length) h += '<div class="empty">暂无作业记录</div>';
    S.homework.slice().sort(byDateDesc).forEach(function (hw) {
      var total = activeStudents().length || 1;
      var rate = pct(hw.submitted.length, total);
      var graded = pct(hw.graded.length, hw.submitted.length || 1);
      h += '<div style="padding:11px 0;border-bottom:1px solid #f1f3f8">' +
        '<div class="flex between center mb8"><div><span class="bdg blue">' + esc(hw.sub) + '</span> ' +
        '<b style="font-size:13px;margin-left:4px">' + esc(hw.title) + '</b></div>' +
        '<span class="small muted">' + U.fmtCn(hw.date) + '</span></div>' +
        '<div class="bar-row mb8"><span style="min-width:52px;text-align:left">提交</span><div class="bar green"><i style="width:' + rate + '%"></i></div><span>' + hw.submitted.length + '/' + total + '</span></div>' +
        '<div class="bar-row"><span style="min-width:52px;text-align:left">批改</span><div class="bar amber"><i style="width:' + graded + '%"></i></div><span>' + hw.graded.length + '/' + (hw.submitted.length || 0) + '</span></div>' +
        (hw.graded.length < hw.submitted.length ? '<div class="right mt8"><button class="btn xs ghost" data-act="markGraded" data-id="' + hw.id + '">标记全部批改</button></div>' : '') +
        '</div>';
    });
    h += '</div></div>';

    h += '<div class="card"><div class="card-head"><h3>班会模板库</h3><span class="sub">点击查看并写入留痕</span></div><div class="card-body">';
    S.templates.meetings.forEach(function (t) {
      h += '<div class="list-item" style="padding:10px 0"><div class="li-ico blue">▣</div>' +
        '<div class="li-main"><div class="li-title">' + esc(t.title) + '</div>' +
        '<div class="li-meta">' + esc(t.body.split('\n')[0]) + '…</div></div>' +
        '<button class="btn xs ghost" data-act="useTemplate" data-id="' + t.id + '">使用</button></div>';
    });
    h += '</div></div></div>';
    return h;
  }

  /* ================= 视图：通知 ================= */
  function vNotices() {
    var act = activeStudents();
    var h = '<div class="toolbar">' +
      '<button class="btn primary" data-act="addNotice">＋ 发布通知</button>' +
      '<div class="spacer"></div><span class="small muted">共 ' + S.notices.length + ' 条 · 学生 ' + act.length + ' 人</span></div>';

    if (!S.notices.length) return h + '<div class="card"><div class="empty"><span class="em">✉️</span>还没有发布过通知</div></div>';

    S.notices.slice().sort(byDateDesc).forEach(function (n) {
      var read = (n.readBy || []).length;
      var rate = pct(read, act.length);
      h += '<div class="card mb16"><div class="card-head"><h3>' + esc(n.title) + '</h3>' +
        '<span class="bdg ' + (rate >= 90 ? 'green' : rate >= 60 ? 'amber' : 'red') + '">已读 ' + rate + '%</span>' +
        '<div class="right"><span class="small muted">' + U.fmtCn(n.date) + ' · ' + esc(n.scope || '全班') + '</span>' +
        '<button class="btn sm ghost" data-act="viewNotice" data-id="' + n.id + '">查看回执</button></div></div>' +
        '<div class="card-body"><p style="font-size:13.2px;color:#475569;line-height:1.7;white-space:pre-wrap">' + esc(n.body) + '</p>' +
        '<div class="bar-row mt12"><div class="bar ' + (rate >= 90 ? 'green' : rate >= 60 ? 'amber' : 'red') + '"><i style="width:' + rate + '%"></i></div>' +
        '<span>' + read + '/' + act.length + '</span></div></div></div>';
    });
    return h;
  }

  /* ================= 视图：家校沟通 ================= */
  function vComms() {
    var act = activeStudents();
    var h = '<div class="grid g-2-1">';
    h += '<div class="card"><div class="card-head"><h3>新增沟通记录</h3><span class="sub">通话 · 面谈 · 会议</span></div><div class="card-body">' +
      '<form data-form="comm"><div class="form-row three">' +
      '<div class="field"><label>学生</label><select class="sel" name="sid">' + act.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>方式</label><select class="sel" name="type"><option>通话</option><option>面谈</option><option>会议</option><option>微信</option></select></div>' +
      '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div>' +
      '</div>' +
      '<div class="field mt12"><label>沟通要点</label><textarea class="ta" name="summary" placeholder="记录沟通内容、家长反馈、达成的一致意见" required></textarea></div>' +
      '<div class="field mt12"><label>后续跟进</label><input class="inp" name="next" placeholder="如：一周后回访"></div>' +
      '<div class="mt12 right"><button class="btn primary" type="submit">保存记录</button></div></form></div></div>';

    h += '<div class="card"><div class="card-head"><h3>沟通统计</h3></div><div class="card-body">';
    var byType = {};
    S.comms.forEach(function (c) { byType[c.type] = (byType[c.type] || 0) + 1; });
    Object.keys(byType).forEach(function (k) {
      h += '<div class="bar-row mb8"><span style="min-width:44px;text-align:left">' + k + '</span>' +
        '<div class="bar"><i style="width:' + pct(byType[k], S.comms.length) + '%"></i></div><span>' + byType[k] + '</span></div>';
    });
    h += '<div class="note mt12"><span>本月已沟通 <b>' + S.comms.filter(function (c) { return String(c.date).slice(0, 7) === todayStr().slice(0, 7); }).length + '</b> 次</span></div>';
    h += '</div></div></div>';

    h += '<div class="sec-head"><h2>沟通记录</h2><div class="line"></div></div>';
    h += '<div class="card"><div class="card-body"><div class="timeline">';
    if (!S.comms.length) h += '<div class="empty">暂无记录</div>';
    S.comms.slice().sort(byDateDesc).forEach(function (c) {
      h += '<div class="tl-item"><div class="tl-date">' + U.fmtCn(c.date) + ' · ' + U.weekdayCn(c.date) + '</div>' +
        '<div class="tl-title">' + esc(stu(c.sid).name) + ' · ' + esc(c.type) + '</div>' +
        '<div class="tl-body">' + esc(c.summary) + (c.next ? '<br><span class="muted">后续：' + esc(c.next) + '</span>' : '') + '</div>' +
        '<div class="mt8"><button class="btn xs ghost danger" data-act="delComm" data-id="' + c.id + '">删除</button></div></div>';
    });
    h += '</div></div></div>';
    return h;
  }

  /* ================= 视图：工作留痕 ================= */
  function vRecords() {
    var cats = ['all', '班会', '安全教育', '家访', '谈心', '其他'];
    var h = '<div class="toolbar">' +
      '<button class="btn primary" data-act="addRecord">＋ 新增记录</button>' +
      '<button class="btn" data-act="exportRecords">导出 CSV</button>' +
      '<button class="btn" data-act="printView">打印归档</button>' +
      '<div class="spacer"></div>' +
      cats.map(function (c) {
        return '<button class="btn sm ' + (ui.recFilter === c ? 'primary' : 'ghost') + '" data-act="recFilter" data-c="' + c + '">' + (c === 'all' ? '全部' : c) + '</button>';
      }).join('') + '</div>';

    var list = S.records.slice();
    if (ui.recFilter !== 'all') list = list.filter(function (r) { return r.category === ui.recFilter; });
    list.sort(byDateDesc);

    h += '<div class="print-title">' + esc(S.settings.className) + ' 工作留痕（' + U.dstr() + '）</div>';
    if (!list.length) return h + '<div class="card"><div class="empty"><span class="em">📁</span>暂无记录</div></div>';
    h += '<div class="grid g2">';
    list.forEach(function (r) {
      h += '<div class="card"><div class="card-head"><h3>' + esc(r.title) + '</h3>' +
        '<span class="bdg ' + (r.category === '安全教育' ? 'red' : r.category === '家访' ? 'amber' : 'blue') + '">' + esc(r.category) + '</span>' +
        '<div class="right"><span class="small muted">' + U.fmtCn(r.date) + '</span></div></div>' +
        '<div class="card-body"><p style="font-size:13px;color:#475569;line-height:1.7;white-space:pre-wrap">' + esc(r.body) + '</p>' +
        '<div class="flex between center mt12"><span class="small muted">记录人：' + esc(r.by || '班主任') + '</span>' +
        '<button class="btn xs ghost danger no-print" data-act="delRecord" data-id="' + r.id + '">删除</button></div></div></div>';
    });
    h += '</div>';
    return h;
  }

  /* ================= 视图：数据备份 ================= */
  function vBackup() {
    var tables = [
      ['学生', S.students.length], ['考勤记录', S.attendance.length], ['奖惩积分', S.discipline.length],
      ['考试', S.exams.length], ['成绩明细', S.scores.length], ['待办', S.tasks.length],
      ['班费流水', S.fees.length], ['通知', S.notices.length], ['家校沟通', S.comms.length],
      ['工作留痕', S.records.length], ['作业', S.homework.length]
    ];
    var kb = (Store.size() / 1024).toFixed(1);
    var h = '<div class="grid g-2-1">';
    h += '<div class="card"><div class="card-head"><h3>数据概览</h3><span class="sub">存储占用 ' + kb + ' KB / 约 5 MB</span></div>' +
      '<div class="tbl-wrap"><table class="tbl compact"><tbody>' +
      tables.map(function (t) { return '<tr><td>' + t[0] + '</td><td class="num" style="font-weight:600">' + t[1] + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';

    h += '<div class="card"><div class="card-head"><h3>备份与恢复</h3></div><div class="card-body">' +
      '<div class="note mb12"><span>所有数据只保存在这台设备的浏览器里，不会上传到任何服务器。换电脑或换手机时，请导出 JSON 文件再导入。</span></div>' +
      '<button class="btn primary w100 mb8" data-act="exportJSON">导出全部数据（JSON）</button>' +
      '<button class="btn w100 mb8" data-act="importJSON">从文件导入（JSON）</button>' +
      '<input type="file" id="fileInput" accept=".json,application/json" class="hide">' +
      '<button class="btn w100 mb8" data-act="printView">打印当前页面</button>' +
      '<hr style="border:0;border-top:1px solid #f1f3f8;margin:14px 0">' +
      '<button class="btn w100 mb8" data-act="resetDemo">恢复演示数据</button>' +
      '<button class="btn danger w100" data-act="clearAll">清空全部数据（从零开始）</button>' +
      '</div></div></div>';

    h += '<div class="card mt16"><div class="card-head"><h3>班级设置</h3></div><div class="card-body">' +
      '<form data-form="settings"><div class="form-row">' +
      '<div class="field"><label>班级名称</label><input class="inp" name="className" value="' + esc(S.settings.className) + '"></div>' +
      '<div class="field"><label>班主任</label><input class="inp" name="teacher" value="' + esc(S.settings.teacher) + '"></div>' +
      '</div><div class="form-row mt12">' +
      '<div class="field"><label>学期</label><input class="inp" name="term" value="' + esc(S.settings.term) + '"></div>' +
      '<div class="field"><label>学校</label><input class="inp" name="school" value="' + esc(S.settings.school || '') + '"></div>' +
      '</div><div class="form-row three mt12">' +
      '<div class="field"><label>重要考试名称</label><input class="inp" name="examTargetName" value="' + esc(S.settings.examTargetName || '') + '"></div>' +
      '<div class="field"><label>考试日期</label><input class="inp" type="date" name="examTarget" value="' + esc(S.settings.examTarget || '') + '"></div>' +
      '<div class="field"><label>积分预警阈值</label><input class="inp" type="number" name="pointThreshold" value="' + S.settings.pointThreshold + '"></div>' +
      '</div><div class="mt12 right"><button class="btn primary" type="submit">保存设置</button></div></form>' +
      '</div></div>';
    return h;
  }

  /* ================= 视图索引 ================= */
  var VIEWS = {
    dashboard: vDashboard, students: vStudents, seats: vSeats, groups: vGroups,
    attendance: vAttendance, points: vPoints, fees: vFees, scores: vScores,
    teach: vTeach, notices: vNotices, comms: vComms, records: vRecords, backup: vBackup
  };

  var AFTER = {
    students: function () {
      var el = $('#stuSearch');
      if (!el) return;
      el.addEventListener('input', function () {
        ui.query = this.value.trim();
        var body = $('#stuBody');
        if (body) body.innerHTML = studentRows();
      });
    },
    scores: function () {
      var sel = $('#examSel');
      if (sel) sel.addEventListener('change', function () { ui.examId = this.value; render(); });
      var ts = $('#trendSel');
      if (ts) ts.addEventListener('change', function () { ui.trendSid = this.value; render(); });
    },
    attendance: function () {
      var d = $('#attDate');
      if (d) d.addEventListener('change', function () { ui.attDate = this.value; render(); });
    },
    backup: function () {
      var f = $('#fileInput');
      if (f) f.addEventListener('change', function () { doImportFile(this); });
    }
  };

  /* ================= 事件：点击 ================= */
  var ACT = {};

  ACT.toggleNav = function () {
    $('.sidebar').classList.toggle('open');
    $('#navMask').classList.toggle('show');
  };
  ACT.go = function (ds) {
    view = ds.view; render();
    $('.sidebar').classList.remove('open');
    $('#navMask').classList.remove('show');
  };
  ACT.closeModal = closeModal;

  ACT.toggleTask = function (ds) {
    var t = S.tasks.find(function (x) { return x.id === ds.id; });
    if (t) {
      t.done = !t.done;
      save(true);
      toast(t.done ? '已完成：' + t.title : '已恢复为待办', 'ok');
    }
  };
  ACT.addTask = function () {
    openModal({
      title: '添加待办',
      body: '<form data-form="task"><div class="field"><label>事项</label><input class="inp" name="title" required placeholder="如：收齐家长回执"></div>' +
        '<div class="form-row three mt12"><div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div>' +
        '<div class="field"><label>类型</label><select class="sel" name="type"><option>常规</option><option>班会</option><option>家访</option><option>安全</option></select></div>' +
        '<div class="field"><label>&nbsp;</label><button class="btn primary w100" type="submit">添加</button></div></div></form>'
    });
  };

  ACT.quickAdd = function () {
    openModal({
      title: '快速登记', cls: 'narrow',
      body: '<div style="display:grid;gap:9px">' +
        '<button class="btn w100" data-act="quick" data-t="attendance">登记考勤</button>' +
        '<button class="btn w100" data-act="quick" data-t="discipline">记奖惩 / 积分</button>' +
        '<button class="btn w100" data-act="quick" data-t="comm">家校沟通</button>' +
        '<button class="btn w100" data-act="quick" data-t="record">工作留痕</button>' +
        '<button class="btn w100" data-act="quick" data-t="task">添加待办</button></div>'
    });
  };
  ACT.quick = function (ds) {
    closeModal();
    if (ds.t === 'attendance') { view = 'attendance'; ui.attDate = todayStr(); render(); }
    else if (ds.t === 'discipline') { view = 'points'; render(); }
    else if (ds.t === 'comm') { view = 'comms'; render(); }
    else if (ds.t === 'record') { view = 'records'; render(); setTimeout(function () { ACT.addRecord(); }, 60); }
    else if (ds.t === 'task') { ACT.addTask(); }
  };

  /* ----- 学生 ----- */
  ACT.addStudent = function () {
    openModal({
      title: '新增学生', body: studentForm(),
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="student">保存</button>'
    });
  };
  ACT.editStudent = function (ds) {
    var s = stu(ds.id);
    openModal({
      title: '编辑学生 · ' + s.name, body: studentForm(s),
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="student">保存</button>'
    });
  };
  ACT.submitForm = function (ds) {
    var form = document.querySelector('[data-form="' + ds.form + '"]');
    if (form) { if (form.reportValidity()) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }
  };
  ACT.delStudent = function (ds) {
    var s = stu(ds.id);
    confirmBox('删除学生', '确定删除 <b>' + esc(s.name) + '</b> 吗？该学生的考勤、积分、成绩记录也会一并移除，且无法恢复。', function () {
      ['students', 'attendance', 'discipline', 'comms'].forEach(function (t) {
        S[t] = S[t].filter(function (x) { return (x.id !== ds.id && x.sid !== ds.id); });
      });
      S.scores = S.scores.filter(function (x) { return x.sid !== ds.id; });
      S.feeMembers = (S.feeMembers || []).filter(function (x) { return x.sid !== ds.id; });
      save(true); render(); toast('已删除', 'ok');
    });
  };
  ACT.studentProfile = function (ds) {
    var s = stu(ds.id);
    var dsList = S.discipline.filter(function (d) { return d.sid === ds.id; }).sort(byDateDesc);
    var ats = S.attendance.filter(function (a) { return a.sid === ds.id; }).sort(byDateDesc).slice(0, 6);
    var ranks = S.exams.map(function (e) {
      var r = examRanking(e.id).find(function (x) { return x.sid === ds.id; });
      return '<div class="bar-row" style="margin-bottom:5px"><span style="min-width:76px;text-align:left;font-size:12px">' + esc(e.name) + '</span>' +
        '<span class="bdg ' + (r && r.rank <= 10 ? 'green' : 'line') + '" style="margin-left:auto">' + (r ? '第 ' + r.rank + ' 名 / ' + r.total + ' 分' : '未录入') + '</span></div>';
    }).join('');
    var body = '<div class="flex gap12 center mb16">' +
      '<div class="' + avatarCls(s.group) + '" style="width:44px;height:44px;border-radius:12px;font-size:16px;flex:0 0 44px">' + esc(s.name.slice(0, 1)) + '</div>' +
      '<div><div style="font-size:16px;font-weight:700">' + esc(s.name) + '</div>' +
      '<div class="small muted">' + esc(s.no) + ' · ' + esc(s.gender) + ' · 第' + s.group + '组 · ' + esc(s.dorm || '') + '</div></div>' +
      '<div style="margin-left:auto" class="right"><div class="bdg ' + (pointsOf(s.id) >= 0 ? 'green' : 'red') + '">积分 ' + pointsOf(s.id) + '</div>' +
      '<div class="small muted mt8">🌸 ' + awardCount(s.id) + ' 朵</div></div></div>' +
      '<div class="note mb12"><span>家长：<b>' + esc(s.parent || '—') + '</b> · ' + esc(s.parentPhone || '') + '<br>学生电话：' + esc(s.phone || '—') + '</span></div>' +
      '<div class="small muted mb8">历次排名</div>' + ranks +
      '<div class="small muted mt16 mb8">最近考勤</div>' +
      (ats.length ? ats.map(function (a) {
        var nm = { leave: '请假', absent: '缺勤', late: '迟到', early: '早退' }[a.type];
        return '<div class="small" style="padding:3px 0">' + U.fmtCn(a.date) + ' · <b>' + nm + '</b> · ' + esc(a.reason || '') + '</div>';
      }).join('') : '<div class="small muted">无</div>') +
      '<div class="small muted mt16 mb8">成长记录（' + dsList.length + ' 条）</div>' +
      (dsList.length ? dsList.slice(0, 10).map(function (d) {
        return '<div class="small" style="padding:4px 0;border-bottom:1px dashed #f1f3f8">' +
          U.fmtCn(d.date) + ' · <b>' + esc(d.title) + '</b>' +
          (d.points ? ' <span style="color:' + (d.points > 0 ? '#0f9d76' : '#e5484d') + '">' + (d.points > 0 ? '+' : '') + d.points + '</span>' : '') +
          (d.note ? '<div class="muted">' + esc(d.note) + '</div>' : '') + '</div>';
      }).join('') : '<div class="small muted">暂无</div>');

    openModal({
      title: '学生档案', cls: 'wide', body: body,
      footer: '<button class="btn" data-act="closeModal">关闭</button>' +
        '<button class="btn primary" data-act="editStudent" data-id="' + ds.id + '">编辑资料</button>'
    });
  };
  ACT.importStudents = function () {
    openModal({
      title: '从 Excel 导入学生', cls: 'wide',
      body: '<div class="note mb12"><span>在 Excel 中选中含表头的区域复制（Ctrl+C），粘贴到下面即可。支持列：<b>姓名、学号、性别、分组、家长、电话</b>，顺序不限，必须有「姓名」列。</span></div>' +
        '<textarea class="ta" id="importTa" style="min-height:180px;font-family:var(--mono);font-size:12.5px" placeholder="姓名\t学号\t性别\t分组\t家长\t电话&#10;张三\t01\t男\t1\t张先生\t13800000000"></textarea>' +
        '<div class="field mt12"><label><input type="checkbox" id="importReplace"> 导入前清空现有学生名单</label></div>',
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="doImport">开始导入</button>'
    });
  };
  ACT.doImport = function () {
    var ta = $('#importTa');
    var text = (ta && ta.value || '').trim();
    if (!text) return toast('还没有粘贴内容', 'err');
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var delim = text.indexOf('\t') > -1 ? '\t' : ',';
    var head = lines[0].split(delim).map(function (h) { return h.trim(); });
    var map = {};
    head.forEach(function (h, i) {
      if (/姓名|名字/.test(h)) map.name = i;
      else if (/学号|编号/.test(h)) map.no = i;
      else if (/性别/.test(h)) map.gender = i;
      else if (/组/.test(h)) map.group = i;
      else if (/家长|父母/.test(h)) map.parent = i;
      else if (/电话|手机/.test(h)) map.phone = i;
    });
    var hasHeader = map.name !== undefined;
    var rows = hasHeader ? lines.slice(1) : lines;
    if (!hasHeader) map = { name: 0, no: 1, gender: 2, group: 3, parent: 4, phone: 5 };

    if ($('#importReplace') && $('#importReplace').checked) {
      S.students = []; S.attendance = []; S.discipline = []; S.scores = []; S.feeMembers = [];
    }
    var added = 0;
    rows.forEach(function (line, idx) {
      var cells = line.split(delim).map(function (c) { return c.trim(); });
      var name = cells[map.name];
      if (!name) return;
      var maxNo = S.students.reduce(function (a, s) { return Math.max(a, parseInt(s.no) || 0); }, 0);
      S.students.push({
        id: 's' + Date.now().toString(36) + idx,
        no: (cells[map.no] || String(maxNo + 1)).padStart(2, '0'),
        name: name,
        gender: cells[map.gender] === '女' ? '女' : '男',
        group: parseInt(cells[map.group]) || 1,
        row: undefined, col: undefined,
        dorm: '', phone: cells[map.phone] || '',
        parent: cells[map.parent] || '', parentPhone: '',
        tags: [], archived: false
      });
      added++;
    });
    save(true); closeModal(); view = 'students'; render();
    toast('成功导入 ' + added + ' 名学生', 'ok');
  };
  ACT.exportStudents = function () {
    var head = ['学号', '姓名', '性别', '分组', '座位', '家长', '家长电话', '学生电话', '积分', '红花'];
    var rows = activeStudents().map(function (s) {
      return [s.no, s.name, s.gender, '第' + s.group + '组',
        (s.row !== undefined && s.row !== null) ? (s.row + 1) + '排' + (s.col + 1) + '座' : '',
        s.parent, s.parentPhone, s.phone, pointsOf(s.id), awardCount(s.id)];
    });
    downloadCSV([head].concat(rows), S.settings.className + '-学生名单');
  };

  /* ----- 座位 ----- */
  ACT.seatPick = function (ds, el) {
    if (ds.id) {
      if (ui.pickedSeat === ds.id) { ui.pickedSeat = null; render(); return; }
      if (!ui.pickedSeat) { ui.pickedSeat = ds.id; render(); toast('已选中 ' + stu(ds.id).name + '，再点一个座位互换'); return; }
      var a = S.students.find(function (s) { return s.id === ui.pickedSeat; });
      var b = S.students.find(function (s) { return s.id === ds.id; });
      if (a && b) {
        var tmp = { row: a.row, col: a.col };
        a.row = b.row; a.col = b.col; b.row = tmp.row; b.col = tmp.col;
      }
      ui.pickedSeat = null; save(true); render(); toast('座位已互换', 'ok');
    } else {
      var r = parseInt(ds.rid), c = parseInt(ds.cid);
      if (ui.pickedSeat) {
        var s = S.students.find(function (x) { return x.id === ui.pickedSeat; });
        if (s) { s.row = r; s.col = c; }
        ui.pickedSeat = null; save(true); render(); toast('已移动到空位', 'ok');
      }
    }
  };
  ACT.seatRandom = function () {
    var act = activeStudents();
    var cells = [];
    for (var r = 0; r < (S.settings.seatRows || 6); r++) {
      for (var c = 0; c < (S.settings.seatCols || 7); c++) cells.push([r, c]);
    }
    var pool = cells.slice().sort(function () { return Math.random() - 0.5; });
    act.forEach(function (s, i) {
      if (i < pool.length) { s.row = pool[i][0]; s.col = pool[i][1]; } else { s.row = undefined; s.col = undefined; }
    });
    save(true); render(); toast('已随机排座', 'ok');
  };
  ACT.seatByNo = function () {
    activeStudents().sort(function (a, b) { return (parseInt(a.no) || 0) - (parseInt(b.no) || 0); })
      .forEach(function (s, i) {
        s.row = Math.floor(i / (S.settings.seatCols || 7));
        s.col = i % (S.settings.seatCols || 7);
      });
    save(true); render(); toast('已按学号排列', 'ok');
  };
  ACT.seatClear = function () {
    S.students.forEach(function (s) { s.row = undefined; s.col = undefined; });
    save(true); render(); toast('座位已清空', 'ok');
  };
  ACT.regroup = function () {
    var act = activeStudents().slice().sort(function () { return Math.random() - 0.5; });
    var n = 6;
    act.forEach(function (s, i) { s.group = (i % n) + 1; });
    save(true); render(); toast('已重新分组为 6 组', 'ok');
  };

  /* ----- 考勤 ----- */
  ACT.setAtt = function (ds) {
    var date = ui.attDate || todayStr();
    var rec = S.attendance.find(function (a) { return a.date === date && a.sid === ds.sid; });
    if (ds.type === 'present') {
      if (rec) S.attendance = S.attendance.filter(function (a) { return a !== rec; });
    } else if (rec) {
      rec.type = ds.type;
      if (!rec.reason) rec.reason = '已登记';
    } else {
      S.attendance.push({ id: 'at' + Date.now().toString(36), date: date, sid: ds.sid, type: ds.type, reason: '已登记', noted: false });
    }
    save(true); render();
  };
  ACT.attAllPresent = function () {
    var date = ui.attDate || todayStr();
    S.attendance = S.attendance.filter(function (a) { return a.date !== date; });
    save(true); render(); toast('已标记全班到齐', 'ok');
  };

  /* ----- 奖惩 ----- */
  ACT.delDiscipline = function (ds) {
    confirmBox('删除记录', '确定删除这条积分记录吗？', function () {
      S.discipline = S.discipline.filter(function (x) { return x.id !== ds.id; });
      save(true); render();
    });
  };
  ACT.pointFilter = function (ds) { ui.pointFilter = ds.t; render(); };

  /* ----- 班费 ----- */
  ACT.addFee = function () {
    openModal({
      title: '记一笔班费',
      body: '<form data-form="fee"><div class="form-row"><div class="field"><label>项目</label><input class="inp" name="item" required placeholder="如：购买清洁用品"></div>' +
        '<div class="field"><label>类型</label><select class="sel" name="type"><option value="expense">支出</option><option value="income">收入</option></select></div></div>' +
        '<div class="form-row mt12"><div class="field"><label>金额（元）</label><input class="inp" type="number" name="amount" required value="0"></div>' +
        '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div></div>' +
        '<div class="field mt12"><label>备注</label><input class="inp" name="note"></div></form>',
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="fee">保存</button>'
    });
  };
  ACT.delFee = function (ds) {
    confirmBox('删除流水', '确定删除这条班费记录吗？', function () {
      S.fees = S.fees.filter(function (f) { return f.id !== ds.id; });
      save(true); render();
    });
  };
  ACT.togglePaid = function (ds) {
    var m = (S.feeMembers || []).find(function (x) { return x.sid === ds.sid; });
    if (!m) { S.feeMembers = S.feeMembers || []; m = { sid: ds.sid, paid: true, amount: 100 }; S.feeMembers.push(m); }
    else m.paid = !m.paid;
    save(true); render();
  };

  /* ----- 成绩 ----- */
  ACT.scoreTab = function (ds) { ui.scoreTab = ds.t; render(); };
  ACT.newExam = function () {
    openModal({
      title: '新建考试',
      body: '<form data-form="exam"><div class="form-row"><div class="field"><label>考试名称</label><input class="inp" name="name" required placeholder="如：第三次月考"></div>' +
        '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div></div>' +
        '<div class="form-row mt12"><div class="field"><label>科目（逗号分隔）</label><input class="inp" name="subjects" value="' + U.SUBJECTS.join('，') + '"></div>' +
        '<div class="field"><label>单科满分</label><input class="inp" type="number" name="full" value="100"></div></div></form>',
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="exam">创建</button>'
    });
  };
  ACT.exportScores = function () {
    var e = curExam();
    if (!e) return;
    var head = ['学号', '姓名'].concat(e.subjects).concat(['总分', '排名']);
    var rk = examRanking(e.id);
    var rows = activeStudents().map(function (s) {
      var r = rk.find(function (x) { return x.sid === s.id; });
      return [s.no, s.name].concat(e.subjects.map(function (sub) { var v = scoreOf(e.id, s.id, sub); return v === null ? '' : v; }))
        .concat([totalOf(e.id, s.id) || '', r ? r.rank : '']);
    });
    downloadCSV([head].concat(rows), S.settings.className + '-' + e.name);
  };

  /* ----- 课表 / 作业 ----- */
  ACT.addHomework = function () {
    openModal({
      title: '布置作业',
      body: '<form data-form="homework"><div class="form-row"><div class="field"><label>学科</label><select class="sel" name="sub"><option>语文</option><option>数学</option><option>英语</option><option>物理</option><option>化学</option><option>生物</option></select></div>' +
        '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div></div>' +
        '<div class="field mt12"><label>作业内容</label><input class="inp" name="title" required placeholder="如：必修一 3.2 课后练习"></div></form>',
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="homework">保存</button>'
    });
  };
  ACT.markGraded = function (ds) {
    var hw = S.homework.find(function (x) { return x.id === ds.id; });
    if (hw) { hw.graded = hw.submitted.slice(); save(true); render(); toast('已标记全部批改', 'ok'); }
  };
  ACT.useTemplate = function (ds) {
    var t = S.templates.meetings.find(function (x) { return x.id === ds.id; });
    if (!t) return;
    openModal({
      title: t.title,
      body: '<div class="note mb12"><span>模板内容如下，可直接写入工作留痕。</span></div>' +
        '<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.75;background:#fafbfd;padding:13px;border-radius:10px;border:1px solid #eef1f6">' + esc(t.body) + '</pre>',
      footer: '<button class="btn" data-act="closeModal">关闭</button>' +
        '<button class="btn primary" data-act="writeTemplate" data-id="' + t.id + '">写入工作留痕</button>'
    });
  };
  ACT.writeTemplate = function (ds) {
    var t = S.templates.meetings.find(function (x) { return x.id === ds.id; });
    if (!t) return;
    S.records.push({ id: 'r' + Date.now().toString(36), date: todayStr(), category: '班会', title: t.title, body: t.body, by: S.settings.teacher });
    save(true); closeModal(); view = 'records'; render(); toast('已写入工作留痕', 'ok');
  };

  /* ----- 通知 ----- */
  ACT.addNotice = function () {
    openModal({
      title: '发布通知',
      body: '<form data-form="notice"><div class="field"><label>标题</label><input class="inp" name="title" required></div>' +
        '<div class="field mt12"><label>正文</label><textarea class="ta" name="body" required style="min-height:120px"></textarea></div>' +
        '<div class="form-row mt12"><div class="field"><label>范围</label><select class="sel" name="scope"><option>全班</option><option>男生</option><option>女生</option><option>住宿生</option></select></div>' +
        '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div></div></form>',
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="notice">发布</button>'
    });
  };
  ACT.viewNotice = function (ds) {
    var n = S.notices.find(function (x) { return x.id === ds.id; });
    if (!n) return;
    var read = n.readBy || [];
    var body = '<div class="note mb12"><span>' + esc(n.body) + '</span></div>' +
      '<div class="small muted mb8">点击姓名切换已读状态（已读 ' + read.length + '/' + activeStudents().length + '）</div><div class="chips">' +
      activeStudents().map(function (s) {
        var on = read.indexOf(s.id) > -1;
        return '<span class="chip' + (on ? ' on' : '') + '" data-act="toggleRead" data-nid="' + n.id + '" data-sid="' + s.id + '" style="cursor:pointer">' + esc(s.name) + '</span>';
      }).join('') + '</div>';
    openModal({ title: '回执 · ' + n.title, cls: 'wide', body: body });
  };
  ACT.toggleRead = function (ds) {
    var n = S.notices.find(function (x) { return x.id === ds.nid; });
    if (!n) return;
    n.readBy = n.readBy || [];
    var i = n.readBy.indexOf(ds.sid);
    if (i > -1) n.readBy.splice(i, 1); else n.readBy.push(ds.sid);
    save(true);
    ACT.viewNotice({ id: ds.nid });
  };

  /* ----- 沟通 ----- */
  ACT.delComm = function (ds) {
    confirmBox('删除记录', '确定删除这条沟通记录吗？', function () {
      S.comms = S.comms.filter(function (c) { return c.id !== ds.id; });
      save(true); render();
    });
  };

  /* ----- 留痕 ----- */
  ACT.addRecord = function () {
    openModal({
      title: '新增工作留痕',
      body: '<form data-form="record"><div class="form-row three"><div class="field"><label>类别</label><select class="sel" name="category"><option>班会</option><option>安全教育</option><option>家访</option><option>谈心</option><option>其他</option></select></div>' +
        '<div class="field"><label>日期</label><input class="inp" type="date" name="date" value="' + todayStr() + '"></div>' +
        '<div class="field"><label>记录人</label><input class="inp" name="by" value="' + esc(S.settings.teacher || '班主任') + '"></div></div>' +
        '<div class="field mt12"><label>标题</label><input class="inp" name="title" required placeholder="如：主题教育：诚信考试"></div>' +
        '<div class="field mt12"><label>内容</label><textarea class="ta" name="body" style="min-height:110px" placeholder="记录过程、参与人员、达成的效果"></textarea></div></form>',
      footer: '<button class="btn" data-act="closeModal">取消</button><button class="btn primary" data-act="submitForm" data-form="record">保存</button>'
    });
  };
  ACT.delRecord = function (ds) {
    confirmBox('删除记录', '确定删除这条工作留痕吗？', function () {
      S.records = S.records.filter(function (r) { return r.id !== ds.id; });
      save(true); render();
    });
  };
  ACT.recFilter = function (ds) { ui.recFilter = ds.c; render(); };
  ACT.exportRecords = function () {
    var head = ['日期', '类别', '标题', '内容', '记录人'];
    var rows = S.records.slice().sort(byDateDesc).map(function (r) { return [r.date, r.category, r.title, r.body.replace(/\n/g, ' '), r.by || '']; });
    downloadCSV([head].concat(rows), S.settings.className + '-工作留痕');
  };
  ACT.printView = function () { window.print(); };

  /* ----- 备份 ----- */
  ACT.exportJSON = function () {
    var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '班主任工作台备份-' + todayStr() + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    toast('已导出备份文件', 'ok');
  };
  ACT.importJSON = function () { var f = $('#fileInput'); if (f) f.click(); };
  ACT.resetDemo = function () {
    confirmBox('恢复演示数据', '当前数据将被演示数据覆盖，确定继续吗？建议先导出备份。', function () {
      Store.reset(); S = Store.state; render(); toast('已恢复演示数据', 'ok');
    }, '确认覆盖');
  };
  ACT.clearAll = function () {
    confirmBox('清空全部数据', '将删除所有学生、成绩、记录，只保留班级设置。此操作不可撤销，确定继续吗？', function () {
      var keep = JSON.parse(JSON.stringify(S.settings));
      Store.clear(); S = Store.state; S.settings = keep; Store.save(true); render(); toast('已清空，可以开始录入自己的数据', 'ok');
    }, '确认清空');
  };

  function doImportFile(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        Store.importJSON(String(reader.result));
        S = Store.state;
        ui.examId = null;
        render();
        toast('导入成功', 'ok');
      } catch (e) {
        toast('导入失败：' + e.message, 'err');
      }
    };
    reader.readAsText(f, 'utf-8');
    input.value = '';
  }

  /* ================= CSV 下载 ================= */
  function downloadCSV(rows, name) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var v = String(c === undefined || c === null ? '' : c);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (name || 'export') + '.csv';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  /* ================= 事件绑定 ================= */
  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('modal-mask')) { closeModal(); return; }
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'closeModal') { closeModal(); return; }
    if (ACT[act]) { e.preventDefault(); ACT[act](el.dataset, el, e); }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.dataset || !form.dataset.form) return;
    e.preventDefault();
    handleForm(form.dataset.form, form, form.dataset.id);
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.score) {
      var parts = el.dataset.score.split('|');
      var sid = parts[0], sub = parts[1];
      var exam = curExam();
      if (!exam) return;
      var raw = el.value.trim();
      var exist = S.scores.find(function (x) { return x.examId === exam.id && x.sid === sid && x.sub === sub; });
      var saved = null;
      if (raw === '') {
        if (exist) S.scores = S.scores.filter(function (x) { return x !== exist; });
      } else {
        saved = Math.max(0, Math.min(exam.full || 100, parseFloat(raw) || 0));
        if (exist) exist.val = saved;
        else S.scores.push({ id: 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), examId: exam.id, sid: sid, sub: sub, val: saved });
      }
      save(false);
      el.value = saved === null ? '' : saved;
      el.style.borderColor = (saved !== null && saved < 60) ? '#f3c9c9' : '#e6e9f0';
      var tr = el.closest('tr');
      if (tr) {
        var tt = totalOf(exam.id, sid);
        var rk = examRanking(exam.id).find(function (x) { return x.sid === sid; });
        var cells = tr.querySelectorAll('td');
        if (cells.length >= 2) {
          cells[cells.length - 2].textContent = tt === null ? '—' : tt;
          cells[cells.length - 1].textContent = rk ? rk.rank : '—';
        }
      }
    }
    if (el.dataset && el.dataset.tt) {
      var p = el.dataset.tt.split('|');
      var d = +p[0], k = +p[1];
      if (!S.timetable[d]) S.timetable[d] = [];
      S.timetable[d][k] = el.value.trim();
      save(false);
    }
  });

  /* ================= 表单处理 ================= */
  function handleForm(kind, form, id) {
    var fd = new FormData(form);
    var g = function (k) { return (fd.get(k) || '').toString().trim(); };

    if (kind === 'student') {
      var tags = g('tags') ? g('tags').split(/[,，、]/).map(function (t) { return t.trim(); }).filter(Boolean) : [];
      if (id) {
        var s = S.students.find(function (x) { return x.id === id; });
        if (s) {
          s.name = g('name'); s.no = g('no'); s.gender = g('gender');
          s.group = parseInt(g('group')) || 1; s.dorm = g('dorm');
          s.parent = g('parent'); s.parentPhone = g('parentPhone'); s.phone = g('phone');
          s.tags = tags;
        }
      } else {
        var maxNo = S.students.reduce(function (a, x) { return Math.max(a, parseInt(x.no) || 0); }, 0);
        S.students.push({
          id: 's' + Date.now().toString(36),
          no: g('no') || String(maxNo + 1).padStart(2, '0'),
          name: g('name'), gender: g('gender'), group: parseInt(g('group')) || 1,
          dorm: g('dorm'), parent: g('parent'), parentPhone: g('parentPhone'), phone: g('phone'),
          tags: tags, archived: false
        });
      }
      save(true); closeModal(); render(); toast('已保存', 'ok');
    }

    if (kind === 'task') {
      S.tasks.push({ id: 't' + Date.now().toString(36), date: g('date'), title: g('title'), type: g('type'), done: false });
      save(true); closeModal(); render(); toast('已添加待办', 'ok');
    }

    if (kind === 'discipline') {
      var type = g('type');
      var pts = parseFloat(g('points')) || 0;
      if (type === 'violation' && pts > 0) pts = -pts;
      S.discipline.push({
        id: 'd' + Date.now().toString(36), sid: g('sid'), type: type,
        title: g('title'), points: pts, date: g('date'), note: g('note')
      });
      save(true); render(); toast('已记录', 'ok');
      form.reset();
      var dEl = form.querySelector('[name="date"]'); if (dEl) dEl.value = todayStr();
    }

    if (kind === 'fee') {
      S.fees.push({
        id: 'f' + Date.now().toString(36), date: g('date'), item: g('item'),
        type: g('type'), amount: Math.abs(parseFloat(g('amount')) || 0), note: g('note')
      });
      save(true); closeModal(); render(); toast('已记录', 'ok');
    }

    if (kind === 'exam') {
      var subs = g('subjects').split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
      var eid = 'e' + Date.now().toString(36);
      S.exams.push({ id: eid, name: g('name'), date: g('date'), subjects: subs, full: parseFloat(g('full')) || 100 });
      ui.examId = eid; ui.scoreTab = 'entry';
      save(true); closeModal(); render(); toast('考试已创建', 'ok');
    }

    if (kind === 'homework') {
      S.homework.push({ id: 'h' + Date.now().toString(36), date: g('date'), sub: g('sub'), title: g('title'), submitted: [], graded: [] });
      save(true); closeModal(); render(); toast('已布置', 'ok');
    }

    if (kind === 'notice') {
      S.notices.push({ id: 'n' + Date.now().toString(36), date: g('date'), title: g('title'), body: g('body'), scope: g('scope'), readBy: [] });
      save(true); closeModal(); render(); toast('通知已发布', 'ok');
    }

    if (kind === 'comm') {
      S.comms.push({ id: 'c' + Date.now().toString(36), date: g('date'), sid: g('sid'), type: g('type'), summary: g('summary'), next: g('next') });
      save(true); render(); toast('已保存', 'ok');
      form.reset();
    }

    if (kind === 'record') {
      S.records.push({ id: 'r' + Date.now().toString(36), date: g('date'), category: g('category'), title: g('title'), body: g('body'), by: g('by') });
      save(true); closeModal(); render(); toast('已保存留痕', 'ok');
    }

    if (kind === 'settings') {
      S.settings.className = g('className');
      S.settings.teacher = g('teacher');
      S.settings.term = g('term');
      S.settings.school = g('school');
      S.settings.examTargetName = g('examTargetName');
      S.settings.examTarget = g('examTarget');
      S.settings.pointThreshold = parseFloat(g('pointThreshold')) || 0;
      save(true); render(); toast('设置已保存', 'ok');
    }
  }

  /* ================= 启动 ================= */
  function boot() {
    S = Store.load();
    if (!S.settings) S.settings = {};
    if (S.settings.pointThreshold === undefined) S.settings.pointThreshold = 0;
    if (!S.periods) S.periods = ['第1节 08:00', '第2节 08:55', '第3节 10:00', '第4节 10:55', '第5节 14:00', '第6节 14:55', '第7节 16:00'];
    if (!S.templates) S.templates = { meetings: [], comments: [] };
    Store.onSave = function () {
      var d = new Date();
      var el = document.getElementById('saveState');
      if (el) el.textContent = '已保存 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    };
    Store.onError = function () { toast('保存失败：存储空间可能已满', 'err'); };
    if (S.exams.length) ui.examId = S.exams[S.exams.length - 1].id;
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
