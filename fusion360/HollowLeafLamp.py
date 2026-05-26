"""
HollowLeafLamp.py  ·  Fusion 360 Python Script
===============================================
Builds a hollow leaf-shaped lamp shade with an LED strip rail
recessed into the inner base perimeter.

HOW TO RUN
  Tools ▸ Scripts and Add-Ins ▸ Scripts ▸ [+] ▸ browse to this file ▸ Run

ADJUSTABLE PARAMETERS  (centimetres unless noted — see block below)
  LEAF_LEN   total tip-to-stem length
  LEAF_W     maximum width at widest point
  LAMP_H     extrusion height of lamp body
  WALL_T     shell wall thickness
  RAIL_W     LED channel width  (12.5 mm clears a standard 10 mm LED strip)
  RAIL_D     LED channel depth  (must be < WALL_T)
  CABLE_W    width of cable routing notch at base
  N_PTS      spline control-point count per half (more = smoother curve)

PRINT SETTINGS (suggested)
  Material : translucent PETG or white resin (light diffusion)
  Layer h  : 0.15 mm
  Walls    : 3 perimeters
  Infill   : 0 % (body is already hollow)
  Supports : none needed (open-top shell)
"""

import adsk.core
import adsk.fusion
import traceback
import math

# ── Tuneable parameters ──────────────────────────────────────────────────────
LEAF_LEN  = 20.0   # cm  tip-to-base length
LEAF_W    = 11.0   # cm  maximum width
LAMP_H    =  9.0   # cm  lamp shade height
WALL_T    =  0.35  # cm  shell wall thickness  (3.5 mm)
RAIL_W    =  1.25  # cm  LED channel width     (12.5 mm)
RAIL_D    =  0.20  # cm  LED channel depth     (2.0 mm)
CABLE_W   =  0.60  # cm  cable notch width at base stem
N_PTS     = 14     # spline points per half-leaf (tip → base)
# ────────────────────────────────────────────────────────────────────────────


def _pt(x, y, z=0.0):
    return adsk.core.Point3D.create(x, y, z)


def _col(pts):
    c = adsk.core.ObjectCollection.create()
    for p in pts:
        c.add(p)
    return c


def leaf_right_side(n, length, width):
    """
    Returns n+1 Point3D objects for the RIGHT half of the leaf outline.
    Parametric: t=0 → tip (0, +length/2),  t=1 → base (0, -length/2).
    Width envelope: sin-bell, peak at t≈0.42 (slightly above mid-leaf).
    """
    pts = []
    for i in range(n + 1):
        t = i / n
        y = length / 2.0 * (1.0 - 2.0 * t)
        # Organic bell — wider toward the top half of the leaf
        x = (width / 2.0) * math.sin(math.pi * t) * (1.05 - 0.35 * t)
        pts.append(_pt(x, y))
    return pts


def add_leaf_splines(sk, right_pts):
    """
    Adds two open splines (right half + mirror-left half) to sketch sk.
    Endpoints at tip (0, +L/2) and base (0, -L/2) share the same X=0
    coordinate on both halves, so Fusion 360 will recognise a closed profile.
    Returns (right_spline, left_spline).
    """
    sp = sk.sketchCurves.sketchFittedSplines
    left_pts = [_pt(-p.x, p.y) for p in right_pts]
    r = sp.add(_col(right_pts))
    l = sp.add(_col(left_pts))
    return r, l


def scaled_right(right_pts, leaf_w, target_half_r):
    """Scale right_pts so the half-width maps to target_half_r."""
    s = target_half_r / (leaf_w / 2.0)
    return [_pt(p.x * s, p.y * s) for p in right_pts]


