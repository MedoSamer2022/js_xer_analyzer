# Xer Analyzer 2026 📊

> **Beta Ver 1.01**
> A fast, secure, and client-side web tool to analyze Primavera P6 (`.xer`) files directly in your browser.

![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.01%20Beta-blue)
![Platform](https://img.shields.io/badge/platform-Web-orange)

## 📖 Overview

**Xer Analyzer 2026** is a modern enhancement of the open-source XER parsing logic. Unlike desktop applications, this runs entirely in your web browser using HTML5 and JavaScript. 

**Privacy First:** No data is uploaded to any server. All processing happens locally on your machine using the FileReader API.

This project is an enhanced web interface based on the logic from [jjCode01/js_xer_analyzer](https://github.com/jjCode01/js_xer_analyzer).

## ✨ Key Features

* **Dark Mode Dashboard:** A professional IDE-like interface for long working hours.
* **Instant Parsing:** Reads standard `.xer` files immediately without backend processing.
* **Table Discovery:** Automatically detects all tables (e.g., `TASK`, `PROJECT`, `RSRC`) and counts the rows in each.
* **Data Grid:** View raw data in a clean, scrollable table format.
* **Performance:** optimized to render data without freezing the browser (includes safety limits for large datasets).

## 🚀 How to Use

### Option 1: Live Demo (GitHub Pages)
*(If you have enabled GitHub Pages)*
1.  Go to the **Settings** tab of this repository.
2.  Click **Pages** on the left menu.
3.  Click the generated URL (e.g., `https://medosamer2022.github.io/js_xer_analyzer`).
4.  Click **"Upload .XER File"** and select your schedule.

### Option 2: Run Locally
1.  Clone this repository or download the ZIP.
2.  Locate `index.html`.
3.  Double-click `index.html` to open it in Chrome, Edge, or Firefox.

## 🛠️ Technical Stack

* **Frontend:** HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript (ES6+).
* **Parsing Logic:** Custom Regex/Split logic to handle P6 `%T` (Table) and `%R` (Row) structures.
* **Dependencies:** None. Zero external libraries required.

## 📝 Enhancements in v1.01
* Converted strict Node.js logic to browser-compatible JS.
* Added CSS styling for a "Dark Theme" UI.
* Added Sidebar navigation for easy table switching.
* Added row counters and status indicators.

## 🤝 Contributing

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## ⚖️ License

This project is open source. 
Original Logic Credit: [jjCode01](https://github.com/jjCode01/js_xer_analyzer).

---
*Made for Project Controls Professionals.*
