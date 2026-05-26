"""
LED RAIL - Fusion 360 Python API Script
Inner LED strip carrier, slides into the Leaf Shell from below.
10mm LED groove along centre, flat base for printing, cable foot at bottom.
"""

import adsk.core, adsk.fusion, adsk.cam, traceback

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = app.activeProduct
        rootComp = design.rootComponent
        sketches = rootComp.sketches
        features = rootComp.features

        # ── Parameters (cm) ────────────────────────────────────────────────
        # Leaf shell interior is ~7.68 cm wide (80mm - 2×1.6mm wall)
        # Rail is slightly narrower for sliding clearance
        RAIL_H     = 18.0   # height of rail body (leaf interior ~18 cm usable)
        RAIL_W     = 7.4    # width — 3mm clearance each side inside shell
        RAIL_T     = 0.4    # thickness (4mm) — flat print
        GROOVE_W   = 1.0    # LED groove width (10mm)
        GROOVE_D   = 0.3    # groove depth (3mm)
        FOOT_H     = 1.5    # cable foot protrusion below rail body
        FOOT_W     = 3.0    # foot width
        FOOT_T     = 0.8    # foot thickness
        CHAMFER    = 0.1    # 1mm chamfer on top leading edge for easier insertion
        NOTCH_W    = 0.6    # side notch width for snap/alignment

        xyPlane = rootComp.xYConstructionPlane
        extrudes = features.extrudeFeatures

        # ── 1. Main rail body ──────────────────────────────────────────────
        bodySk = sketches.add(xyPlane)
        bodySk.name = "RailBody"
        bodySk.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-RAIL_W/2, 0,      0),
            adsk.core.Point3D.create( RAIL_W/2, RAIL_H, 0)
        )
        bodyProf = bodySk.profiles.item(0)
        bodyExtIn = extrudes.createInput(bodyProf, adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
        bodyExtIn.setDistanceExtent(False, adsk.core.ValueInput.createByReal(RAIL_T))
        railExt = extrudes.add(bodyExtIn)
        railBody = railExt.bodies.item(0)
        railBody.name = "LEDRail"

        # ── 2. Centre LED groove (cut into top face) ───────────────────────
        grooveSk = sketches.add(xyPlane)
        grooveSk.name = "LEDGroove"
        grooveSk.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-GROOVE_W/2, 0.5,          0),
            adsk.core.Point3D.create( GROOVE_W/2, RAIL_H - 0.5, 0)
        )
        grooveProf = grooveSk.profiles.item(0)
        grooveExtIn = extrudes.createInput(grooveProf, adsk.fusion.FeatureOperations.CutFeatureOperation)
        # Cut from the top surface downward by groove depth
        grooveExtIn.setDistanceExtent(
            False,
            adsk.core.ValueInput.createByReal(GROOVE_D)
        )
        # Start the cut from the top face (offset = RAIL_T, cut downward)
        grooveExtIn.startExtent = adsk.fusion.OffsetStartDefinition.create(
            adsk.core.ValueInput.createByReal(RAIL_T)
        )
        grooveExtIn.setDistanceExtent(True, adsk.core.ValueInput.createByReal(GROOVE_D))
        extrudes.add(grooveExtIn)

        # ── 3. Cable routing foot at the bottom ────────────────────────────
        footSk = sketches.add(xyPlane)
        footSk.name = "CableFoot"
        footSk.sketchCurves.sketchLines.addTwoPointRectangle(
            adsk.core.Point3D.create(-FOOT_W/2, -FOOT_H, 0),
            adsk.core.Point3D.create( FOOT_W/2,  0,      0)
        )
        footProf = footSk.profiles.item(0)
        footExtIn = extrudes.createInput(footProf, adsk.fusion.FeatureOperations.JoinFeatureOperation)
        footExtIn.setDistanceExtent(False, adsk.core.ValueInput.createByReal(FOOT_T))
        extrudes.add(footExtIn)

        # ── 4. Cable hole through foot ─────────────────────────────────────
        cableHoleSk = sketches.add(xyPlane)
        cableHoleSk.name = "CableHole"
        # 5mm diameter hole centred in foot
        circles = cableHoleSk.sketchCurves.sketchCircles
        circles.addByCenterRadius(
            adsk.core.Point3D.create(0, -FOOT_H/2, 0),
            0.25  # 2.5mm radius = 5mm dia
        )
        holeProf = cableHoleSk.profiles.item(0)
        holeExtIn = extrudes.createInput(holeProf, adsk.fusion.FeatureOperations.CutFeatureOperation)
        holeExtIn.setAllExtent(adsk.fusion.ExtentDirections.PositiveExtentDirection)
        extrudes.add(holeExtIn)

        # ── 5. Side retention tabs (x2) for friction fit inside shell ──────
        # Small bumps on each side edge, 3mm wide × 1mm proud, at mid-height
        for side in [-1, 1]:
            tabSk = sketches.add(xyPlane)
            tabSk.name = "RetentionTab_{}".format("L" if side < 0 else "R")
            cx = side * (RAIL_W/2)
            tabSk.sketchCurves.sketchLines.addTwoPointRectangle(
                adsk.core.Point3D.create(cx,               RAIL_H/2 - 0.15, 0),
                adsk.core.Point3D.create(cx + side * 0.1,  RAIL_H/2 + 0.15, 0)
            )
            tabProf = tabSk.profiles.item(0)
            tabExtIn = extrudes.createInput(tabProf, adsk.fusion.FeatureOperations.JoinFeatureOperation)
            tabExtIn.setDistanceExtent(False, adsk.core.ValueInput.createByReal(RAIL_T))
            extrudes.add(tabExtIn)

        # ── 6. Chamfer top leading edge for easy insertion ─────────────────
        chamfers = features.chamferFeatures
        edgeCol = adsk.core.ObjectCollection.create()
        # Top edge of rail (highest Y, on the flat face)
        topY = RAIL_H
        for e in railBody.edges:
            bb = e.boundingBox
            if abs(bb.minPoint.y - topY) < 0.01 and abs(bb.maxPoint.y - topY) < 0.01:
                edgeCol.add(e)
        if edgeCol.count > 0:
            chamIn = chamfers.createInput(edgeCol, True)
            chamIn.setToEqualDistance(adsk.core.ValueInput.createByReal(CHAMFER))
            chamfers.add(chamIn)

        # ── 7. Fillet inner groove corners ─────────────────────────────────
        fillets = features.filletFeatures
        fillEdges = adsk.core.ObjectCollection.create()
        for e in railBody.edges:
            bb = e.boundingBox
            # Edges running along Y inside groove area (small x extent)
            xMid = (bb.minPoint.x + bb.maxPoint.x) / 2
            if abs(xMid) < GROOVE_W/2 + 0.05:
                fillEdges.add(e)
        if fillEdges.count > 0:
            fillIn = fillets.createInput()
            fillIn.addConstantRadiusEdgeSet(fillEdges, adsk.core.ValueInput.createByReal(0.05), True)
            fillets.add(fillIn)

        ui.messageBox("LED RAIL created successfully!\nBody name: LEDRail\n\n"
                      "Slide into the Leaf Shell from below.\n"
                      "Print flat (Z = thickness face down), no supports needed.")

    except:
        if ui:
            ui.messageBox("Failed:\n{}".format(traceback.format_exc()))
