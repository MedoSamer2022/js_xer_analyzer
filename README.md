<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xer Analyzer 2026 - Beta 1.01</title>
    <style>
        :root {
            --bg-color: #1e1e1e;
            --sidebar-color: #252526;
            --text-color: #d4d4d4;
            --accent-color: #007acc;
            --header-bg: #333333;
            --border-color: #3e3e42;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            height: 100vh;
            overflow: hidden;
        }

        /* Sidebar */
        #sidebar {
            width: 250px;
            background-color: var(--sidebar-color);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 10px;
        }

        h2 {
            font-size: 1.2rem;
            margin-bottom: 20px;
            color: #fff;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
        }

        .upload-btn-wrapper {
            position: relative;
            overflow: hidden;
            display: inline-block;
            margin-bottom: 20px;
        }

        .btn {
            border: 1px solid var(--accent-color);
            color: white;
            background-color: var(--accent-color);
            padding: 8px 20px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            width: 100%;
            text-align: center;
        }

        .upload-btn-wrapper input[type=file] {
            font-size: 100px;
            position: absolute;
            left: 0;
            top: 0;
            opacity: 0;
            cursor: pointer;
        }

        #table-list {
            list-style: none;
            padding: 0;
            overflow-y: auto;
            flex-grow: 1;
        }

        #table-list li {
            padding: 8px 10px;
            cursor: pointer;
            border-radius: 3px;
            margin-bottom: 2px;
            font-size: 0.9rem;
        }

        #table-list li:hover {
            background-color: #2a2d2e;
        }

        #table-list li.active {
            background-color: #37373d;
            border-left: 3px solid var(--accent-color);
        }

        .badge {
            background-color: #444;
            border-radius: 10px;
            padding: 2px 6px;
            font-size: 0.75rem;
            float: right;
        }

        /* Main Content */
        #main {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        header {
            background-color: var(--header-bg);
            padding: 10px 20px;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        #status {
            font-size: 0.9rem;
            color: #888;
        }

        #content-area {
            flex-grow: 1;
            overflow: auto;
            padding: 20px;
        }

        /* Data Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }

        th, td {
            text-align: left;
            padding: 8px;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            background-color: var(--header-bg);
            position: sticky;
            top: 0;
            color: white;
        }

        tr:hover {
            background-color: #2a2d2e;
        }

        .welcome-msg {
            text-align: center;
            margin-top: 100px;
            color: #666;
        }
        
        footer {
            text-align: center;
            font-size: 0.8rem;
            padding: 10px;
            color: #555;
            border-top: 1px solid var(--border-color);
        }
    </style>
</head>
<body>

    <div id="sidebar">
        <h2>XER Analyzer 2026</h2>
        <div class="upload-btn-wrapper">
            <button class="btn">Upload .XER File</button>
            <input type="file" id="fileInput" accept=".xer" />
        </div>
        <div style="font-size: 0.8rem; color: #888; margin-bottom: 10px;">DETECTED TABLES:</div>
        <ul id="table-list">
            </ul>
    </div>

    <div id="main">
        <header>
            <strong id="active-table-name">Dashboard</strong>
            <span id="status">Waiting for file...</span>
        </header>

        <div id="content-area">
            <div class="welcome-msg">
                <h3>Welcome to Xer Analyzer 2026 (Beta 1.01)</h3>
                <p>Select a Primavera P6 (.xer) file to begin analysis.</p>
                <p>Based on jjCode01/js_xer_analyzer</p>
            </div>
        </div>
        
        <footer>
            JS XER Analyzer | Beta Ver 1.01
        </footer>
    </div>

    <script>
        // Global storage for parsed data
        let xerData = {};

        document.getElementById('fileInput').addEventListener('change', handleFileSelect, false);

        function handleFileSelect(event) {
            const file =
