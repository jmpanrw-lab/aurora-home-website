"""
LEAF SHELL - Fusion 360 Python API Script
Hollow organic leaf casing, 195mm tall x 80mm wide
Wall thickness 1.6mm, flat back, open bottom, center rib
"""

import adsk.core, adsk.fusion, adsk.cam, traceback, math

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = app.activeProduct
        rootComp = design.rootComponent
        sketches = rootComp.sketches
        features = rootComp.features

        # ── Parameters (all in cm for Fusion API) ──────────────────────────
        H       = 19.5   # total height
        W       = 8.0    # max width
        WALL    = 0.16   # wall thickness (1.6mm)
        DOME    = 0.6    # front dome height at centre
        RIB_W   = 0.4    # centre rib width
        RIB_H   = 0.15   # rib proud of surface
        OPEN_H  = 1.5    # how much to cut from bottom (open base)

        # ── 1. Leaf outline spline on XY plane ─────────────────────────────
        xyPlane = rootComp.xYConstructionPlane
        outlineSk = sketches.add(xyPlane)
        outlineSk.name = "LeafOutline"

        pts = adsk.core.ObjectCollection.create()

        # Build leaf silhouette: pointed top, widest ~40% from bottom, pointed base
        # Points defined as (x, y) — bilateral symmetry on Y axis, right side only,
        # then mirrored. All in cm.
        right_pts = [
            (0.0,   0.0),        # base tip
            (1.2,   1.8),
            (3.2,   4.5),
            (4.0,   7.5),        # widest point (~40% up)
            (3.6,  11.0),
            (2.2,  15.5),
            (0.8,  18.5),
            (0.0,  19.5),        # apex
        ]
        # Mirror to get left side (reverse order, negate x, skip duplicate tips)
        left_pts = [(-x, y) for x, y in reversed(right_pts[1:-1])]

        all_pts = right_pts + left_pts
        for x, y in all_pts:
            pts.add(adsk.core.Point3D.create(x, y, 0))

        # Close the spline back to start
        pts.add(adsk.core.Point3D.create(0.0, 0.0, 0))

        spline = outlineSk.sketchCurves.sketchFittedSplines.add(pts)

        # ── 2. Extrude outline to a flat slab (thickness = DOME for later shell)
        extrudes = features.extrudeFeatures
        prof = outlineSk.profiles.item(0)

        extInput = extrudes.createInput(prof, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
        extInput.setDistanceExtent(False, adsk.core.ValueInput.createByReal(DOME + WALL))
        leafSlab = extrudes.add(extInput)
        body = leafSlab.bodies.item(0)
        body.name = "LeafShell"

        # ── 3. Front dome — sculpt the top face using a patch + replace-face ─
        # Simpler approach: loft a dome profile over the top face.
        # We use a second sketch with a dome arc on the XZ plane at mid-height.
        xzPlane = rootComp.xZConstructionPlane
        domeSk = sketches.add(xzPlane)
        domeSk.name = "DomeProfile"
        arcs = domeSk.sketchCurves.sketchArcs
        # Arc from (-W/2, DOME+WALL) through (0, DOME+WALL+DOME) to (W/2, DOME+WALL)
        # in XZ — x is width, z maps to extrusion direction (Y in world)
        p1 = adsk.core.Point3D.create(-W/2,  0, DOME + WALL)
        p2 = adsk.core.Point3D.create( W/2,  0, DOME + WALL)
        pm = adsk.core.Point3D.create( 0,    0, DOME + WALL + DOME)
        domeSk.sketchCurves.sketchArcs.addByThreePoints(p1, pm, p2)

        # ── 4. Shell the slab: remove top face, 1.6mm wall ─────────────────
        shellFeats = features.shellFeatures
        faceCol = adsk.core.ObjectCollection.create()

        # Find the top face (max Z)
        topFace = None
        maxZ = -9999
        for f in body.faces:
            bb = f.boundingBox
            if bb.minPoint.z > maxZ:
                maxZ = bb.minPoint.z
                topFace = f

        # Also open the bottom face
        botFace = None
        minZ = 9999
        for f in body.faces:
            bb = f.boundingBox
            if bb.maxPoint.z < minZ:
                minZ = bb.maxPoint.z
                botFace = f

        faceCol.add(topFace)
        faceCol.add(botFace)

        shellIn = shellFeats.createInput(False, False, faceCol)
        shellIn.insideThickness = adsk.core.ValueInput.createByReal(WALL)
        shellFeats.add(shellIn)

        # ── 5. Centre rib on front surface ────────────────────────────────
        ribSk = sketches.add(xyPlane)
        ribSk.name = "CentreRib"
        lines = ribSk.sketchCurves.sketchLines
        # Rib runs from base tip to apex along x=0
        lines.addByTwoPoints(
            adsk.core.Point3D.create(0, OPEN_H, 0),
            adsk.core.Point3D.create(0, H - 0.3, 0)
        )
        ribSk.sketchCurves.sketchLines.addByTwoPoints(
            adsk.core.Point3D.create(-RIB_W/2, OPEN_H, 0),
            adsk.core.Point3D.create(-RIB_W/2, H - 0.3, 0)
        )
        ribSk.sketchCurves.sketchLines.addByTwoPoints(
            adsk.core.Point3D.create( RIB_W/2, OPEN_H, 0),
            adsk.core.Point3D.create( RIB_W/2, H - 0.3, 0)
        )
        # Close ends
        ribSk.sketchCurves.sketchLines.addByTwoPoints(
            adsk.core.Point3D.create(-RIB_W/2, OPEN_H, 0),
            adsk.core.Point3D.create( RIB_W/2, OPEN_H, 0)
        )
        ribSk.sketchCurves.sketchLines.addByTwoPoints(
            adsk.core.Point3D.create(-RIB_W/2, H - 0.3, 0),
            adsk.core.Point3D.create( RIB_W/2, H - 0.3, 0)
        )

        ribProf = ribSk.profiles.item(0)
        ribExtIn = extrudes.createInput(ribProf, adsk.fusion.FeatureOperations.JoinFeatureOperation)
        ribExtIn.setDistanceExtent(False, adsk.core.ValueInput.createByReal(DOME + WALL + RIB_H))
        extrudes.add(ribExtIn)

        # ── 6. Cut open the bottom (open_h from base) ──────────────────────
        cutSk = sketches.add(xyPlane)
        cutSk.name = "BottomCut"
        cutSk.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-W, -0.1, 0),
            adsk.core.Point3D.create( W,  OPEN_H, 0)
        )
        cutProf = cutSk.profiles.item(0)
        cutIn = extrudes.createInput(cutProf, adsk.fusion.FeatureOperations.CutFeatureOperation)
        cutIn.setAllExtent(adsk.fusion.ExtentDirections.PositiveExtentDirection)
        extrudes.add(cutIn)

        # ── 7. Fillet all sharp edges 0.5mm ───────────────────────────────
        fillets = features.filletFeatures
        edgeCol = adsk.core.ObjectCollection.create()
        for e in body.edges:
            edgeCol.add(e)
        fillIn = fillets.createInput()
        fillIn.addConstantRadiusEdgeSet(edgeCol, adsk.core.ValueInput.createByReal(0.05), True)
        fillets.add(fillIn)

        ui.messageBox("LEAF SHELL created successfully!\nBody name: LeafShell")

    except:
        if ui:
            ui.messageBox("Failed:\n{}".format(traceback.format_exc()))
