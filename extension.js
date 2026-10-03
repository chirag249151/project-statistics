const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

let statusBarItem;

function activate(context) {

	statusBarItem = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		100
	);

	statusBarItem.command =
		'project-statistics.analyzeProject';

	statusBarItem.tooltip =
		'Analyze current project';

	statusBarItem.text =
		'$(graph) Project Stats';

	statusBarItem.show();

	context.subscriptions.push(statusBarItem);


	const disposable =
		vscode.commands.registerCommand(
			'project-statistics.analyzeProject',
			() => analyzeProject(context)
		);

	context.subscriptions.push(disposable);
}


function analyzeProject(context) {

	const workspaceFolders =
		vscode.workspace.workspaceFolders;

	if (!workspaceFolders) {

		vscode.window.showErrorMessage(
			'Please open a project folder first.'
		);

		return;
	}


	const projectPath =
		workspaceFolders[0].uri.fsPath;


	let totalFiles = 0;
	let totalLines = 0;
	let todoCount = 0;
	let fixmeCount = 0;
	let emptyFiles = 0;


	const todoItems = [];
	const fixmeItems = [];

	const fileTypes = {};
	const languageStats = {};
	const fileStats = [];
	const folderStats = {};


	// --------------------------------
	// Ignored folders
	// --------------------------------

	const defaultIgnoredFolders = [

		'node_modules',
		'.git',
		'dist',
		'build',
		'out',
		'.next',
		'.venv',
		'venv',
		'coverage'

	];


	const configuredIgnoredFolders =
		vscode.workspace
			.getConfiguration('projectStatistics')
			.get('ignoredFolders', []);


	const ignoredFolders = new Set([

		...defaultIgnoredFolders,

		...(Array.isArray(configuredIgnoredFolders)
			? configuredIgnoredFolders
			: [])

	]);


	// --------------------------------
	// Language mapping
	// --------------------------------

	const languageMap = {

		'.js': 'JavaScript',
		'.jsx': 'JavaScript',

		'.ts': 'TypeScript',
		'.tsx': 'TypeScript',

		'.html': 'HTML',
		'.htm': 'HTML',

		'.css': 'CSS',
		'.scss': 'SCSS',
		'.sass': 'Sass',

		'.json': 'JSON',

		'.py': 'Python',

		'.java': 'Java',

		'.cpp': 'C++',
		'.c': 'C',
		'.h': 'C/C++ Header',
		'.hpp': 'C++ Header',

		'.cs': 'C#',

		'.php': 'PHP',

		'.go': 'Go',

		'.rs': 'Rust',

		'.rb': 'Ruby',

		'.sql': 'SQL',

		'.md': 'Markdown',

		'.yml': 'YAML',
		'.yaml': 'YAML',

		'.xml': 'XML',

		'.sh': 'Shell',

		'.bat': 'Batch',

		'.vue': 'Vue',

		'.dart': 'Dart',

		'.kt': 'Kotlin',

		'.swift': 'Swift'

	};


	// --------------------------------
	// Scan folder
	// --------------------------------

	function scanFolder(folderPath) {

		let items;

		try {

			items =
				fs.readdirSync(folderPath);

		} catch (error) {

			return;
		}


		for (const item of items) {

			if (ignoredFolders.has(item)) {

				continue;
			}


			const fullPath =
				path.join(folderPath, item);


			let stats;

			try {

				stats =
					fs.statSync(fullPath);

			} catch (error) {

				continue;
			}


			if (stats.isDirectory()) {

				scanFolder(fullPath);

				continue;
			}


			try {

				const content =
					fs.readFileSync(
						fullPath,
						'utf8'
					);


				const extension =
					path.extname(fullPath)
						.toLowerCase();


				const relativePath =
					path.relative(
						projectPath,
						fullPath
					);


				const relativeFolder =
					path.dirname(relativePath);


				const folderName =
					relativeFolder === '.'
						? '(root)'
						: relativeFolder
							.split(path.sep)[0];


				const lines =
					content.split(/\r?\n/);


				const lineCount =
					content.length === 0
						? 0
						: lines.length;


				totalFiles++;

				totalLines += lineCount;


				if (lineCount === 0) {

					emptyFiles++;
				}


				// --------------------------------
				// File Types
				// --------------------------------

				if (extension) {

					fileTypes[extension] =
						(fileTypes[extension] || 0) + 1;

				} else {

					fileTypes['(no extension)'] =
						(fileTypes['(no extension)'] || 0) + 1;
				}


				// --------------------------------
				// Language Statistics
				// --------------------------------

				const language =
					languageMap[extension] ||

					(
						extension
							? extension
								.replace('.', '')
								.toUpperCase()

							: 'Other'
					);


				languageStats[language] =
					(languageStats[language] || 0) + 1;


				// --------------------------------
				// Folder Statistics
				// --------------------------------

				if (!folderStats[folderName]) {

					folderStats[folderName] = {

						files: 0,
						lines: 0

					};
				}


				folderStats[folderName].files++;

				folderStats[folderName].lines +=
					lineCount;


				// --------------------------------
				// File Statistics
				// --------------------------------

				fileStats.push({

					name:
						path.basename(fullPath),

					path:
						fullPath,

					relativePath:
						relativePath,

					lines:
						lineCount,

					language:
						language

				});


				// --------------------------------
				// TODO / FIXME
				// --------------------------------

				lines.forEach(
					(line, index) => {

						if (
							/\bTODO\b/i.test(line)
						) {

							todoCount++;


							todoItems.push({

								file:
									path.basename(
										fullPath
									),

								path:
									fullPath,

								line:
									index + 1,

								text:
									line.trim()

							});
						}


						if (
							/\bFIXME\b/i.test(line)
						) {

							fixmeCount++;


							fixmeItems.push({

								file:
									path.basename(
										fullPath
									),

								path:
									fullPath,

								line:
									index + 1,

								text:
									line.trim()

							});
						}

					}
				);

			} catch (error) {

				// Ignore binary/unreadable files
			}
		}
	}


	// Start scanning

	scanFolder(projectPath);


	// --------------------------------
	// Largest Files
	// --------------------------------

	const largestFiles =
		[...fileStats]
			.sort(
				(a, b) =>
					b.lines - a.lines
			)
			.slice(0, 10);


	const largestFileLines =
		largestFiles.length > 0
			? largestFiles[0].lines
			: 0;


	// --------------------------------
	// Average Lines
	// --------------------------------

	const averageLines =
		totalFiles > 0
			? Math.round(
				totalLines / totalFiles
			)
			: 0;


	// --------------------------------
	// Health Score
	// --------------------------------

	const healthScore =
		calculateHealthScore(

			totalFiles,

			totalLines,

			todoCount,

			fixmeCount,

			emptyFiles,

			largestFileLines

		);


	// --------------------------------
	// Status Bar
	// --------------------------------

	statusBarItem.text =
		`$(graph) ${totalFiles} files | ${totalLines} lines`;


	// --------------------------------
	// Dashboard
	// --------------------------------

	showDashboard(

		context,

		{

			projectPath,

			totalFiles,

			totalLines,

			todoCount,

			fixmeCount,

			emptyFiles,

			averageLines,

			healthScore,

			fileTypes,

			languageStats,

			fileStats,

			folderStats,

			largestFiles,

			todoItems,

			fixmeItems,

			ignoredFolders:
				[...ignoredFolders]

		}

	);
}


