# Magnetorquer calculator

Static page with separate rod-coil and square air-coil calculators. Enter the target magnetic dipole moment, winding dimensions, fill factor, supply voltage and material properties. Results update live: electrical power, material mass, current, ideal bare-wire diameter, turns, resistance and wire length.

## Use and hosting

Open `index.html` directly in a current browser, or serve this folder as a static site. The page uses plain HTML, CSS and JavaScript; it needs no build, server backend, package installation, CDN or external font. All assets and reference links are relative, so it can run at an account root or within a repository subfolder.

For GitHub Pages, copy the extracted files into the directory served by the destination repository. Keep `index.html`, both CSS files and both JavaScript files together, and retain the `references` folder. `.nojekyll` is included. The ZIP does not contain an account name, custom-domain file, deployment credentials or Git history. Nothing has been committed or published as part of creating this package.

## Template

The provided `absorber_tab_kit.zip` contains Markdown specifications, rather than HTML/CSS. Its README identifies the reference page as https://m0bx.github.io/absorber/ and says source is required for implementation. The original `absorber/styles.css` was retrieved from https://github.com/m0bx/m0bx.github.io and is included unchanged (blob f8166c577781ebd015870e397ed7bf824e1513b3). The tab row, sidebar, inputs, summary cards, diagrams, tables and method disclosure reuse the original classes and visual tokens.

The dark top bar, brand mark and theme switch are absent. The page opens in the template's light theme. `page.css` provides only calculator-specific layout/drawings, removes the missing header's 64 px sidebar offset and retains unit capitalization. The template's dark palette remains in the original stylesheet but is not activated by this page.

## Calculation basis

The three supplied technical sources are included verbatim under `references/`:

| Source | Used for |
| --- | --- |
| `magnetorquer_navrh-2.pdf` | Square air-coil moment, resistance and power derivation, especially equation (5) |
| `core_magnetorquer_navrh.pdf` | Rod demagnetization, effective gain, mean turn length and power, especially equations (7)-(12) |
| `rod_magnetorquer_sweep.py` | Numeric material defaults, copper fill, mean radius, wire sizing, turns and rough saturation estimate |

Internally, all geometry uses metres, power watts, mass kilograms, electrical resistivity ohm-metres and density kilograms per cubic metre. The UI accepts millimetres and shows power in milliwatts and mass in grams.

Using m for target magnetic moment, rho for electrical resistivity, V for **copper-only volume**, S for magnetic area, ell for mean turn length, K for magnetic gain and U for supply voltage:

```
P = rho * m^2 * ell^2 / (V * S^2 * K^2)
a = rho * m * ell / (S * K * U)
d = 2 * sqrt(a / pi)
N = V / (ell * a)
wire_length = N * ell
R = rho * wire_length / a
I = U / R
material_mass = copper_density * V + core_density * Vcore
```

Rod model, with r the core radius, ro the winding outer radius, L the core length, Lw the winding length, k the fill factor and mur the relative core permeability:

```
S = pi * r^2
Vcore = S * L
rmean = (ro + r) / 2
ell = 2 * pi * rmean
V = pi * (ro^2 - r^2) * Lw * k
Nd = 4 * (ln(L/r) - 1) / ((L/r)^2 - 4 * ln(L/r))
K = 1 + (mur - 1) / (1 + (mur - 1) * Nd)
msat = Bsat * Vcore / mu0
mu0 = 4e-7 * pi
```

The rod PDF sometimes calls rmean a diameter, but its equation uses `2*pi*rmean`; the supplied Python explicitly defines a **mean radius**. This implementation follows the Python consistently.

Square air model, with s the mean coil side, w the in-plane winding width and t the out-of-plane pack thickness:

```
S = s^2
ell = 4*s
V = 4*s*w*t*k
K = 1
Vcore = 0
P = 16*rho*m^2 / (V*S)
```

The square annular envelope volume is `[(s+w)^2 - (s-w)^2]*t = 4*s*w*t`. Every turn uses the mean area s^2, as in the source approximation. The air PDF has no numeric example; the UI's 80 mm side and 5 by 5 mm pack are editable example geometry. The rod winding outer radius starts at 6 mm; other rod defaults follow the supplied script. Both examples use a 0.25 A*m^2 target and 3.3 V sizing voltage.

## Limits and interpretation

Power is steady-state copper dissipation at the target dipole moment for a continuously sized winding. Changing voltage in this calculator redesigns wire area and turn count while retaining copper volume; power and mass therefore stay fixed. It is not a voltage sweep of a physically fixed winding. The voltage-options table makes the same independent redesign for every row.

Mass includes copper and, for the rod model, the magnetic core. Insulation, bobbin, mounts, driver and harness are excluded. Wire dimensions, turn counts and pack filling are ideal continuous estimates; available insulated wire and integer turns require a separate realization check. The code warns when the calculated bare wire does not fit within the winding depth or when fewer than one turn is returned. Temperature dependence, temperature rise, inductance/transients, driver loss, hysteresis, remanence and end effects are not modeled.

The supplied demagnetization approximation is rejected when L/r <= e, where it no longer gives a positive factor; Nd must also be between zero and one. A warning below L/r = 10 is a conservative geometry caution chosen for this implementation, not a source-validated accuracy boundary. Saturation moment follows the script's rough `Bsat*Vcore/mu0` estimate. At or above it, the UI shows mass and geometry but suppresses linear power, wire and current outputs. A measured material B-H curve and magnetic model are needed for nonlinear behavior.

The power/mass plot varies copper volume from 0.4 to 2 times the current design. For a rod it varies the outer winding radius at fixed core, winding length and fill. For an air coil it varies width and thickness together at fixed mean side and fill, omitting invalid geometry. Target and material properties stay fixed. Mass on this plot is **copper mass**, not total material mass.

Inputs must be finite and positive, the fill factor must be at most one, rod outer radius must exceed core radius, rod winding length must not exceed core length, relative permeability must be at least one, and the square inner side must remain positive. Invalid inputs clear calculated results rather than displaying a stale design. Each tab retains its values during the session; reset restores only the active tab. No inputs are sent to a server or stored persistently.

## Verification

Run `node --test tests/calculator.test.cjs`. The tests compare the rod default against values evaluated from the supplied Python functions, reproduce the air-PDF equation, reconstruct moment/volume/DC power independently, and check voltage, target and fill scaling, invalid geometry and the saturation flag.

| Default design | Electrical power | Copper mass | Core mass | Total material mass |
| --- | --- | --- | --- | --- |
| Rod, 4 mm core radius, 80 mm core, 6 mm winding outer radius, 55 mm winding | 106.363857 mW | 18.578122 g | 19.301945 g | 37.880068 g |
| Air, 80 mm mean side, 5 mm width, 5 mm thickness | 577.799479 mW | 43.008000 g | 0 g | 43.008000 g |

Both rows use fill 0.6, dipole target 0.25 A*m^2, resistivity 1.775e-8 ohm*m and copper density 8960 kg/m^3. The rod uses relative permeability 400 and core density 4800 kg/m^3.
