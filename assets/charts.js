/* ============ 轻量 SVG 图表（无依赖） ============ */
(function (global) {
  'use strict';

  var PALETTE = ['#2563eb', '#0f9d76', '#f59e0b', '#8b5cf6', '#e5484d', '#0ea5e9'];

  function niceMax(v) {
    if (!isFinite(v) || v <= 0) return 10;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 3 ? 3 : f <= 5 ? 5 : f <= 8 ? 8 : 10;
    return m * exp;
  }

  /**
   * 折线图
   * @param {Array<string>} labels
   * @param {Array<{name:string,color?:string,data:Array<number|null>}>} series
   */
  function line(labels, series, opts) {
    opts = opts || {};
    var W = 640, H = opts.height || 200;
    var padL = 40, padR = 14, padT = 14, padB = 28;
    var iw = W - padL - padR, ih = H - padT - padB;
    var all = [];
    series.forEach(function (s) {
      s.data.forEach(function (v) { if (v !== null && v !== undefined && isFinite(v)) all.push(+v); });
    });
    var min = opts.min !== undefined ? opts.min : Math.min.apply(null, all.concat([0]));
    var max = opts.max !== undefined ? opts.max : Math.max.apply(null, all.concat([1]));
    if (opts.reversed && opts.min === undefined) min = 1;
    if (min === max) { max = min + 1; }
    if (opts.min === undefined && opts.suggestMin) min = Math.max(0, Math.floor(min - (max - min) * 0.15));
    if (opts.max === undefined) max = niceMax(max + (max - min) * 0.08);
    if (min === max) max = min + 1;

    var n = labels.length;
    function X(i) { return n <= 1 ? padL + iw / 2 : padL + (iw * i) / (n - 1); }
    function Y(v) {
      var r = (v - min) / (max - min);
      if (opts.reversed) r = 1 - r;
      return padT + ih - r * ih;
    }

    var out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="chart" style="width:100%;height:' + H + 'px;overflow:visible">');

    // grid + y labels
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var v = min + ((max - min) * t) / ticks;
      var y = Y(v);
      out.push('<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#eef1f6" stroke-width="1"/>');
      out.push('<text x="' + (padL - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="#9aa4b5">' + (Math.round(v * 10) / 10) + '</text>');
    }

    // x labels
    var step = Math.max(1, Math.ceil(n / (opts.maxXLabels || 8)));
    labels.forEach(function (lb, i) {
      if (i % step !== 0 && i !== n - 1) return;
      out.push('<text x="' + X(i).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" font-size="9.5" fill="#9aa4b5">' + lb + '</text>');
    });

    // series
    series.forEach(function (s, si) {
      var color = s.color || PALETTE[si % PALETTE.length];
      var segs = [], cur = [];
      s.data.forEach(function (v, i) {
        if (v === null || v === undefined || !isFinite(v)) { if (cur.length) { segs.push(cur); cur = []; } return; }
        cur.push([X(i), Y(+v)]);
      });
      if (cur.length) segs.push(cur);

      segs.forEach(function (seg) {
        if (opts.area !== false && seg.length > 1) {
          var area = 'M' + seg[0][0].toFixed(1) + ',' + (padT + ih).toFixed(1)
            + ' L' + seg.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L')
            + ' L' + seg[seg.length - 1][0].toFixed(1) + ',' + (padT + ih).toFixed(1) + ' Z';
          out.push('<path d="' + area + '" fill="' + color + '" opacity="0.07"/>');
        }
        var d = seg.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
        out.push('<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2"' + (opts.dash ? ' stroke-dasharray="4 3"' : '') + ' stroke-linejoin="round" stroke-linecap="round"/>');
        seg.forEach(function (p) {
          out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.8" fill="#fff" stroke="' + color + '" stroke-width="1.8"/>');
        });
      });
    });

    out.push('</svg>');

    var legend = '';
    if (series.length > 1 || opts.legend) {
      legend = '<div class="chart-legend">' + series.map(function (s, i) {
        return '<span><i style="background:' + (s.color || PALETTE[i % PALETTE.length]) + '"></i>' + s.name + '</span>';
      }).join('') + '</div>';
    }
    return '<div class="chart-box">' + out.join('') + legend + '</div>';
  }

  /**
   * 柱状图（垂直）
   * @param {Array<{label:string,value:number,color?:string}>} items
   */
  function bar(items, opts) {
    opts = opts || {};
    var W = 640, H = opts.height || 180;
    var padL = 34, padR = 12, padT = 12, padB = 26;
    var iw = W - padL - padR, ih = H - padT - padB;
    var max = opts.max !== undefined ? opts.max : niceMax(Math.max.apply(null, items.map(function (i) { return Math.abs(i.value); }).concat([1])));
    var n = items.length || 1;
    var gap = Math.min(18, iw / n * 0.34);
    var bw = (iw - gap * (n + 1)) / n;
    if (bw < 2) bw = 2;

    var out = ['<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:' + H + 'px;overflow:visible">'];
    for (var t = 0; t <= 3; t++) {
      var v = (max * t) / 3, y = padT + ih - (v / max) * ih;
      out.push('<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#eef1f6"/>');
      out.push('<text x="' + (padL - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9.5" fill="#9aa4b5">' + Math.round(v) + '</text>');
    }
    items.forEach(function (it, i) {
      var x = padL + gap + i * (bw + gap);
      var h = Math.max(1, (Math.abs(it.value) / max) * ih);
      var y = padT + ih - h;
      var color = it.color || PALETTE[i % PALETTE.length];
      out.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + color + '" opacity="0.92"/>');
      out.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#7b8698">' + it.value + '</text>');
      if (n <= 16) {
        out.push('<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9.5" fill="#9aa4b5">' + it.label + '</text>');
      }
    });
    out.push('</svg>');
    return '<div class="chart-box">' + out.join('') + '</div>';
  }

  function donut(parts, opts) {
    opts = opts || {};
    var total = parts.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var R = 54, r = 34, C = 64;
    var acc = -Math.PI / 2;
    var out = ['<svg viewBox="0 0 128 128" style="width:128px;height:128px">'];
    parts.forEach(function (p, i) {
      var ang = (p.value / total) * Math.PI * 2;
      if (ang <= 0) return;
      var x1 = C + R * Math.cos(acc), y1 = C + R * Math.sin(acc);
      var x2 = C + R * Math.cos(acc + ang), y2 = C + R * Math.sin(acc + ang);
      var xi2 = C + r * Math.cos(acc + ang), yi2 = C + r * Math.sin(acc + ang);
      var xi1 = C + r * Math.cos(acc), yi1 = C + r * Math.sin(acc);
      var large = ang > Math.PI ? 1 : 0;
      out.push('<path d="M' + x1.toFixed(2) + ',' + y1.toFixed(2) +
        ' A' + R + ',' + R + ' 0 ' + large + ' 1 ' + x2.toFixed(2) + ',' + y2.toFixed(2) +
        ' L' + xi2.toFixed(2) + ',' + yi2.toFixed(2) +
        ' A' + r + ',' + r + ' 0 ' + large + ' 0 ' + xi1.toFixed(2) + ',' + yi1.toFixed(2) + ' Z" fill="' +
        (p.color || PALETTE[i % PALETTE.length]) + '"/>');
      acc += ang;
    });
    out.push('<text x="64" y="60" text-anchor="middle" font-size="17" font-weight="700" fill="#131a26">' + (opts.center || total) + '</text>');
    out.push('<text x="64" y="76" text-anchor="middle" font-size="9.5" fill="#9aa4b5">' + (opts.centerSub || '') + '</text>');
    out.push('</svg>');
    return out.join('');
  }

  global.Charts = { line: line, bar: bar, donut: donut, PALETTE: PALETTE };
})(window);
