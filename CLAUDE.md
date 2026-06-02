# Aurora Home – Website

## Was ist Aurora Home?

Aurora Home ist das Online-Schaufenster von **Ildiko Fenyes** aus Krefeld – ein Kleingewerbe, das
nebenberuflich in den Abendstunden betrieben wird. Das Sortiment:

- **3D-Deko** (FDM- und Resin-3D-Druck, handgefertigt und -bearbeitet)
- **Premium Wax Melts** (12 Düfte, eigene Farbsystem-Visualisierung)
- **Custom Resin Figuren** (4 Qualitätsstufen, Einzelstücke auf Anfrage)

Kontakt/E-Mail: `fenyesdesign@outlook.com`
Rechtsform: Kleingewerbe § 19 UStG, kein Handelsregistereintrag
Standort: Preussenring 21, 47798 Krefeld

---

## Repo-Struktur

```
aurora-home-website/
├── index.html                   # Finale Website (single file, kein Build nötig)
├── rechtliches.html             # Impressum · DSGVO · AGB
├── sitemap.xml
├── robots.txt
├── netlify.toml                 # Netlify Deploy-Config
│
├── data/                        # DATENQUELLEN — hier werden Änderungen gemacht
│   ├── products.json            # Alle Produkte (Quelle der Wahrheit)
│   └── scents.json              # Alle Wax-Melt-Düfte
│
├── scripts/                     # Helper-Skripte
│   ├── sync.js                  # Synct data/*.json → index.html
│   └── download-image.js        # Lädt Produktbild von URL → assets/
│
├── assets/                      # Alle Produktbilder
│   ├── *.jpg
│   └── workshop/
│       └── *.jpg
│
└── netlify/
    └── functions/
        └── chat.js              # KI-Chat Backend
```

---

## Tech-Stack

Die gesamte Seite ist **ein einziges HTML-File** – kein Build-Prozess, kein Framework, kein npm.

| Was | Wie |
|---|---|
| 3D-Logo | Three.js (inline, CDN), Maus- und Scroll-Parallax |
| Fonts | Google Fonts: Cormorant · Inter · JetBrains Mono |
| KI-Chat | Netlify Function (`netlify/functions/chat.js`) mit Claude API |
| Hosting | GitHub Pages **oder** Netlify (beide unterstützt) |
| Daten | `data/products.json` + `data/scents.json` → `node scripts/sync.js` |

---

## Workflow — Häufige Aufgaben

### Neues Produkt hinzufügen

```bash
# 1. Bild herunterladen (URL vom User)
node scripts/download-image.js <BILD_URL> <dateiname.jpg>

# 2. Produkt in data/products.json eintragen (neues Objekt ans Ende der Liste)
# Pflichtfelder: name, cat, catKey, price, desc, img
# Optional: badge ("bestseller" | "new" | "viral")

# 3. Daten in index.html einlesen
node scripts/sync.js

# 4. Commit + Push
git add assets/<dateiname.jpg> data/products.json index.html
git commit -m "Neues Produkt: <Name>"
git push origin main
```

### catKey-Werte (für Filter):
- `lampe` — Lampen
- `pflanze` — Pflanzer & Gießen
- `aufbewahrung` — Aufbewahrung
- `gadget` — Gadgets (Ladestationen etc.)
- `spiel` — Spiele & Deko
- `bestseller` — als Zusatz zu catKey möglich (Leerzeichen-getrennt)

### Produktpreis oder -beschreibung ändern

```bash
# 1. data/products.json bearbeiten
# 2. node scripts/sync.js
# 3. git add data/products.json index.html && git commit -m "Update: <Name>" && git push
```

### Produkt entfernen

```bash
# 1. Objekt aus data/products.json löschen
# 2. node scripts/sync.js
# 3. git add data/products.json index.html && git commit -m "Entfernt: <Name>" && git push
```

### Neuen Wax-Melt-Duft hinzufügen

```bash
# 1. Objekt in data/scents.json eintragen
# Felder: no, season, name, notes, grad (CSS-Gradient-String)
# Optional: bs: true (= Bestseller)

# 2. node scripts/sync.js
# 3. git add data/scents.json index.html && git commit -m "Neuer Duft: <Name>" && git push
```

### Bestseller-Row (oben) ändern

Die zwei großen Bestseller-Karten oben im Katalog sind **hardcodiert** in `index.html`
(Suche nach `id="bsRow"`). Dort stehen `data-idx` Werte (Index in PRODUCTS-Array).
Bei Änderung: direkt in index.html anpassen, kein sync nötig.

---

## Deployment

**GitHub Pages** (aktuell aktiv):
```
https://jmpanrw-lab.github.io/aurora-home-website/
```

**Netlify** (für Chat-Funktion notwendig):
```
netlify.toml ist fertig konfiguriert – einfach Repo verbinden
ANTHROPIC_API_KEY als Env-Variable setzen
```

---

## Produkt-Objekt Felder

```jsonc
{
  "name":   "Produktname",          // Pflicht — Anzeigename
  "cat":    "Kategorie Anzeige",    // Pflicht — z.B. "Tischlampe & Ablage"
  "catKey": "lampe",                // Pflicht — Filter-Schlüssel (siehe oben)
  "price":  "27,90",               // Pflicht — nur Zahl+Komma, ohne €
  "desc":   "Beschreibung...",      // Pflicht — für Modal-Popup
  "img":    "assets/bild.jpg",     // Pflicht — relativer Pfad
  "badge":  "bestseller"            // Optional — "bestseller" | "new" | "viral"
}
```

## Duft-Objekt Felder

```jsonc
{
  "no":     "01",                   // Pflicht — Nummer (zweistellig)
  "season": "Frühling",            // Pflicht — Jahreszeit/Anlass
  "name":   "Kirschblüte & Vanille", // Pflicht
  "notes":  "Pfingstrose · Jasmin · Vanille", // Pflicht — Duftnoten
  "grad":   "linear-gradient(...)", // Pflicht — CSS Gradient
  "bs":     true                    // Optional — Bestseller-Badge
}
```