def run(context):
    ui = None
    try:
        app    = adsk.core.Application.get()
        ui     = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        root   = design.rootComponent

        extrudes = root.features.extrudeFeatures
        shells   = root.features.shellFeatures
        cplanes  = root.constructionPlanes
        xYPlane  = root.xYConstructionPlane

        # ── 1. Outer leaf profile ─────────────────────────────────────────────
        right_pts = leaf_right_side(N_PTS, LEAF_LEN, LEAF_W)

        sk_outer = root.sketches.add(xYPlane)
        sk_outer.name = "Leaf Outer Profile"
        add_leaf_splines(sk_outer, right_pts)

        profs = sk_outer.profiles
        if profs.count == 0:
            ui.messageBox(
                "No closed profile found in the leaf sketch.\n\n"
                "The two spline halves did not produce a closed loop.\n"
                "Open the 'Leaf Outer Profile' sketch and add Coincident\n"
                "constraints between the tip endpoints and the base endpoints."
            )
            return

        # ── 2. Extrude to lamp height ─────────────────────────────────────────
        ei = extrudes.createInput(
            profs.item(0),
            adsk.fusion.FeatureOperations.NewBodyFeatureOperation,
        )
        ei.setDistanceExtent(False, adsk.core.ValueInput.createByReal(LAMP_H))
        lamp_body = extrudes.add(ei).bodies.item(0)
        lamp_body.name = "Leaf Lamp"

        # ── 3. Shell — hollow body, top face open ─────────────────────────────
        max_z = lamp_body.boundingBox.maxPoint.z
        top_face = None
        for face in lamp_body.faces:
            bb = face.boundingBox
            if abs(bb.minPoint.z - max_z) < 0.001 and abs(bb.maxPoint.z - max_z) < 0.001:
                top_face = face
                break

        if top_face is None:
            ui.messageBox("Could not identify the top face for the shell operation.")
            return

        open_faces = adsk.core.ObjectCollection.create()
        open_faces.add(top_face)
        shi = shells.createInput(open_faces, False)
        shi.insideThickness = adsk.core.ValueInput.createByReal(WALL_T)
        shells.add(shi)

        # ── 4. LED rail groove in the inner floor ────────────────────────────
        # After shelling, the inner floor surface sits at z = WALL_T.
        # We cut two concentric leaf-shaped splines to define an annular
        # trough that follows the inner wall perimeter.
        #
        #   [outer wall]  ← WALL_T →  [inner wall face]
        #                               ↑ 0.5 mm gap
        #                              [rail outer edge]
        #                              ← RAIL_W →
        #                              [rail inner edge]

        half_w       = LEAF_W / 2.0
        inner_half_r = half_w - WALL_T          # inner wall surface radius
        rail_out_r   = inner_half_r - 0.05      # 0.5 mm clearance gap
        rail_in_r    = rail_out_r - RAIL_W

        if rail_in_r <= 0.5:
            ui.messageBox(
                f"LED rail inner radius is too small ({rail_in_r:.2f} cm).\n"
                f"Reduce RAIL_W (currently {RAIL_W} cm) or WALL_T ({WALL_T} cm)."
            )
            return

        # Plane at z = WALL_T (inner floor level)
        pli = cplanes.createInput()
        pli.setByOffset(xYPlane, adsk.core.ValueInput.createByReal(WALL_T))
        floor_plane = cplanes.add(pli)

        sk_rail = root.sketches.add(floor_plane)
        sk_rail.name = "LED Rail Profile"
        add_leaf_splines(sk_rail, scaled_right(right_pts, LEAF_W, rail_out_r))
        add_leaf_splines(sk_rail, scaled_right(right_pts, LEAF_W, rail_in_r))

        # Fusion detects the annular profile between the two closed loops.
        # With 4 splines (two outer halves + two inner halves), there will be
        # multiple profiles; pick the annular one (area between loops).
        rail_profs = sk_rail.profiles
        annular_prof = None
        min_area_diff = float("inf")
        # The annular profile has intermediate area — not the smallest (inner) or
        # largest (outer). With two loops Fusion may just give us two profiles.
        for i in range(rail_profs.count):
            p = rail_profs.item(i)
            # A rough heuristic: annular profile encloses area of the ring
            bb = p.boundingBox
            area = (bb.maxPoint.x - bb.minPoint.x) * (bb.maxPoint.y - bb.minPoint.y)
            # Pick the profile whose bounding-box matches the rail_out_r ring
            expected_w = 2.0 * rail_out_r
            diff = abs((bb.maxPoint.x - bb.minPoint.x) - expected_w)
            if diff < min_area_diff:
                min_area_diff = diff
                annular_prof = p

        if annular_prof:
            ci = extrudes.createInput(
                annular_prof,
                adsk.fusion.FeatureOperations.CutFeatureOperation,
            )
            # Cut downward into the floor by RAIL_D
            ci.setDistanceExtent(
                False, adsk.core.ValueInput.createByReal(-RAIL_D)
            )
            extrudes.add(ci)

        # ── 5. Cable routing notch at the base stem ───────────────────────────
        # A rectangular slot through the bottom wall at the stem (Y = -LEAF_LEN/2)
        # so the LED strip cable exits cleanly.
        cable_sketch_plane = root.xZConstructionPlane  # XZ plane for a side profile

        sk_cable = root.sketches.add(floor_plane)
        sk_cable.name = "Cable Notch"
        lines = sk_cable.sketchCurves.sketchLines

        cx   = 0.0
        cy   = -(LEAF_LEN / 2.0 - WALL_T / 2.0)   # stem centre on inner floor
        hw   = CABLE_W / 2.0
        hd   = WALL_T * 0.8                          # notch depth (into wall)

        # Rectangle for the cable notch
        lines.addTwoPointRectangle(
            _pt(cx - hw, cy - WALL_T),
            _pt(cx + hw, cy + hd),
        )

        cable_profs = sk_cable.profiles
        if cable_profs.count > 0:
            cut_cable = extrudes.createInput(
                cable_profs.item(0),
                adsk.fusion.FeatureOperations.CutFeatureOperation,
            )
            cut_cable.setDistanceExtent(
                False, adsk.core.ValueInput.createByReal(-(WALL_T + 0.1))
            )
            extrudes.add(cut_cable)

        # ── Done ─────────────────────────────────────────────────────────────
        ui.messageBox(
            "Hollow Leaf Lamp created successfully!\n\n"
            f"  Leaf       : {LEAF_LEN} × {LEAF_W} cm\n"
            f"  Height     : {LAMP_H} cm\n"
            f"  Wall       : {WALL_T * 10:.1f} mm\n"
            f"  LED rail   : {RAIL_W * 10:.0f} mm wide × {RAIL_D * 10:.0f} mm deep\n"
            f"  Cable notch: {CABLE_W * 10:.0f} mm at base stem\n\n"
            "Fit a 10 mm self-adhesive LED strip into the perimeter rail.\n"
            "Route the cable through the stem notch.\n"
            "Print in translucent PETG or white resin for best light diffusion."
        )

    except Exception:
        if ui:
            ui.messageBox("Script error:\n" + traceback.format_exc())
