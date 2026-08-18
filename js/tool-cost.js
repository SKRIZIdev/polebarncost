

(function () {
  'use strict';

  var root = document.querySelector('[data-tool="cost"]');
  if (!root) return;

  var DATA = JSON.parse(document.getElementById('cost-data').textContent);
  var form = root.querySelector('form');
  var out = root.querySelector('[data-result]');
  var LINES = {};
  DATA.lines.forEach(function (l) { LINES[l.id] = l; });

  function money(v) {
    return '$' + (Math.round(v / 100) * 100).toLocaleString('en-US');
  }

  function range(low, high) {
    return money(low) + '–' + money(high);
  }

  
  function wallFactor(w, l, h) {
    var base = DATA.base_wall_height || 12;
    var roof = w * l * (DATA.roof_pitch_factor || 1.05);
    var at = function (height) { return 2 * (w + l) * height + roof; };
    return at(h) / at(base);
  }

  
  function findSize(w, l) {
    var list = DATA.sizes || [];
    var exact = null, flipped = null;
    list.forEach(function (s) {
      if (!exact && s.w === w && s.l === l) exact = s;
      if (!flipped && s.w === l && s.l === w) flipped = s;
    });
    return exact || flipped;
  }

  function lineFor(id, floor, factor) {
    var l = LINES[id];
    if (!l) return null;
    var mult = l.scales === 'envelope' ? floor * factor : floor;
    return {
      id: id, label: l.label, note: l.note,
      low: l.low * mult, high: l.high * mult
    };
  }

  function render(p) {
    var floor = p.width * p.length;
    var factor = wallFactor(p.width, p.length, p.height);
    var rows = [];

    if (p.extras.indexOf('prep') > -1) rows.push(lineFor('prep', floor, factor));

    if (p.mode === 'kit') {
      rows.push(lineFor('kit', floor, factor));
    } else if (p.mode === 'assembly') {
      rows.push(lineFor('kit', floor, factor));
      rows.push(lineFor('assembly', floor, factor));
    } else {
      rows.push(lineFor('shell', floor, factor));
    }

    if (p.extras.indexOf('concrete') > -1) rows.push(lineFor('concrete', floor, factor));
    if (p.extras.indexOf('exterior') > -1) rows.push(lineFor('exterior', floor, factor));
    if (p.extras.indexOf('interior') > -1) rows.push(lineFor('interior', floor, factor));

    rows = rows.filter(Boolean);

    var low = 0, high = 0;
    rows.forEach(function (r) { low += r.low; high += r.high; });

    var shellRow = rows.filter(function (r) { return r.id === 'shell' || r.id === 'kit'; })[0];
    var shellShare = shellRow && high ? Math.round((shellRow.high / high) * 100) : 0;

    out.innerHTML = '';

    var mid = (low + high) / 2;

    var head = document.createElement('div');
    head.className = 'result-head';
    head.innerHTML =
      '<span class="pill">Result</span>' +
      '<h2>' + range(low, high) + ' <span class="dim">for ' + p.width + 'x' + p.length + '</span></h2>' +
      '<p class="lede">' + floor.toLocaleString('en-US') + ' sq ft at ' +
      '$' + (low / floor).toFixed(0) + '–' + (high / floor).toFixed(0) + ' per square foot, ' +
      'middle of the range ' + money(mid) +
      (shellShare ? '. The ' + (shellRow.id === 'kit' ? 'kit' : 'shell') +
        ' is ' + shellShare + '% of the top of it.' : '.') + '</p>';
    out.appendChild(head);

    var stats = document.createElement('div');
    stats.className = 'stat-row';
    stats.innerHTML =
      '<div class="pick-stat"><span>Floor area</span><b>' + floor.toLocaleString('en-US') + '<i> sq ft</i></b></div>' +
      '<div class="pick-stat"><span>Middle of range</span><b>' + money(mid) + '</b></div>' +
      '<div class="pick-stat"><span>Per square foot</span><b>$' + (low / floor).toFixed(0) +
        '–' + (high / floor).toFixed(0) + '</b></div>' +
      '<div class="pick-stat"><span>Wall height</span><b>' + p.height + '<i> ft</i></b></div>';
    out.appendChild(stats);

    var table = document.createElement('div');
    table.className = 'table-wrap';
    var html = '<table class="facts-table result-table"><thead><tr>' +
      '<th scope="col">Line</th><th scope="col">Cost</th><th scope="col">What it covers</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr><td data-label="Line"><b>' + r.label + '</b></td>' +
        '<td data-label="Cost">' + range(r.low, r.high) + '</td>' +
        '<td data-label="What it covers">' + r.note + '</td></tr>';
    });
    html += '<tr class="result-total"><td data-label="Line"><b>Total</b></td>' +
      '<td data-label="Cost"><b>' + range(low, high) + '</b></td>' +
      '<td data-label="What it covers">Everything ticked above</td></tr>';
    html += '</tbody></table>';
    table.innerHTML = html;
    out.appendChild(table);

    var missing = [];
    if (p.extras.indexOf('prep') < 0) missing.push('site prep');
    if (p.extras.indexOf('concrete') < 0) missing.push('a concrete floor');
    if (p.extras.indexOf('exterior') < 0) missing.push('doors and windows');
    if (p.extras.indexOf('interior') < 0) missing.push('insulation and electrics');

    var note = document.createElement('p');
    note.className = 'result-note';
    var bench = DATA.benchmarks || {};
    var avgPer = bench.national_average && bench.national_average_sqft
      ? bench.national_average / bench.national_average_sqft : null;
    var perHigh = high / floor;

    var over = bench.per_sqft_high && perHigh > bench.per_sqft_high
      ? ' The top of this range works out at $' + perHigh.toFixed(0) +
        ' a foot, above the $' + bench.per_sqft_low + '–' + bench.per_sqft_high +
        ' quoted for post-frame, because it stacks the upper bound of every block at once.' +
        ' Real builds land nearer the middle.'
      : '';

    note.innerHTML = (missing.length
      ? '<b>Not in this number:</b> ' + missing.join(', ') +
        '. Add them above to see the finished building.'
      : '<b>This is the finished building</b> — all four blocks are in.') +
      (avgPer ? ' For scale, the national average is $' + bench.national_average.toLocaleString('en-US') +
        ' on ' + bench.national_average_sqft.toLocaleString('en-US') + ' sq ft, or about $' +
        avgPer.toFixed(0) + ' a foot.' : '') + over;
    out.appendChild(note);

    var outlets = document.createElement('div');
    outlets.className = 'pick-outlets';
    var page = findSize(p.width, p.length);
    var links = (DATA.outlets || []).slice(0, 3);
    if (page) {
      links = [{ label: 'The full ' + page.size + ' page', url: page.url,
                 note: 'Same numbers, with what fits inside' }].concat(links).slice(0, 3);
    }
    var oh = '<b>Where to go next</b><div class="outlet-row">';
    links.forEach(function (o) {
      var internal = o.url.charAt(0) === '/';
      oh += '<a class="outlet"' + (internal ? '' : ' rel="sponsored nofollow"') +
        ' href="' + o.url + '"><span>' + o.label + '</span><em>' + o.note + '</em></a>';
    });
    oh += '</div><p class="fine">' + (DATA.disclosure || '') + '</p>';
    outlets.innerHTML = oh;
    out.appendChild(outlets);

    out.hidden = false;
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var extras = fd.getAll('extras');
    render({
      width: Math.max(8, parseFloat(fd.get('width')) || 40),
      length: Math.max(8, parseFloat(fd.get('length')) || 60),
      height: parseFloat(fd.get('height')) || 12,
      mode: fd.get('mode') || 'shell',
      extras: extras
    });
  });

  form.addEventListener('reset', function () { out.hidden = true; out.innerHTML = ''; });
})();