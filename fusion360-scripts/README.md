# Leaf Lamp — Fusion 360 Scripts

Two parametric bodies for an LED leaf lamp. Run each script via
**Fusion 360 → Tools → Scripts and Add-Ins → Run**.

---

## 1. `leaf_shell.py` — Hollow Leaf Casing

| Parameter | Value |
|-----------|-------|
| Height | 195 mm |
| Max width | 80 mm |
| Wall thickness | 1.6 mm |
| Front dome height | 6 mm |
| Centre rib | 4 mm wide, 1.5 mm proud |
| Base | Open (15 mm cut) |
| Back | Flat (print without supports) |

**Print orientation:** flat back face down, no supports.

---

## 2. `led_rail.py` — Inner LED Carrier

| Parameter | Value |
|-----------|-------|
| Height | 180 mm (fits inside shell) |
| Width | 74 mm (3 mm clearance each side) |
| Thickness | 4 mm |
| LED groove | 10 mm wide × 3 mm deep, full length |
| Cable foot | 15 mm below body, 5 mm hole |
| Retention tabs | 2 mm proud, friction fit |

**Print orientation:** flat (groove face up), no supports needed.

---

## Assembly

1. Solder/connect LED strip into the groove on the rail.
2. Route cable through the foot hole.
3. Slide rail up into shell from the open bottom — retention tabs click into place.
4. LED strip faces the front dome; light difuses through the 1.6 mm walls.
