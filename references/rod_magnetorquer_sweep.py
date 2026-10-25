"""
Interaktivni 3D graf pro navrh tycoveho magnetorqueru.

Plocha:  prumer vodice d(U, r_Cu), obarvena prikonem P
Posuvniky: dipol mu, delka vinuti l_cu, cilovy prikon P
Cervena krivka na plose = mnozina bodu, kde prikon odpovida cilovemu P.

Spusteni:  python magnetorquer_sweep.py
Zavislosti: numpy, matplotlib
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.widgets import Slider
from matplotlib import cm

# ----------------------------------------------------------------------
# KONSTANTY NAVRHU  (uprav podle sveho jadra)
# ----------------------------------------------------------------------
RHO    = 1.775e-8     # rezistivita medi [ohm*m]
KFILL  = 0.6          # cinitel plneni vinuti
MIR    = 400          # relativni permeabilita jadra (mu_i feritu)
R_ROD  = 0.004        # polomer jadra [m]
L_ROD  = 0.080        # delka jadra [m]
RHO_CU = 8960         # hustota medi [kg/m3]
B_SAT  = 0.38         # saturacni indukce jadra [T]
MU0    = 4e-7 * np.pi # permeabilita vakua 
DENS_ROD = 4800       # hustota jadra

S_ROD = np.pi * R_ROD**2
V_ROD = S_ROD * L_ROD


def demag_factor(l_rod: float, r_rod: float) -> float:
    """Demagnetizacni faktor valcove tyce (l/r forma)."""
    lr = l_rod / r_rod
    return 4.0 * (np.log(lr) - 1.0) / (lr**2 - 4.0 * np.log(lr))


ND = demag_factor(L_ROD, R_ROD)
K  = 1.0 + (MIR - 1.0) / (1.0 + (MIR - 1.0) * ND)   # zkoseni demagnetizaci


# ----------------------------------------------------------------------
# NAVRHOVE VZTAHY
# ----------------------------------------------------------------------
def r_mean(r_cu):
    return (r_cu + R_ROD) / 2.0


def v_copper(r_cu, l_cu):
    return np.pi * (r_cu**2 - R_ROD**2) * l_cu * KFILL


def wire_area(U, r_cu, mu):
    """Prurez vodice: a = rho*mu*l_z / (k*S_j*U).  Nezavisi na objemu medi."""
    return 2.0 * np.pi * r_mean(r_cu) * mu * RHO / (S_ROD * U * K)


def wire_diameter(U, r_cu, mu):
    return 2.0 * np.sqrt(wire_area(U, r_cu, mu) / np.pi)


def power(r_cu, l_cu, mu):
    """Prikon: P = rho*mu^2*l_z^2 / (V_Cu*S_j^2*k^2).  Nezavisi na napeti."""
    lz = 2.0 * np.pi * r_mean(r_cu)
    return RHO * mu**2 * lz**2 / (v_copper(r_cu, l_cu) * S_ROD**2 * K**2)


def turns(U, r_cu, l_cu, mu):
    return v_copper(r_cu, l_cu) / (2.0 * np.pi * r_mean(r_cu) * wire_area(U, r_cu, mu))


def r_cu_for_power(P_target, l_cu, mu):
    """
    P(x) = C*(x+r0)/(x-r0)  s  C = rho*mu^2*pi/(l_cu*kfill*S_j^2*k^2)
    => x = r0*(P+C)/(P-C).   Vraci None, kdyz je cil pod asymptotou C.
    """
    C = RHO * mu**2 * np.pi / (l_cu * KFILL * S_ROD**2 * K**2)
    if P_target <= C:
        return None, C
    return R_ROD * (P_target + C) / (P_target - C), C


def m_saturation():
    return B_SAT * V_ROD / MU0



# ----------------------------------------------------------------------
# VYCHOZI HODNOTY A MRIZKA
# ----------------------------------------------------------------------
MU0_DEF   = 0.25      # dipol [A*m2]
LCU_DEF   = 0.055     # delka vinuti [m]
PTGT_DEF  = 0.150     # cilovy prikon [W]

U_MIN,  U_MAX  = 1.0, 12.0
RC_MIN, RC_MAX = R_ROD * 1.15, 0.012

N_GRID = 70
U_grid  = np.linspace(U_MIN, U_MAX, N_GRID)
RC_grid = np.linspace(RC_MIN, RC_MAX, N_GRID)
UU, RR = np.meshgrid(U_grid, RC_grid)


# ----------------------------------------------------------------------
# FIGURA
# ----------------------------------------------------------------------
fig = plt.figure(figsize=(14, 8))
ax  = fig.add_axes([0.02, 0.22, 0.66, 0.72], projection="3d")
cax = fig.add_axes([0.655, 0.32, 0.015, 0.40])

state = {"surf": None, "line": None}


def draw(mu, l_cu, P_target):
    for key in ("surf", "line"):
        if state[key] is not None:
            try:
                state[key].remove()
            except Exception:
                pass
            state[key] = None

    D = wire_diameter(UU, RR, mu) * 1e3          # mm
    P = power(RR, l_cu, mu) * 1e3                # mW

    norm   = plt.Normalize(P.min(), P.max())
    colors = cm.viridis(norm(P))

    state["surf"] = ax.plot_surface(
        UU, RR * 1e3, D,
        facecolors=colors, rstride=1, cstride=1,
        linewidth=0, antialiased=True, shade=False, alpha=0.95,
    )

    # krivka konstantniho prikonu
    rc_star, C = r_cu_for_power(P_target, l_cu, mu)
    if rc_star is not None and RC_MIN <= rc_star <= RC_MAX:
        d_line = wire_diameter(U_grid, rc_star, mu) * 1e3
        state["line"], = ax.plot(
            U_grid, np.full_like(U_grid, rc_star * 1e3), d_line,
            color="red", lw=3.0, zorder=10,
        )
        note = f"P = {P_target*1e3:.0f} mW  ->  r_Cu = {rc_star*1e3:.2f} mm"
    elif rc_star is None:
        note = f"P = {P_target*1e3:.0f} mW je pod asymptotou {C*1e3:.0f} mW (nedosazitelne)"
    else:
        note = f"P = {P_target*1e3:.0f} mW  ->  r_Cu = {rc_star*1e3:.2f} mm (mimo rozsah)"

    ax.set_xlabel("napeti U [V]", labelpad=10)
    ax.set_ylabel("polomer vinuti r_Cu [mm]", labelpad=10)
    ax.set_zlabel("prumer vodice d [mm]", labelpad=10)
    ax.set_title("Prumer vodice d(U, r_Cu),  barva = prikon", pad=4, fontsize=11)

    cax.clear()
    cb = plt.colorbar(cm.ScalarMappable(norm=norm, cmap="viridis"),
                      cax=cax)
    cb.set_label("prikon P [mW]", fontsize=9)
    cax.tick_params(labelsize=8)

    # textovy vypis v pracovnim bode
    if rc_star is not None and RC_MIN <= rc_star <= RC_MAX:
        lines = [note, "", f"{'U [V]':>6} {'d [mm]':>8} {'N':>7} {'I [mA]':>8} {'R [ohm]':>9}"]
        for Uv in (1.5, 2.5, 3.3, 5.0, 8.0):
            d  = wire_diameter(Uv, rc_star, mu) * 1e3
            Nt = turns(Uv, rc_star, l_cu, mu)
            I  = P_target / Uv
            Rr = Uv / I
            lines.append(f"{Uv:6.1f} {d:8.3f} {Nt:7.0f} {I*1e3:8.2f} {Rr:9.1f}")
        g = v_copper(rc_star, l_cu) * RHO_CU * 1e3
        g_rod = np.pi * R_ROD **2 * L_ROD * DENS_ROD * 1e3
        lines += ["", f"med: {g:.1f} g",
                      f"jadro: {g_rod:.1f} g",
                  f"saturace pri m = {m_saturation():.2f} A.m2",
                  f"vyuziti: {100*mu/m_saturation():.0f} %"]
    else:
        lines = [note]

    txt.set_text("\n".join(lines))
    fig.canvas.draw_idle()


txt = fig.text(0.715, 0.90, "", va="top", ha="left",
               family="monospace", fontsize=9.5)

ax_mu = fig.add_axes([0.14, 0.115, 0.58, 0.025])
ax_lc = fig.add_axes([0.14, 0.072, 0.58, 0.025])
ax_pt = fig.add_axes([0.14, 0.029, 0.58, 0.025])

s_mu = Slider(ax_mu, "dipol mu [A.m2]", 0.05, 1.00, valinit=MU0_DEF,  valstep=0.01)
s_lc = Slider(ax_lc, "delka vinuti [mm]", 20.0, 80.0, valinit=LCU_DEF*1e3, valstep=1.0)
s_pt = Slider(ax_pt, "cilovy prikon [mW]", 10.0, 600.0, valinit=PTGT_DEF*1e3, valstep=5.0)


def on_change(_):
    draw(s_mu.val, s_lc.val / 1e3, s_pt.val / 1e3)


for s in (s_mu, s_lc, s_pt):
    s.on_changed(on_change)

draw(MU0_DEF, LCU_DEF, PTGT_DEF)
ax.view_init(elev=24, azim=-128)

if __name__ == "__main__":
    plt.show()
