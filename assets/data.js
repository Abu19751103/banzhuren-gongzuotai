/* ============ 数据层：本地存储 + 演示种子数据 ============ */
(function (global) {
  'use strict';

  var KEY = 'bzr.workbench.v1';

  /* ---------- 日期工具 ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dstr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function shift(days) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return dstr(d);
  }
  function parseDate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return new Date(NaN);
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0, 0);
  }
  function daysBetween(a, b) {
    var d1 = parseDate(a), d2 = parseDate(b);
    if (isNaN(d1) || isNaN(d2)) return 0;
    return Math.round((d2 - d1) / 86400000);
  }
  function fmtCn(s) {
    var d = parseDate(s);
    if (isNaN(d)) return s || '';
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function weekdayCn(s) {
    var d = parseDate(s);
    if (isNaN(d)) return '';
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 拼音首字母表（用于姓名检索） ---------- */
  var PY_GROUPS = {
    a: '安阿艾敖',
    b: '白包毕卜边卞班鲍柏薄宾贝步巴博冰波',
    c: '陈崔曹蔡程常柴岑储楚池迟从超晨春彩灿',
    d: '邓董杜丁戴段窦狄刁党东丹冬大德',
    e: '鄂二',
    f: '冯范傅方付樊房费封符丰凤飞峰凡芳',
    g: '郭高龚顾耿关甘葛巩谷管宫桂国干刚光',
    h: '黄胡何韩侯郝贺霍华洪海花慧浩涵航红宏辉荷',
    j: '蒋贾金姜江焦景吉季靳简姬井居军杰娟静佳嘉俊建洁晶九',
    k: '孔康柯匡寇阚',
    l: '李刘林罗梁吕卢廖陆雷黎龙柳蓝路凌楼廉赖磊丽莉琳灵六',
    m: '马孟毛莫苗缪闵梅米满茅明敏美梦曼慕',
    n: '倪宁聂牛农那娜楠妮',
    o: '欧',
    p: '彭潘庞裴蒲皮平鹏培',
    q: '钱秦邱乔齐祁屈强覃丘琪琦巧清晴秋七',
    r: '任饶阮荣冉睿若蕊',
    s: '孙宋苏沈史邵石施商尚舒沙单时帅诗思书三四十山松',
    t: '唐田陶谭汤童涂滕屠涛婷天彤桐甜',
    w: '王吴魏汪韦武万温文翁巫伟维五',
    x: '徐许谢肖萧夏熊薛向席辛胥宣项秀霞欣轩熙星心小雪晓新馨旭',
    y: '杨叶余于袁姚尹严易俞岳颜应晏洋勇艳雨宇一月阳怡语雅玉云燕英艺亦',
    z: '张赵周郑朱钟曾邹庄翟詹祝左宗臧泽梓子志智卓政正'
  };
  var PY = {};
  Object.keys(PY_GROUPS).forEach(function (letter) {
    var chars = Array.from(PY_GROUPS[letter]);
    chars.forEach(function (ch) { PY[ch] = letter; });
  });

  function initials(name) {
    return Array.from(String(name || '')).map(function (ch) { return PY[ch] || ''; }).join('');
  }

  /* ---------- 确定性随机（保证演示数据稳定） ---------- */
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  var SUR = ['张', '王', '李', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗', '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹'];
  var GIV = ['子涵', '欣怡', '浩然', '雨轩', '梓萱', '思远', '嘉豪', '雨桐', '一鸣', '诗涵', '俊杰', '若曦', '晨曦', '泽宇', '语彤', '天佑', '佳琪', '若涵', '星辰', '明轩', '梦瑶', '博文', '雅静', '宇航', '思琪', '子墨', '家怡', '若彤', '亦凡', '书瑶'];
  var SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物'];

  function seed() {
    var rng = makeRng(20261114);
    var st = {
      version: 1,
      settings: {
        className: '高一(3)班',
        teacher: '王老师',
        term: '2026—2027学年 第一学期',
        school: '实验中学',
        pointThreshold: 0,
        seatRows: 6,
        seatCols: 7,
        examTarget: shift(18),
        examTargetName: '期末考试'
      },
      students: [],
      attendance: [],
      discipline: [],
      exams: [],
      scores: [],
      tasks: [],
      fees: [],
      notices: [],
      comms: [],
      records: [],
      homework: [],
      timetable: [],
      templates: { meetings: [], comments: [] }
    };

    /* ---- 学生：42 人，6 行 × 7 列 ---- */
    var used = {};
    var n = 0;
    for (var i = 0; i < 42; i++) {
      var nm;
      var guard = 0;
      do {
        nm = SUR[Math.floor(rng() * SUR.length)] + GIV[Math.floor(rng() * GIV.length)];
        guard++;
      } while (used[nm] && guard < 80);
      used[nm] = 1;
      n++;
      var female = /涵|怡|萱|桐|曦|彤|琪|瑶|静|彤|婷|宁|雅/.test(nm);
      st.students.push({
        id: 's' + n,
        no: String(n).padStart(2, '0'),
        name: nm,
        gender: female ? '女' : '男',
        group: Math.ceil(n / 7),
        row: Math.floor((n - 1) / 7),
        col: (n - 1) % 7,
        dorm: (female ? '女寝 ' : '男寝 ') + (200 + (n % 6) + 1) + ' 室',
        phone: '138' + String(10000000 + Math.floor(rng() * 89999999)).slice(0, 8),
        parent: nm.slice(0, 1) + (female ? '女士' : '先生'),
        parentPhone: '139' + String(10000000 + Math.floor(rng() * 89999999)).slice(0, 8),
        tags: [],
        archived: false
      });
    }

    /* ---- 考试与成绩 ---- */
    var examDefs = [
      { id: 'e1', name: '第一次月考', date: shift(-48) },
      { id: 'e2', name: '期中考试', date: shift(-22) },
      { id: 'e3', name: '第二次月考', date: shift(-3) }
    ];
    examDefs.forEach(function (e) {
      st.exams.push({ id: e.id, name: e.name, date: e.date, subjects: SUBJECTS.slice(), full: 100 });
    });
    st.students.forEach(function (s, idx) {
      var ability = 0.42 + rng() * 0.54;
      examDefs.forEach(function (e, k) {
        var drift = (rng() - 0.5) * 0.06 + k * 0.006;
        SUBJECTS.forEach(function (sub, j) {
          var bias = (j === 1 ? 0.02 : j === 3 ? -0.03 : 0); // 数理略难
          var v = Math.round(100 * (ability + drift + bias + (rng() - 0.5) * 0.13));
          v = Math.max(28, Math.min(100, v));
          st.scores.push({ id: 'sc' + e.id + '_' + s.id + '_' + j, examId: e.id, sid: s.id, sub: sub, val: v });
        });
      });
    });

    /* ---- 考勤：近 30 天 ---- */
    var reasons = { leave: ['感冒发烧', '家中有事', '牙科复诊', '参加竞赛培训'], late: ['早高峰堵车', '闹钟没响'], absent: ['未请假缺勤'], early: ['身体不适提前离校'] };
    var an = 0;
    for (var d = 30; d >= 0; d--) {
      var ds = shift(-d);
      var wd = parseDate(ds).getDay();
      if (wd === 0 || wd === 6) continue;
      var cnt = rng() < 0.45 ? (rng() < 0.22 ? 2 : 1) : 0;
      for (var c = 0; c < cnt; c++) {
        var s2 = st.students[Math.floor(rng() * st.students.length)];
        var r = rng();
        var type = r < 0.62 ? 'leave' : r < 0.82 ? 'late' : r < 0.94 ? 'absent' : 'early';
        an++;
        st.attendance.push({
          id: 'at' + an, date: ds, sid: s2.id, type: type,
          reason: reasons[type][Math.floor(rng() * reasons[type].length)],
          noted: false
        });
      }
    }

    /* ---- 奖惩 / 积分 / 谈心 ---- */
    var awards = ['课堂发言积极', '主动帮助同学', '值日认真负责', '期中进步显著', '运动会获名次', '拾金不昧', '作业质量优秀', '担任小组长尽责'];
    var violations = ['上课讲话', '未按时交作业', '课间追逐打闹', '校服不整', '迟到进班', '课堂使用手机'];
    var dn = 0;
    st.students.forEach(function (s) {
      var k = Math.floor(rng() * 3);
      for (var i2 = 0; i2 < k; i2++) {
        dn++;
        st.discipline.push({
          id: 'd' + dn, sid: s.id, type: 'award',
          title: awards[Math.floor(rng() * awards.length)],
          points: 2 + Math.floor(rng() * 5), date: shift(-Math.floor(rng() * 40) - 1), note: ''
        });
      }
      if (rng() < 0.22) {
        dn++;
        st.discipline.push({
          id: 'd' + dn, sid: s.id, type: 'violation',
          title: violations[Math.floor(rng() * violations.length)],
          points: -(2 + Math.floor(rng() * 6)), date: shift(-Math.floor(rng() * 30) - 1), note: '已当面提醒并记录'
        });
      }
      if (rng() < 0.3) {
        dn++;
        st.discipline.push({
          id: 'd' + dn, sid: s.id, type: 'talk',
          title: '谈心谈话', points: 0,
          date: shift(-Math.floor(rng() * 25) - 1),
          note: '了解近期学习状态，情绪稳定，建议加强理科错题整理。'
        });
      }
      if (rng() < 0.12) {
        dn++;
        st.discipline.push({
          id: 'd' + dn, sid: s.id, type: 'contest',
          title: '校数学竞赛三等奖', points: 8,
          date: shift(-Math.floor(rng() * 20) - 1), note: ''
        });
      }
    });

    /* ---- 待办 ---- */
    st.tasks = [
      { id: 't1', date: dstr(), title: '收齐本周《家校联系册》回执', type: '常规', done: false },
      { id: 't2', date: dstr(), title: '班会：期中考试动员与目标卡填写', type: '班会', done: false },
      { id: 't3', date: shift(1), title: '联系李同学家长，沟通近期作业情况', type: '家访', done: false },
      { id: 't4', date: shift(2), title: '汇总本月班费收支并公示', type: '常规', done: false },
      { id: 't5', date: shift(-1), title: '检查教室安全隐患（插座、门窗）', type: '安全', done: true }
    ];

    /* ---- 课表 ---- */
    var TPL = [
      ['语文', '数学', '英语', '物理', '化学', '生物', '自习'],
      ['数学', '英语', '语文', '化学', '体育', '物理', '班会'],
      ['英语', '语文', '数学', '生物', '物理', '信息技术', '自习'],
      ['物理', '化学', '生物', '数学', '语文', '英语', '体育'],
      ['化学', '生物', '物理', '语文', '数学', '英语', '自习']
    ];
    var PERIODS = ['第1节 08:00', '第2节 08:55', '第3节 10:00', '第4节 10:55', '第5节 14:00', '第6节 14:55', '第7节 16:00'];
    st.timetable = TPL.map(function (row) { return row.slice(); });
    st.periods = PERIODS;

    /* ---- 通知 ---- */
    st.notices = [
      { id: 'n1', date: shift(-2), title: '关于期中考试安排与复习建议', body: '期中考试定于本月下旬，请家长协助孩子制定复习计划，保证睡眠，减少电子产品使用时间。', scope: '全班', readBy: st.students.slice(0, 26).map(function (s) { return s.id; }) },
      { id: 'n2', date: shift(-6), title: '秋季运动会报名与安全提醒', body: '运动会报名截止本周五，请有意向的同学到体育委员处登记；参赛同学注意赛前热身。', scope: '全班', readBy: st.students.slice(0, 38).map(function (s) { return s.id; }) }
    ];

    /* ---- 家校沟通 ---- */
    st.comms = [
      { id: 'c1', date: shift(-1), sid: st.students[2].id, type: '通话', summary: '反馈近期数学作业完成质量下滑，家长表示会督促每晚检查。', next: '一周后回访' },
      { id: 'c2', date: shift(-4), sid: st.students[7].id, type: '面谈', summary: '家长到校了解孩子住宿适应情况，情绪已稳定。', next: '' },
      { id: 'c3', date: shift(-9), sid: st.students[15].id, type: '会议', summary: '期中家长会，沟通分层作业与培优辅差安排。', next: '' }
    ];

    /* ---- 工作留痕 ---- */
    st.records = [
      { id: 'r1', date: shift(-3), category: '班会', title: '主题教育：诚信考试', body: '学习考场规则，签署诚信考试承诺书，全班 42 人到齐。', by: '班主任' },
      { id: 'r2', date: shift(-8), category: '安全教育', title: '秋季防火与用电安全', body: '观看消防警示教育片，讲解宿舍用电规范，完成安全知识小测。', by: '班主任' },
      { id: 'r3', date: shift(-12), category: '家访', title: '家访：重点关注学生 2 名', body: '走访两户家庭，了解居家学习环境，与家长约定手机管理方案。', by: '班主任' }
    ];

    /* ---- 作业 ---- */
    st.homework = [
      { id: 'h1', date: shift(-1), sub: '数学', title: '必修一 3.2 课后练习', submitted: st.students.slice(0, 39).map(function (s) { return s.id; }), graded: st.students.slice(0, 31).map(function (s) { return s.id; }) },
      { id: 'h2', date: shift(-2), sub: '语文', title: '《荷塘月色》读后感 600 字', submitted: st.students.slice(0, 36).map(function (s) { return s.id; }), graded: st.students.slice(0, 20).map(function (s) { return s.id; }) },
      { id: 'h3', date: dstr(), sub: '英语', title: 'Unit 2 单词默写 + 阅读一篇', submitted: st.students.slice(0, 28).map(function (s) { return s.id; }), graded: [] }
    ];

    /* ---- 班费 ---- */
    var feeRows = [
      { id: 'f1', date: shift(-40), item: '开学收取班费（42人 × 100元）', type: 'income', amount: 4200, note: '由生活委员登记' },
      { id: 'f2', date: shift(-32), item: '购买班级绿植与清洁用品', type: 'expense', amount: 268, note: '' },
      { id: 'f3', date: shift(-21), item: '运动会横幅与号码布', type: 'expense', amount: 186, note: '' },
      { id: 'f4', date: shift(-12), item: '期中奖品（笔记本、文具）', type: 'expense', amount: 420, note: '用于红花榜奖励' },
      { id: 'f5', date: shift(-5), item: '家长赞助班级图书角', type: 'income', amount: 600, note: '' }
    ];
    st.fees = feeRows;
    st.feeMembers = st.students.map(function (s) {
      return { sid: s.id, paid: rng() < 0.9, amount: 100 };
    });

    /* ---- 模板库 ---- */
    st.templates.meetings = [
      { id: 'm1', title: '期中考试动员班会', body: '一、回顾上月班级情况\n二、明确期中目标与个人目标卡\n三、复习方法与时间管理建议\n四、签署诚信考试承诺书' },
      { id: 'm2', title: '安全教育：防溺水/防火', body: '一、观看警示片\n二、讲解六不准\n三、应急演练与知识小测\n四、签订安全承诺书' },
      { id: 'm3', title: '期末总结与假期指导', body: '一、学期班级工作总结\n二、表彰红花榜与进步之星\n三、假期学习与安全提醒\n四、下学期展望' }
    ];
    st.templates.comments = [
      { id: 'cm1', title: '进步型评语', body: '本学期你在学习态度上有明显转变，作业完成质量稳步提升，期中考试较月考进步 12 名。老师希望你在理科错题整理上再细致一些，把这份势头保持下去。' },
      { id: 'cm2', title: '稳定型评语', body: '你踏实守纪，待人真诚，是班级里让人放心的存在。学习上基础扎实，若能更主动地参与课堂讨论，把想法表达出来，你会收获更大的成长。' },
      { id: 'cm3', title: '需关注型评语', body: '老师注意到你近期作业偶有拖欠，课堂上注意力容易分散。你已经具备不错的基础，只要把每天的任务按时完成，成绩会有明显起色。老师愿意陪你一起调整。' }
    ];

    return st;
  }

  /* ---------- Store ---------- */
  var Store = {
    KEY: KEY,
    state: null,
    onSave: null,

    load: function () {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          var obj = JSON.parse(raw);
          if (obj && obj.students) { this.state = obj; return this.state; }
        } catch (e) { /* 损坏则重新种子 */ }
      }
      this.state = seed();
      this.save(true);
      return this.state;
    },

    save: function (silent) {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
        if (!silent && typeof this.onSave === 'function') this.onSave();
        return true;
      } catch (e) {
        if (typeof this.onError === 'function') this.onError(e);
        return false;
      }
    },

    reset: function () {
      this.state = seed();
      this.save(true);
      return this.state;
    },

    clear: function () {
      var blank = seed();
      blank.students = [];
      blank.attendance = [];
      blank.discipline = [];
      blank.scores = [];
      blank.exams = [];
      blank.tasks = [];
      blank.fees = [];
      blank.feeMembers = [];
      blank.notices = [];
      blank.comms = [];
      blank.records = [];
      blank.homework = [];
      blank.timetable = [[], [], [], [], []];
      this.state = blank;
      this.save(true);
      return this.state;
    },

    exportJSON: function () {
      return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'banzhuren-workbench', data: this.state }, null, 2);
    },

    importJSON: function (text) {
      var obj = JSON.parse(text);
      var data = obj && obj.data ? obj.data : obj;
      if (!data || !Array.isArray(data.students)) throw new Error('文件格式不正确：缺少 students 字段');
      this.state = data;
      this.save(true);
      return this.state;
    },

    size: function () {
      try {
        var s = localStorage.getItem(KEY) || '';
        return new Blob([s]).size;
      } catch (e) { return 0; }
    }
  };

  global.Store = Store;
  global.U = {
    dstr: dstr, shift: shift, parseDate: parseDate, daysBetween: daysBetween,
    fmtCn: fmtCn, weekdayCn: weekdayCn, esc: esc, initials: initials,
    SUBJECTS: SUBJECTS
  };
})(window);