// ========================================
// Calculate Health Score
// ========================================

function calculateHealthScore(

	totalFiles,

	totalLines,

	todoCount,

	fixmeCount,

	emptyFiles,

	largestFileLines

) {

	if (totalFiles === 0) {

		return 0;
	}


	let score = 100;


	// TODO penalty

	score -=
		Math.min(
			25,
			todoCount * 2
		);


	// FIXME penalty

	score -=
		Math.min(
			25,
			fixmeCount * 4
		);


	// Empty files penalty

	score -=
		Math.min(
			10,
			emptyFiles
		);


	const averageLines =
		totalLines / totalFiles;


	if (averageLines > 500) {

		score -= 10;

	} else if (averageLines > 300) {

		score -= 5;
	}


	if (largestFileLines > 1000) {

		score -= 10;

	} else if (largestFileLines > 700) {

		score -= 5;
	}


	return Math.max(
		0,
		Math.min(
			100,
			Math.round(score)
		)
	);
}


// ========================================
// Dashboard
// ========================================

function showDashboard(
	context,
	data
) {

	const panel =
		vscode.window.createWebviewPanel(

			'projectStatistics',

			'Project Statistics',

			vscode.ViewColumn.One,

			{

				enableScripts: true

			}

		);


	const {

		totalFiles,

		totalLines,

		todoCount,

		fixmeCount,

		emptyFiles,

		averageLines,

		healthScore,

		fileTypes,

		languageStats,

		fileStats,

		folderStats,

		largestFiles,

		todoItems,

		fixmeItems

	} = data;


	// ========================================
	// File Types
	// ========================================

	const sortedFileTypes =

		Object.entries(fileTypes)
			.sort(
				(a, b) =>
					b[1] - a[1]
			);


	let fileTypeHTML = '';


	for (
		const [type, count]
		of sortedFileTypes
	) {

		const percentage =

			totalFiles > 0

				? (
					(count / totalFiles) *
					100
				).toFixed(1)

				: 0;


		fileTypeHTML += `

			<div class="stat-row">

				<span>
					${escapeHtml(type)}
				</span>

				<strong>
					${count} (${percentage}%)
				</strong>

			</div>

		`;
	}


	// ========================================
	// Language Statistics
	// ========================================

	const sortedLanguages =

		Object.entries(languageStats)
			.sort(
				(a, b) =>
					b[1] - a[1]
			);


	let languageHTML = '';


	for (
		const [language, count]
		of sortedLanguages
	) {

		const percentage =

			totalFiles > 0

				? (
					(count / totalFiles) *
					100
				).toFixed(1)

				: 0;


		languageHTML += `

			<div class="language-row">

				<div class="language-header">

					<span>
						${escapeHtml(language)}
					</span>

					<strong>
						${count} files ·
						${percentage}%
					</strong>

				</div>


				<div class="progress-track">

					<div
						class="progress-fill"
						style="width:${percentage}%"
					></div>

				</div>

			</div>

		`;
	}


	// ========================================
	// Folder Statistics
	// ========================================

	const sortedFolders =

		Object.entries(folderStats)
			.sort(
				(a, b) =>
					b[1].lines -
					a[1].lines
			)
			.slice(0, 15);


	let folderHTML = '';


	for (
		const [folder, stats]
		of sortedFolders
	) {

		folderHTML += `

			<div class="folder-row">

				<span>
					${escapeHtml(folder)}
				</span>

				<span>

					<strong>
						${stats.files}
					</strong>

					files ·

					<strong>
						${stats.lines}
					</strong>

					lines

				</span>

			</div>

		`;
	}


	// ========================================
	// Largest Files
	// ========================================

	let largestFilesHTML = '';


	for (
		const file
		of largestFiles
	) {

		largestFilesHTML += `

			<button

				class="file-button"

				data-path="${escapeHtml(
					file.path
				)}"

			>

				<span>

					<strong>
						${escapeHtml(
							file.name
						)}
					</strong>

					<small>
						${escapeHtml(
							file.relativePath
						)}
					</small>

				</span>


				<strong>
					${file.lines} lines
				</strong>

			</button>

		`;
	}


	// ========================================
	// TODO / FIXME
	// ========================================

	function createIssueHTML(
		items,
		emptyText
	) {

		if (items.length === 0) {

			return `

				<div class="empty">

					${emptyText}

				</div>

			`;
		}


		return items.map(
			item => `

				<button

					class="issue-button"

					data-path="${escapeHtml(
						item.path
					)}"

					data-line="${item.line}"

				>

					<span class="issue-main">

						<strong>
							${escapeHtml(
								item.file
							)}
						</strong>

						<small>
							${escapeHtml(
								item.text
							)}
						</small>

					</span>


					<strong>
						Line ${item.line}
					</strong>

				</button>

			`
		).join('');
	}


	const todoHTML =
		createIssueHTML(

			todoItems,

			'No TODO items found'

		);


	const fixmeHTML =
		createIssueHTML(

			fixmeItems,

			'No FIXME items found'

		);


	// ========================================
	// Health Label
	// ========================================

	let healthText =
		'Good';


	if (healthScore < 50) {

		healthText =
			'Needs Attention';

	} else if (healthScore < 75) {

		healthText =
			'Moderate';
	}


	// ========================================
	// Messages from Webview
	// ========================================

	panel.webview.onDidReceiveMessage(
		message => {


			// Open file

			if (
				message.command ===
				'openFile'
			) {

				const fileUri =
					vscode.Uri.file(
						message.path
					);


				vscode.window.showTextDocument(
					fileUri
				);
			}


			// Open TODO/FIXME exact line

			if (
				message.command ===
				'openIssue'
			) {

				const fileUri =
					vscode.Uri.file(
						message.path
					);


				const lineNumber =
					Math.max(

						0,

						Number(
							message.line
						) - 1

					);


				const position =
					new vscode.Position(

						lineNumber,

						0

					);


				vscode.window.showTextDocument(

					fileUri,

					{

						selection:
							new vscode.Range(

								position,

								position

							)

					}

				);
			}


			// Refresh

			if (
				message.command ===
				'refresh'
			) {

				panel.dispose();


				vscode.commands.executeCommand(

					'project-statistics.analyzeProject'

				);
			}

		}
	);


	// ========================================
	// HTML
	// ========================================

	panel.webview.html = `

		<!DOCTYPE html>

		<html>


		<head>

			<style>


				* {

					box-sizing:
						border-box;

				}


				body {

					font-family:
						var(--vscode-font-family);

					padding:
						30px;

					color:
						var(--vscode-foreground);

					background:
						var(--vscode-editor-background);

					max-width:
						1200px;

					margin:
						0 auto;

				}


				button {

					font-family:
						inherit;

				}


				h1 {

					margin:
						0;

				}


				h2 {

					margin:
						0 0 16px 0;

				}


				/* Header */

				.header {

					display:
						flex;

					justify-content:
						space-between;

					align-items:
						center;

					gap:
						20px;

					margin-bottom:
						30px;

				}


				.header-subtitle {

					opacity:
						0.65;

					margin-top:
						7px;

					word-break:
						break-all;

				}


				/* Refresh */

				.refresh-button {

					padding:
						9px 15px;

					border:
						1px solid
						var(--vscode-button-border);

					border-radius:
						6px;

					background:
						var(--vscode-button-background);

					color:
						var(--vscode-button-foreground);

					cursor:
						pointer;

				}


				.refresh-button:hover {

					background:
						var(--vscode-button-hoverBackground);

				}


				/* Cards */

				.cards {

					display:
						grid;

					grid-template-columns:
						repeat(4, 1fr);

					gap:
						15px;

				}


				.card {

					padding:
						20px;

					border:
						1px solid
						var(--vscode-panel-border);

					border-radius:
						10px;

					background:
						var(--vscode-editorWidget-background);

				}


				.card-value {

					font-size:
						28px;

					font-weight:
						700;

				}


				.card-label {

					margin-top:
						6px;

					opacity:
						0.7;

				}


				/* Sections */

				.section {

					margin-top:
						35px;

				}


				.two-column {

					display:
						grid;

					grid-template-columns:
						1fr 1fr;

					gap:
						25px;

				}


				.panel-box {

					padding:
						18px;

					border:
						1px solid
						var(--vscode-panel-border);

					border-radius:
						10px;

					background:
						var(--vscode-editorWidget-background);

				}


				/* File Types */

				.stat-row {

					display:
						flex;

					justify-content:
						space-between;

					gap:
						15px;

					padding:
						10px 0;

					border-bottom:
						1px solid
						var(--vscode-panel-border);

				}


				/* Languages */

				.language-row {

					margin-bottom:
						17px;

				}


				.language-header {

					display:
						flex;

					justify-content:
						space-between;

					gap:
						15px;

					margin-bottom:
						6px;

				}


				.language-header strong {

					opacity:
						0.75;

				}


				.progress-track {

					width:
						100%;

					height:
						8px;

					border-radius:
						5px;

					overflow:
						hidden;

					background:
						var(
							--vscode-textBlockQuote-background
						);

				}


				.progress-fill {

					height:
						100%;

					border-radius:
						5px;

					background:
						var(
							--vscode-textLink-foreground
						);

				}


				/* Folder */

				.folder-row {

					display:
						flex;

					justify-content:
						space-between;

					gap:
						15px;

					padding:
						10px 0;

					border-bottom:
						1px solid
						var(--vscode-panel-border);

				}


				/* Files */

				.file-button,
				.issue-button {

					width:
						100%;

					display:
						flex;

					justify-content:
						space-between;

					align-items:
						center;

					gap:
						15px;

					padding:
						12px;

					margin-bottom:
						5px;

					border:
						none;

					border-bottom:
						1px solid
						var(--vscode-panel-border);

					background:
						transparent;

					color:
						var(--vscode-foreground);

					cursor:
						pointer;

					text-align:
						left;

				}


				.file-button:hover,
				.issue-button:hover {

					background:
						var(
							--vscode-list-hoverBackground
						);

				}


				.file-button small,
				.issue-button small {

					display:
						block;

					margin-top:
						4px;

					opacity:
						0.55;

					white-space:
						nowrap;

					overflow:
						hidden;

					text-overflow:
						ellipsis;

					max-width:
						650px;

				}


				.issue-main {

					min-width:
						0;

				}


				.issue-main small {

					max-width:
						800px;

				}


				/* Health */

				.health {

					display:
						flex;

					align-items:
						center;

					gap:
						20px;

				}


				.health-score {

					font-size:
						42px;

					font-weight:
						700;

				}


				.health-bar {

					flex:
						1;

					height:
						12px;

					border-radius:
						6px;

					overflow:
						hidden;

					background:
						var(
							--vscode-textBlockQuote-background
						);

				}


				.health-fill {

					height:
						100%;

					width:
						${healthScore}%;

					background:
						var(
							--vscode-textLink-foreground
						);

				}


				.health-label {

					opacity:
						0.7;

				}


				/* Search */

				.search {

					width:
						100%;

					padding:
						10px 12px;

					margin-bottom:
						12px;

					border:
						1px solid
						var(--vscode-input-border);

					border-radius:
						6px;

					outline:
						none;

					background:
						var(--vscode-input-background);

					color:
						var(--vscode-input-foreground);

				}


				.search:focus {

					border-color:
						var(--vscode-focusBorder);

				}


				/* Empty */

				.empty {

					opacity:
						0.6;

					padding:
						10px 0;

				}


				/* Footer */

				.footer-info {

					margin-top:
						35px;

					padding-top:
						15px;

					border-top:
						1px solid
						var(--vscode-panel-border);

					opacity:
						0.55;

					font-size:
						12px;

				}


				/* Responsive */

				@media (max-width: 800px) {

					.cards {

						grid-template-columns:
							repeat(2, 1fr);

					}


					.two-column {

						grid-template-columns:
							1fr;

					}


					.header {

						align-items:
							flex-start;

						flex-direction:
							column;

					}

				}


				@media (max-width: 500px) {

					.cards {

						grid-template-columns:
							1fr;

					}


					body {

						padding:
							18px;

					}

				}


			</style>

		</head>


		<body>


			<!-- Header -->

			<div class="header">


				<div>

					<h1>
						Project Statistics
					</h1>


					<div class="header-subtitle">

						${escapeHtml(
							data.projectPath
						)}

					</div>

				</div>


				<button

					class="refresh-button"

					id="refreshButton"

				>

					Refresh Statistics

				</button>


			</div>


			<!-- Main Cards -->

			<div class="cards">


				<div class="card">

					<div class="card-value">

						${totalFiles}

					</div>


					<div class="card-label">

						Total Files

					</div>

				</div>


				<div class="card">

					<div class="card-value">

						${totalLines}

					</div>


					<div class="card-label">

						Total Lines

					</div>

				</div>


				<div class="card">

					<div class="card-value">

						${todoCount}

					</div>


					<div class="card-label">

						TODO

					</div>

				</div>


				<div class="card">

					<div class="card-value">

						${fixmeCount}

					</div>


					<div class="card-label">

						FIXME

					</div>

				</div>


			</div>


			<!-- Code Health -->

			<div class="section">


				<h2>
					Code Health
				</h2>


				<div class="panel-box health">


					<div class="health-score">

						${healthScore}

					</div>


					<div style="flex:1">


						<div class="health-bar">

							<div class="health-fill"></div>

						</div>


						<div class="health-label">

							${healthText}

							· Average
							${averageLines}
							lines/file

							· ${emptyFiles}
							empty files

						</div>


					</div>


				</div>


			</div>


			<!-- Language + File Types -->

			<div class="section two-column">


				<div class="panel-box">


					<h2>

						Code Language Statistics

					</h2>


					${languageHTML}


				</div>


				<div class="panel-box">


					<h2>

						File Types

					</h2>


					${fileTypeHTML}


				</div>


			</div>


			<!-- Folder Statistics -->

			<div class="section">


				<h2>

					Folder Statistics

				</h2>


				<div class="panel-box">

					${folderHTML}

				</div>


			</div>


			<!-- Largest Files -->

			<div class="section">


				<h2>

					Largest Files

				</h2>


				<input

					class="search"

					id="fileSearch"

					placeholder="Search files..."

				>


				<div id="fileList">

					${largestFilesHTML}

				</div>


			</div>


			<!-- TODO -->

			<div class="section">


				<h2>

					TODO

				</h2>


				<input

					class="search"

					id="todoSearch"

					placeholder="Search TODO items..."

				>


				<div id="todoList">

					${todoHTML}

				</div>


			</div>


			<!-- FIXME -->

			<div class="section">


				<h2>

					FIXME

				</h2>


				<input

					class="search"

					id="fixmeSearch"

					placeholder="Search FIXME items..."

				>


				<div id="fixmeList">

					${fixmeHTML}

				</div>


			</div>


			<!-- Footer -->

			<div class="footer-info">

				Scanned folders are excluded from:

				${escapeHtml(
					data.ignoredFolders.join(', ')
				)}

			</div>


			<script>


				const vscode =
					acquireVsCodeApi();


				// =================================
				// Open Largest Files
				// =================================

				document

					.querySelectorAll(
						'.file-button'
					)

					.forEach(
						button => {

							button.addEventListener(

								'click',

								() => {

									vscode.postMessage({

										command:
											'openFile',

										path:
											button.getAttribute(
												'data-path'
											)

									});

								}

							);

						}
					);


				// =================================
				// Open TODO / FIXME
				// =================================

				document

					.querySelectorAll(
						'.issue-button'
					)

					.forEach(
						button => {

							button.addEventListener(

								'click',

								() => {

									vscode.postMessage({

										command:
											'openIssue',

										path:
											button.getAttribute(
												'data-path'
											),

										line:
											Number(
												button.getAttribute(
													'data-line'
												)
											)

									});

								}

							);

						}
					);


				// =================================
				// Refresh
				// =================================

				document

					.getElementById(
						'refreshButton'
					)

					.addEventListener(

						'click',

						() => {

							vscode.postMessage({

								command:
									'refresh'

							});

						}

					);


				// =================================
				// Search / Filter
				// =================================

				function setupSearch(

					inputId,

					listId

				) {


					const input =
						document.getElementById(
							inputId
						);


					const list =
						document.getElementById(
							listId
						);


					if (!input || !list) {

						return;
					}


					input.addEventListener(

						'input',

						() => {


							const query =

								input.value

									.toLowerCase()

									.trim();


							list

								.querySelectorAll(
									'button'
								)

								.forEach(
									button => {


										const visible =

											button
												.textContent
												.toLowerCase()
												.includes(
													query
												);


										button.style.display =

											visible
												? 'flex'
												: 'none';

									}
								);

						}

					);

				}


				setupSearch(

					'fileSearch',

					'fileList'

				);


				setupSearch(

					'todoSearch',

					'todoList'

				);


				setupSearch(

					'fixmeSearch',

					'fixmeList'

				);


			</script>


		</body>

		</html>

	`;
}


// ========================================
// Escape HTML
// ========================================

function escapeHtml(value) {

	return String(value)

		.replace(
			/&/g,
			'&amp;'
		)

		.replace(
			/</g,
			'&lt;'
		)

		.replace(
			/>/g,
			'&gt;'
		)

		.replace(
			/"/g,
			'&quot;'
		)

		.replace(
			/'/g,
			'&#039;'
		);
}


// ========================================
// Deactivate
// ========================================

function deactivate() {

	if (statusBarItem) {

		statusBarItem.dispose();

	}
}


module.exports = {

	activate,

	deactivate

};