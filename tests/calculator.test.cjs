const {test} = require('node:test');
const assert = require('node:assert/strict');
const {calculate, defaults} = require('../calculator.js');
const near = (a, b, tolerance = 1e-11) => assert.ok(Math.abs(a-b) <= tolerance * Math.max(Math.abs(b), 1e-12), `${a} != ${b}`);

test('rod default agrees with the supplied Python functions', () => {
  const r = calculate('rod', defaults.rod);
  assert.equal(r.valid, true);
  const reference = {power: 0.1063638570912456, diameter: 0.00015537088884176332,
    turns: 3481.086008430192, copperMass: 0.018578122316268604,
    coreMass: 0.01930194526365569, gain: 44.32770650369886,
    nd: 0.020573654338404947, saturationMoment: 1.216};
  for (const [key, expected] of Object.entries(reference)) near(r[key], expected);
});

test('air default reproduces P = 16 rho m^2 / (V S) and copper density mass', () => {
  const r = calculate('air', defaults.air);
  assert.equal(r.valid, true);
  near(r.volume, 4.8e-6);
  near(r.area, 0.0064);
  near(r.power, 0.5777994791666666);
  near(r.mass, 0.043008);
  assert.equal(r.coreMass, 0);
  assert.equal(r.gain, 1);
});

test('sized wire independently reconstructs target moment, copper volume and DC power', () => {
  for (const kind of ['rod', 'air']) for (const voltage of [1.5, 3.3, 8, 12]) {
    const p = {...defaults[kind], voltage}, r = calculate(kind, p);
    near(r.turns * r.current * r.area * r.gain, p.moment);
    near(r.turns * r.turnLength * r.wireArea, r.volume);
    near(p.voltage * r.current, r.power);
    near(r.current ** 2 * r.resistance, r.power);
    near(r.diameter ** 2 * Math.PI / 4, r.wireArea);
  }
});

test('supply voltage resizes wire and turns without changing ideal power or mass', () => {
  for (const kind of ['rod', 'air']) {
    const p = defaults[kind], base = calculate(kind, p), high = calculate(kind, {...p, voltage: p.voltage * 4});
    near(base.power, high.power); near(base.mass, high.mass);
    near(high.turns, base.turns * 4); near(high.diameter, base.diameter / 2);
  }
});

test('dipole target scales power quadratically, without changing mass', () => {
  for (const kind of ['rod', 'air']) {
    const p = defaults[kind], base = calculate(kind, p), double = calculate(kind, {...p, moment: p.moment * 2});
    near(double.power, base.power * 4); near(double.mass, base.mass);
  }
});

test('copper fill scales copper mass and power reciprocally', () => {
  for (const kind of ['rod', 'air']) {
    const p = defaults[kind], base = calculate(kind, p), half = calculate(kind, {...p, fill: p.fill / 2});
    near(half.copperMass, base.copperMass / 2); near(half.power, base.power * 2);
    near(half.coreMass, base.coreMass);
  }
});

test('invalid geometry and empty or nonfinite input are rejected', () => {
  for (const [kind, patch] of [['rod', {outerRadius: 4}], ['rod', {windingLength: 81}],
    ['rod', {rodLength: 8}], ['rod', {permeability: 0.5}], ['air', {width: 80}],
    ['rod', {voltage: 0}], ['air', {moment: NaN}], ['air', {side: Infinity}], ['air', {fill: 1.01}]]) {
    assert.equal(calculate(kind, {...defaults[kind], ...patch}).valid, false);
  }
});

test('source saturation estimate flags targets at and above the limit', () => {
  const r = calculate('rod', defaults.rod);
  for (const moment of [r.saturationMoment, r.saturationMoment * 1.1]) {
    const limited = calculate('rod', {...defaults.rod, moment});
    assert.equal(limited.saturated, true); assert.ok(limited.warnings.length);
  }
});

test('unrealizable wire has an explicit warning', () => {
  const r = calculate('rod', {...defaults.rod, voltage: 0.001});
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some(warning => warning.includes('wider than the winding space')));
});

test('nonmagnetic rod has unit gain', () => {
  const r = calculate('rod', {...defaults.rod, permeability: 1});
  assert.equal(r.gain, 1);
});
