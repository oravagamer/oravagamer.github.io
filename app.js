/* UI uses the original Chamber optimizer classes and visual tokens. */
(function () {
  'use strict';
  const {calculate, defaults} = window.Magnetorquer;
  const $ = id => document.getElementById(id);
  const states = {rod: {...defaults.rod}, air: {...defaults.air}};
  let kind = location.hash === '#air' ? 'air' : 'rod';
  let frame;
  const specs = {
    moment: ['Target dipole moment', 'A·m²', 'any', 'Required magnetic dipole moment.'],
    voltage: ['Supply voltage', 'V', 'any', 'Used to size the ideal wire and turn count.'],
    rodRadius: ['Core radius', 'mm', 'any'], rodLength: ['Core length', 'mm', 'any'],
    outerRadius: ['Outer winding radius', 'mm', 'any', 'Measured from the core axis, including the core.'],
    windingLength: ['Winding length', 'mm', 'any'],
    fill: ['Winding fill factor', '—', 'any', 'Copper volume / winding-envelope volume (0 < k ≤ 1).'],
    permeability: ['Relative permeability', '—', 'any'],
    saturation: ['Saturation induction', 'T', 'any', 'Used for the rough saturation estimate in the supplied script.'],
    side: ['Mean coil side', 'mm', 'any', 'Side length at the winding centreline.'],
    width: ['In-plane winding width', 'mm', 'any', 'Total copper-pack width across each side.'],
    thickness: ['Winding thickness', 'mm', 'any', 'Copper-pack thickness out of the coil plane.'],
    resistivity: ['Copper resistivity', 'Ω·m', 'any', 'Reference value: 1.775 × 10⁻⁸ Ω·m; no automatic temperature correction.'],
    copperDensity: ['Copper density', 'kg/m³', 'any'], coreDensity: ['Core density', 'kg/m³', 'any']
  };
  const fmt = (n, dp = 3) => !Number.isFinite(n) ? '—' : n !== 0 && (Math.abs(n) < 10 ** -dp || Math.abs(n) >= 1e8) ? n.toExponential(3) : n.toLocaleString('en-GB', {minimumFractionDigits: 0, maximumFractionDigits: dp});
  const val = (n, u, dp = 3) => Number.isFinite(n) ? `${fmt(n, dp)} ${u}` : '—';
  function field(key) {
    const [label, unit, step, help] = specs[key];
    return `<label class="field"><span class="field-label">${label}</span><span class="input-with-unit"><input id="input-${key}" data-key="${key}" type="number" min="${key === 'permeability' ? 1 : 0}" ${key === 'fill' ? 'max="1"' : ''} step="${step}" value="${Number.isFinite(states[kind][key]) ? states[kind][key] : ''}" required><span>${unit}</span></span>${help ? `<small>${help}</small>` : ''}</label>`;
  }
  const section = (title, description, keys) => `<section class="control-section"><div class="section-heading"><div><h2>${title}</h2><p>${description}</p></div></div><div class="field-grid two-columns">${keys.map(field).join('')}</div></section>`;
  function renderInputs() {
    $('inputSections').innerHTML = section('Design target', 'Size the winding for a target magnetic dipole moment.', ['moment', 'voltage']) +
      (kind === 'rod'
        ? section('Core geometry', 'Dimensions of the cylindrical magnetic core.', ['rodRadius', 'rodLength']) + section('Copper winding', 'Annular winding envelope around the core.', ['outerRadius', 'windingLength', 'fill'])
        : section('Square coil geometry', 'Mean square path with a rectangular winding cross-section.', ['side', 'width', 'thickness', 'fill'])) +
      `<details class="advanced-panel"><summary><span>Material properties</span></summary><div class="advanced-content">${kind === 'rod' ? field('permeability') + field('saturation') + field('coreDensity') : ''}${field('resistivity')}${field('copperDensity')}</div></details>`;
    document.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === kind;
      button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    });
    $('calculatorView').setAttribute('aria-labelledby', `tab-${kind}`);
    $('designTitle').textContent = kind === 'rod' ? 'Rod magnetorquer' : 'Square air-core magnetorquer';
    $('designDescription').textContent = kind === 'rod' ? 'Cylindrical magnetic core with a copper winding.' : 'Square winding without a magnetic core.';
    $('geometryCaption').textContent = kind === 'rod' ? 'Axial section; schematic, not to scale' : 'Plan view; schematic, not to scale';
    $('modelFact').textContent = kind === 'rod' ? 'Core + copper' : 'Copper only';
    $('massNote').textContent = kind === 'rod' ? 'Copper + core' : 'Copper only';
    $('geometryMethod').textContent = kind === 'rod'
      ? 'r: core radius; rₒ: outer winding radius; L: core length; Lw: winding length. S = πr²; Vcore = SL; ℓ = 2π(rₒ + r)/2; V = π(rₒ² − r²)Lw k. Mean turn radius follows the supplied Python script.'
      : 's: mean side; w: in-plane winding width; t: out-of-plane thickness. S = s²; ℓ = 4s; V = 4swtk. The copper volume follows a square annular pack: outer side s + w, inner side s − w. The mean-area approximation is used for every turn.';
    $('electricalMethod').textContent = kind === 'rod'
      ? 'Nd = 4[ln(L/r) − 1] / [(L/r)² − 4ln(L/r)]. K = 1 + (μr − 1) / [1 + (μr − 1)Nd]. S is the core cross-sectional area. These expressions follow the rod PDF and Python script.'
      : 'K = 1 for the air coil. Using ℓ² = 16S gives P = 16ρm²/(VS), matching the square-coil PDF.';
    $('limitationsMethod').textContent = kind === 'rod'
      ? 'The rod is treated as linear with a geometry-dependent demagnetization factor. The code rejects L/r ≤ e because the provided formula no longer gives a positive factor, and flags L/r < 10 as a caution, not a validated accuracy boundary. Saturation estimate msat = Bsat Vcore / μ₀ follows the Python script; it is not a nonlinear B–H model. Linear electrical outputs are suppressed at or above this estimate.'
      : 'This is the square, mean-turn model in the supplied air-coil PDF. Finite winding width changes individual turn areas; that correction is not included. Air-coil example dimensions are editable starting values; the PDF does not specify a numeric design.';
    update();
  }
  function switchTab(next) {
    kind = next;
    history.replaceState(null, '', `${location.pathname}${location.search}#${kind}`);
    renderInputs();
  }
  $('tabList').addEventListener('click', event => { const button = event.target.closest('[data-tab]'); if (button) switchTab(button.dataset.tab); });
  $('tabList').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'rod' : event.key === 'End' ? 'air' : kind === 'rod' ? 'air' : 'rod';
    switchTab(next); $(`tab-${next}`).focus();
  });
  window.addEventListener('hashchange', () => { kind = location.hash === '#air' ? 'air' : 'rod'; renderInputs(); });
  $('inputSections').addEventListener('input', event => {
    const input = event.target.closest('[data-key]'); if (!input) return;
    states[kind][input.dataset.key] = input.value.trim() === '' ? NaN : input.valueAsNumber;
    input.setAttribute('aria-invalid', String(!Number.isFinite(input.valueAsNumber) || input.valueAsNumber <= 0 || !input.validity.valid));
    $('resultStatus').textContent = 'Calculating'; $('resultStatusDot').className = 'status-dot';
    cancelAnimationFrame(frame); frame = requestAnimationFrame(update);
  });
  $('resetButton').addEventListener('click', () => { states[kind] = {...defaults[kind]}; renderInputs(); });
  // Native MathML builders for the design-equation table (no external renderer).
  const mi = s => `<mi>${s}</mi>`, mn = s => `<mn>${s}</mn>`, mo = s => `<mo>${s}</mo>`;
  const mrow = (...x) => `<mrow>${x.join('')}</mrow>`;
  const frac = (a, b) => `<mfrac>${mrow(a)}${mrow(b)}</mfrac>`;
  const sup = (b, e) => `<msup>${b}${e}</msup>`, sub = (b, s) => `<msub>${b}${s}</msub>`;
  const subt = (b, s) => sub(mi(b), `<mtext>${s}</mtext>`);
  const sqrt = (...x) => `<msqrt>${x.join('')}</msqrt>`;
  const paren = (...x) => mo('(') + x.join('') + mo(')');
  const eq = (lhs, ...rhs) => `<math displaystyle="true">${mrow(lhs, mo('='), ...rhs)}</math>`;
  const sym = {S: mi('S'), V: mi('V'), l: mi('ℓ'), K: mi('K'), m: mi('m'), U: mi('U'), a: mi('a'), N: mi('N'), R: mi('R'), I: mi('I'), P: mi('P'),
    rho: mi('ρ'), pi: mi('π'), r: mi('r'), L: mi('L'), k: mi('k'), ro: sub(mi('r'), mi('o')), Lw: sub(mi('L'), mi('w')), Nd: sub(mi('N'), mi('d')),
    mur: sub(mi('μ'), mi('r')), Vcore: subt('V', 'core'), lwire: subt('l', 'wire'), Lr: mrow(mi('L'), mo('/'), mi('r'))};
  function equations(r) {
    const s = sym, ln = (...x) => mi('ln') + mo('&#x2061;') + paren(...x);
    const geometry = kind === 'rod' ? [
      ['Magnetic area', eq(s.S, s.pi, sup(s.r, mn(2))), r.area * 1e6, 'mm²'],
      ['Core volume', eq(s.Vcore, s.S, s.L), r.coreVolume * 1e6, 'cm³'],
      ['Mean turn length', eq(s.l, mn(2), s.pi, frac(mrow(s.ro, mo('+'), s.r), mn(2))), r.turnLength * 1000, 'mm'],
      ['Copper volume', eq(s.V, s.pi, paren(sup(s.ro, mn(2)), mo('−'), sup(s.r, mn(2))), s.Lw, s.k), r.volume * 1e6, 'cm³'],
      ['Demagnetization factor', eq(s.Nd, frac(mn(4) + mo('[') + ln(s.Lr) + mo('−') + mn(1) + mo(']'), sup(paren(s.Lr), mn(2)) + mo('−') + mn(4) + ln(s.Lr))), r.nd, '—'],
      ['Core gain', eq(s.K, mn(1), mo('+'), frac(mrow(s.mur, mo('−'), mn(1)), mrow(mn(1), mo('+'), paren(s.mur, mo('−'), mn(1)), s.Nd))), r.gain, '—'],
      ['Saturation moment', eq(subt('m', 'sat'), frac(subt('B', 'sat') + s.Vcore, sub(mi('μ'), mn(0)))), r.saturationMoment, 'A·m²']
    ] : [
      ['Magnetic area', eq(s.S, sup(mi('s'), mn(2))), r.area * 1e6, 'mm²'],
      ['Mean turn length', eq(s.l, mn(4), mi('s')), r.turnLength * 1000, 'mm'],
      ['Copper volume', eq(s.V, mn(4), mi('s'), mi('w'), mi('t'), s.k), r.volume * 1e6, 'cm³'],
      ['Core gain', eq(s.K, mn(1)), r.gain, '—']
    ];
    const power = kind === 'rod'
      ? eq(s.P, frac(s.rho + sup(s.m, mn(2)) + sup(s.l, mn(2)), s.V + sup(s.S, mn(2)) + sup(s.K, mn(2))))
      : eq(s.P, frac(s.rho + sup(s.m, mn(2)) + sup(s.l, mn(2)), s.V + sup(s.S, mn(2)) + sup(s.K, mn(2))), mo('='), frac(mn(16) + s.rho + sup(s.m, mn(2)), s.V + s.S));
    const electrical = [
      ['Electrical power', power, r.power * 1000, 'mW'],
      ['Bare conductor area', eq(s.a, frac(s.rho + s.m + s.l, s.S + s.K + s.U)), r.wireArea * 1e6, 'mm²'],
      ['Bare wire diameter', eq(mi('d'), mn(2), sqrt(frac(s.a, s.pi))), r.diameter * 1000, 'mm'],
      ['Turn count', eq(s.N, frac(s.V, s.l + s.a)), r.turns, '—'],
      ['Wire length', eq(s.lwire, s.N, s.l), r.wireLength, 'm'],
      ['Resistance', eq(s.R, frac(s.rho + s.lwire, s.a)), r.resistance, 'Ω'],
      ['Current', eq(s.I, frac(s.U, s.R)), r.current * 1000, 'mA']
    ].map(row => [...row, true]);
    const mass = [['Material mass', eq(mi('M'), sub(s.rho, '<mtext>Cu</mtext>'), s.V, ...(kind === 'rod' ? [mo('+'), sub(s.rho, '<mtext>core</mtext>'), s.Vcore] : [])), r.mass * 1000, 'g']];
    return [...geometry, ...electrical, ...mass];
  }
  function renderEquations(r, supported) {
    $('equationBody').innerHTML = equations(r.valid ? r : {}).map(([name, math, number, unit, electrical]) => {
      const shown = r.valid && (!electrical || supported) && Number.isFinite(number) ? fmt(number, 4) : '—';
      return `<tr><td>${name}</td><td class="equation-cell">${math}</td><td>${shown}</td><td>${unit}</td></tr>`;
    }).join('');
  }
  function update() {
    const p = states[kind], r = calculate(kind, p), supported = r.valid && !r.saturated;
    $('metricPower').textContent = supported ? val(r.power * 1000, 'mW', 2) : '—';
    $('metricMass').textContent = r.valid ? val(r.mass * 1000, 'g', 2) : '—';
    $('metricCurrent').textContent = supported ? val(r.current * 1000, 'mA', 2) : '—';
    $('metricDiameter').textContent = supported ? val(r.diameter * 1000, 'mm', 4) : '—';
    const warnings = r.valid ? r.warnings : [r.error];
    $('resultStatus').textContent = !r.valid ? 'Check inputs' : r.saturated ? 'Saturation estimate exceeded' : warnings.length ? 'Review model limits' : 'Calculated';
    $('resultStatusDot').className = `status-dot ${!r.valid || r.saturated ? 'is-error' : warnings.length ? '' : 'is-good'}`;
    $('warningPanel').hidden = !warnings.length;
    $('warningPanel').classList.toggle('is-error', !r.valid || r.saturated);
    $('warningPanel').replaceChildren(...warnings.map(message => { const para = document.createElement('p'); para.textContent = message; return para; }));
    renderEquations(r, supported);
    if (!r.valid) {
      $('selectedDimensions').textContent = '—'; $('detailBody').innerHTML = '<tr><td colspan="3">Enter a valid set of parameters.</td></tr>';
      $('voltageBody').innerHTML = '<tr><td colspan="5">—</td></tr>';
      $('geometrySvg').innerHTML = '<text x="280" y="165" text-anchor="middle">Geometry unavailable: check inputs.</text>';
      $('tradeoffSvg').innerHTML = '<text x="280" y="165" text-anchor="middle">Plot unavailable: check inputs.</text>'; return;
    }
    $('selectedDimensions').textContent = kind === 'rod' ? `Ø${fmt(p.rodRadius * 2)} × ${fmt(p.rodLength)} mm core` : `${fmt(p.side)} mm mean side`;
    const row = (name, number, unit, dp = 3, electrical = false) => [name, electrical && !supported ? '—' : fmt(number, dp), unit];
    const rows = [row('Copper mass', r.copperMass * 1000, 'g'), row('Core mass', r.coreMass * 1000, 'g'), row('Total material mass', r.mass * 1000, 'g'),
      row('Copper volume', r.volume * 1e6, 'cm³'), row('Mean turn length', r.turnLength * 1000, 'mm'), row('Magnetic area S', r.area * 1e6, 'mm²'),
      row('Turn count (continuous)', r.turns, 'turns', 2, true), row('Wire length', r.wireLength, 'm', 2, true), row('Resistance', r.resistance, 'Ω', 2, true)];
    if (kind === 'rod') rows.push(row('Demagnetization factor Nd', r.nd, '—', 6), row('Core gain K', r.gain, '—', 3), row('Saturation moment (source estimate)', r.saturationMoment, 'A·m²', 3), row('Target / saturation estimate', 100 * p.moment / r.saturationMoment, '%', 2));
    $('detailBody').innerHTML = rows.map(([name, number, unit]) => `<tr><td>${name}</td><td>${number}</td><td>${unit}</td></tr>`).join('');
    const voltages = [...new Set([1.5, 2.5, 3.3, 5, 8, p.voltage])].sort((a, b) => a - b);
    $('voltageBody').innerHTML = voltages.map(voltage => {
      const option = calculate(kind, {...p, voltage});
      return `<tr${voltage === p.voltage ? ' class="is-selected"' : ''}><td>${fmt(voltage)}</td>${supported ? `<td>${fmt(option.diameter * 1000, 4)}</td><td>${fmt(option.turns, 2)}</td><td>${fmt(option.current * 1000, 2)}</td><td>${fmt(option.resistance, 2)}</td>` : '<td>—</td><td>—</td><td>—</td><td>—</td>'}</tr>`;
    }).join('');
    drawGeometry(p, r); drawTradeoff(p, r);
  }
  const text = (x, y, content, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${content}</text>`;
  function dimension(x1, y1, x2, y2, label, tx, ty) {
    return `<path d="M${x1} ${y1}L${x2} ${y2}" class="coil-axis"/><path d="M${x1-4} ${y1-4}l8 8M${x2-4} ${y2-4}l8 8" class="coil-axis"/>${text(tx, ty, label)}`;
  }
  function drawGeometry(p, r) {
    let svg = '';
    if (kind === 'rod') {
      svg += '<path d="M35 160H525" class="coil-guide"/><rect x="75" y="140" width="410" height="40" rx="3" class="coil-core"/><rect x="145" y="98" width="270" height="42" class="coil-copper"/><rect x="145" y="180" width="270" height="42" class="coil-copper"/>';
      for (let x = 153; x < 414; x += 13) svg += `<path d="M${x} 100v38M${x} 182v38" class="coil-wire"/>`;
      svg += dimension(75, 265, 485, 265, `Core length: ${fmt(p.rodLength)} mm`, 280, 287);
      svg += dimension(145, 66, 415, 66, `Winding: ${fmt(p.windingLength)} mm`, 280, 49);
      svg += text(280, 164, `Core Ø${fmt(p.rodRadius*2)} mm`) + text(280, 244, `Winding outer Ø${fmt(p.outerRadius*2)} mm`, 'muted');
    } else {
      svg += '<path d="M172 57H388V273H172Z M204 89V241H356V89Z" fill-rule="evenodd" class="coil-copper"/><rect x="188" y="73" width="184" height="184" class="coil-guide"/>';
      svg += dimension(188, 30, 372, 30, `Mean side: ${fmt(p.side)} mm`, 280, 17);
      svg += dimension(410, 57, 410, 273, ``, 440, 163);
      svg += text(424, 150, 'Outer side', 'muted', 'start') + text(424, 170, `${fmt(p.side + p.width)} mm`, '', 'start');
      svg += text(280, 146, `Width: ${fmt(p.width)} mm`) + text(280, 168, `Thickness: ${fmt(p.thickness)} mm`) + text(280, 190, `Inner side: ${fmt(p.side-p.width)} mm`, 'muted');
      svg += text(280, 311, `Copper fill: ${fmt(p.fill*100,1)}% · area S = ${fmt(r.area*1e6)} mm²`, 'muted');
    }
    $('geometrySvg').innerHTML = svg;
  }
  function drawTradeoff(p, r) {
    if (r.saturated) { $('tradeoffSvg').innerHTML = text(280, 165, 'Linear model unavailable at this target.'); return; }
    const samples = [];
    for (let i = 0; i <= 100; i++) {
      const scale = 0.4 + i * 0.016;
      const q = {...p};
      if (kind === 'rod') q.outerRadius = Math.sqrt(p.rodRadius ** 2 + scale * (p.outerRadius ** 2 - p.rodRadius ** 2));
      else { q.width = p.width * Math.sqrt(scale); q.thickness = p.thickness * Math.sqrt(scale); }
      const point = calculate(kind, q);
      if (point.valid) samples.push({x: point.copperMass * 1000, y: point.power * 1000});
    }
    if (!samples.length) { $('tradeoffSvg').innerHTML = text(280, 165, 'No valid plot range.'); return; }
    const minX = 0, maxX = Math.max(...samples.map(s => s.x))*1.05;
    const maxY = Math.max(...samples.map(s => s.y))*1.1;
    const x = value => 70 + (value-minX)/(maxX-minX)*455, y = value => 270 - value/maxY*230;
    let svg = '<path d="M70 40V270H525" class="coil-axis"/>';
    for (let i=0; i<=4; i++) {
      const vx = maxX*i/4, vy = maxY*i/4;
      svg += `<path d="M70 ${y(vy)}H525" class="coil-guide"/>` + text(60, y(vy)+4, fmt(vy,1), 'muted', 'end') + text(x(vx), 290, fmt(vx,1), 'muted');
    }
    svg += `<path d="${samples.map((s,i)=>(i?'L':'M')+x(s.x)+' '+y(s.y)).join(' ')}" class="coil-plot"/>`;
    svg += `<circle cx="${x(r.copperMass*1000)}" cy="${y(r.power*1000)}" r="5" class="coil-point"/>`;
    svg += text(78, 23, 'Power (mW)', 'muted', 'start') + text(300, 319, 'Copper mass (g)', 'muted');
    svg += text(515, 23, `Selected: ${fmt(r.copperMass*1000,2)} g / ${fmt(r.power*1000,2)} mW`, 'muted', 'end');
    $('tradeoffSvg').innerHTML = svg;
  }
  renderInputs();
})();
