(function (root) {
  'use strict';
  const MU0 = 4e-7 * Math.PI;
  const defaults = {
    rod: {moment: 0.25, voltage: 3.3, rodRadius: 4, rodLength: 80, outerRadius: 6,
      windingLength: 55, fill: 0.6, permeability: 400, saturation: 0.38,
      resistivity: 1.775e-8, copperDensity: 8960, coreDensity: 4800},
    air: {moment: 0.25, voltage: 3.3, side: 80, width: 5, thickness: 5,
      fill: 0.6, resistivity: 1.775e-8, copperDensity: 8960}
  };
  function fail(message) { return {valid: false, error: message}; }
  function calculate(kind, p) {
    if (!['rod', 'air'].includes(kind)) return fail('Choose a coil type.');
    for (const key of Object.keys(defaults[kind])) {
      if (!Number.isFinite(p[key]) || p[key] <= 0) return fail('Enter a positive value for every parameter.');
    }
    if (p.fill > 1) return fail('Winding fill factor must be greater than 0 and at most 1.');
    let volume, turnLength, area, gain = 1, coreVolume = 0, nd = null;
    const warnings = [];
    if (kind === 'rod') {
      const r = p.rodRadius / 1000, outer = p.outerRadius / 1000;
      const length = p.rodLength / 1000, winding = p.windingLength / 1000;
      if (outer <= r) return fail('Outer winding radius must be greater than the core radius.');
      if (winding > length) return fail('Winding length must not exceed the core length.');
      const aspect = length / r;
      if (aspect <= Math.E) return fail('The supplied demagnetization formula requires L / r > e to give a positive factor.');
      nd = 4 * (Math.log(aspect) - 1) / (aspect * aspect - 4 * Math.log(aspect));
      if (!(nd > 0 && nd < 1)) return fail('The supplied demagnetization formula is outside its usable numerical range.');
      if (p.permeability < 1) return fail('Relative core permeability must be at least 1.');
      gain = 1 + (p.permeability - 1) / (1 + (p.permeability - 1) * nd);
      volume = Math.PI * (outer * outer - r * r) * winding * p.fill;
      turnLength = 2 * Math.PI * (outer + r) / 2;
      area = Math.PI * r * r;
      coreVolume = area * length;
      if (aspect < 10) warnings.push('Short core: the supplied demagnetization approximation has no validated accuracy range in the references.');
    } else {
      const side = p.side / 1000, width = p.width / 1000, thickness = p.thickness / 1000;
      if (width >= side) return fail('In-plane winding width must be smaller than the mean coil side.');
      turnLength = 4 * side;
      area = side * side;
      volume = turnLength * width * thickness * p.fill;
    }
    const effectiveArea = area * gain;
    const power = p.resistivity * p.moment ** 2 * turnLength ** 2 / (volume * effectiveArea ** 2);
    const wireArea = p.resistivity * p.moment * turnLength / (effectiveArea * p.voltage);
    const diameter = 2 * Math.sqrt(wireArea / Math.PI);
    const turns = volume / (turnLength * wireArea);
    const wireLength = volume / wireArea;
    const resistance = p.resistivity * wireLength / wireArea;
    const current = p.voltage / resistance;
    const copperMass = volume * p.copperDensity;
    const coreMass = coreVolume * (kind === 'rod' ? p.coreDensity : 0);
    const saturationMoment = kind === 'rod' ? p.saturation * coreVolume / MU0 : null;
    const values = [power, wireArea, diameter, turns, wireLength, resistance, current, copperMass, coreMass];
    if (values.some(v => !Number.isFinite(v)) || values.slice(0, 8).some(v => v <= 0)) {
      return fail('These parameters exceed the numerical range. Use less extreme values.');
    }
    const depth = kind === 'rod' ? p.outerRadius - p.rodRadius : Math.min(p.width, p.thickness);
    if (diameter * 1000 > depth || (kind === 'rod' && diameter * 1000 > p.windingLength)) {
      warnings.push('The ideal bare wire is wider than the winding space. This geometry cannot accommodate that wire.');
    }
    if (turns < 1) warnings.push('The continuous model gives fewer than one turn; this is not a realizable winding.');
    const saturated = saturationMoment !== null && p.moment >= saturationMoment;
    if (saturated) warnings.push('Target reaches or exceeds the source saturation estimate. Linear power and wire-sizing results are unavailable.');
    return {valid: true, kind, power, wireArea, diameter, turns, wireLength, resistance, current,
      copperMass, coreMass, mass: copperMass + coreMass, volume, coreVolume, turnLength,
      area, gain, nd, saturationMoment, saturated, warnings};
  }
  const api = {calculate, defaults, MU0};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Magnetorquer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
