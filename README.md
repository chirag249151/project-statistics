# Project Statistics

A VS Code extension that analyzes your project and provides useful code and file statistics directly inside VS Code.

## Features

- Total files count
- Total lines of code
- Code language statistics
- File type statistics
- Folder statistics
- Top 10 largest files
- TODO detection
- FIXME detection
- Exact line navigation for TODO/FIXME
- Search and filter
- Code Health Score
- Average lines per file
- Empty files count
- Refresh statistics
- VS Code Status Bar project summary
- Configurable ignored folders

## How to Use

1. Open a project folder in VS Code.
2. Press `Ctrl + Shift + P`.
3. Search for:

   `Project Statistics: Analyze Project`

4. Select the command.
5. The Project Statistics dashboard will open.

You can also click **Project Stats** in the VS Code Status Bar.

## What It Analyzes

Project Statistics scans the files in your project and provides information about:

- Number of files
- Number of lines
- Programming languages
- File extensions
- Folder-wise statistics
- Largest files
- TODO and FIXME comments

By default, common generated and dependency folders such as `node_modules`, `.git`, `dist`, `build`, and other build/coverage folders are excluded.

## TODO and FIXME

The extension detects TODO and FIXME comments and displays:

- File name
- Exact line number
- Comment text

Clicking an item opens the corresponding file directly at that line.

## Code Health

Project Statistics provides a Code Health Score based on project statistics such as:

- TODO count
- FIXME count
- Empty files
- Average file size
- Largest file size

The score is intended as a quick project overview and is not a formal code-quality standard.

## Ignored Folders

Additional folders can be excluded from analysis through VS Code settings.

Open:

`Settings → Extensions → Project Statistics`

or add the following to your VS Code settings:

```json
{
    "projectStatistics.ignoredFolders": [
        "temp",
        "logs",
        "my-folder"
    ]
}