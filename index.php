<?php
	require 'config.php';

	$scripts = array(
		'sql-tokenizer/sql-tokenizer.js',
		'sql-tokenizer/sql-query.js',
		'fuzzy-match/fuzzy-match.js',
		'jquery-1.7.2.min.js',
		'fsm-complex.js',
		'mysql.js',
		'ui.js',
	);
	$styles = file_get_contents('css/style.css');
	$matches;
	preg_match_all('#"([^"]+?\.css)"#', $styles, $matches);
	$styles = $matches[1];

	if (isset($dev) && $dev) {
		$scripts[] = 'dev.js';
		$styles[] = 'dev.css';
	}

	$script_html = '';
	foreach ($scripts as $script) {
		$script = "js/$script";
		$script_html .= "\t\t" . '<script src="' . $script . (1?'?' . filemtime($script)%1000:'') . '"></script>' . "\n";
	}
	$styles_html = '';
	foreach ($styles as $style) {
		$style = "css/$style";
		$styles_html .= "\t\t" . '<link rel="stylesheet" href="' . $style . (1?'?' . filemtime($style)%1000:'') . '" />' . "\n";
	}

	$mysql_config = array();
	$mysql_config['api_url'] = 'api.php';
	if (isset($host)) {
		$mysql_config['host'] = $host;
	}
	if (isset($query_transform)) {
		if ($query_transform === '.') {
			$mysql_config['query_transform'] = '.';
		}
	}
	$mysql_config = "\t\t\tmysql.config("
		. json_encode($mysql_config, defined('JSON_PRETTY_PRINT') ? JSON_PRETTY_PRINT : 0) . ");\n";

	$dev_config = array();
	if ($dev_config) {
		$tmp = array();
		foreach ($dev_config as $k => $v) {
			$tmp[] = "dev_$k = " . json_encode($v);
		}
		$dev_config =  "\t\t\tvar " . implode(",\n\t\t", $tmp) . ";\n";
	} else {
		$dev_config = '';
	}
?>
<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>MySQL.js</title>
		<link rel="icon" href="images/favicon.png" />
<?=$styles_html?>
		<script>
			var con = { log: function () {}, error: function () {}, response: function () {} };
		</script>
<?=$script_html?>
		<script>
<?= $mysql_config . $dev_config ?>
		</script>
		<noscript><style>#page-connect { display:none }</style></noscript>
	</head>
	<body>
		<noscript>
			<p class="error" id="enable-javascript">MySQL.js requires JavaScript. Please use a browser with JavaScript enabled.</p>
		</noscript>
		<div class="page" id="page-connect">
			<form id="connect-form">
				<h1>Connect</h1>
				<p id="connect-error" class="error" hidden></p>
				<?php if (empty($host)) : ?>
				<p><label>
					MySQL host<br /><input type="text" id="input-host" />
				</label></p>
				<?php endif; ?>
				<p><label>
					MySQL username<br /><input type="text" id="input-username" />
				</label></p>
				<p><label>
					MySQL password<br /><input type="password" id="input-password" />
				</label></p>
				<p><button type="submit" id="connect-button">Connect</button></p>
			</form>
		</div>

		<div class="page" id="page-db" hidden>
			<nav id="main-nav">
				<ul>
					<li><a href="" title="Shortcut help [?]" accesskey="?" id="shortcut-info-link">?</a></li>
					<li><a href="./" title="Disconnect [D]" accesskey="d" id="disconnect">Disconnect</a></li>
				</ul>
			</nav>

			<div class="column" id="databases">
				<h2 class="column-title" title="Databases [1]">Databases</h2>
				<div class="column-content" accesskey="1" tabindex="-1">
					<ul class="selection-list"></ul>
				</div>
			</div>

			<div class="column" id="tables">
				<h2 class="column-title" title="Tables [2]">Tables</h2>
				<div class="column-content" accesskey="2" tabindex="-1">
					<ul class="selection-list"></ul>
				</div>
			</div>

			<div class="column" id="search" hidden>
				<h2><input type="search" id="search-input" accesskey="s" /></h2>
				<div class="column-content" tabindex="-1">
					<p id="search-emptyquery">Go to a database or table</p>
					<p id="search-noresults">No matching databases or tables found</p>
					
					<div id="search-current">
						<h3 id="search-current-results-dbs">Databases</h3>
						<h3 id="search-current-results-indb">Tables in <span class="search-current-db-text"></span></h3>
						<div id="search-current-noresults-dbs">
							<h3>Databases</h3>
							<p>No matching databases</p>
						</div>
						<div id="search-current-noresults-indb">
							<h3>Tables in <span class="search-current-db-text"></span></h3>
							<p>No matching tables</p>
						</div>
						<ul id="search-current-results" class="selection-list"></ul>
					</div>
					<div id="search-other">
						<h3 id="search-other-results-dbs">Tables</h3>
						<h3 id="search-other-results-indb">Other databases and tables</h3>
						<div id="search-other-noresults-dbs">
							<h3>Tables</h3>
							<p>No matches tables</p>
						</div>
						<div id="search-other-noresults-indb">
							<h3>Other databases and tables</h3>
							<p>No more matches</p>
						</div>
						<ul id="search-other-results" class="selection-list"></ul>
					</div>
					<div id="search-padding"></div> <!-- styling -->
				</div>
			</div>

			<div class="column" id="result">
				<h2 class="column-title" title="Data [3]">Data</h2>
				<div class="column-content" accesskey="3" tabindex="0">
					<form id="result-query">
						<textarea id="result-query-code" accesskey="q" title="Write a query [Q]" placeholder="Run a query [Q]" spellcheck="false"></textarea>
						<div id="result-query-buttons">
							<button type="submit" id="result-query-run" title="Run query [Meta+Enter]">Run</button>
							<button id="result-query-reset">Reset</button>
						</div>
					</form>
					<div id="result-loading" hidden>
						<p>Sent query...</p>
					</div>
					<div id="result-error" hidden>
						<div class="error"></div>
					</div>
					<div id="result-success" hidden>
						<div class="success"></div>
					</div>
					<div id="result-data" hidden>
						<div id="result-summary">
							<div id="result-empty" hidden>Didn't return any results</div>
							<div id="result-showing-all" hidden>Showing all <span id="result-count"></span> rows</div>
							<div id="result-pager" hidden>
								Showing rows <span id="result-pager-start"></span>–<span id="result-pager-end"></span> (total: <span id="result-total-count"></span>)
								<nav>
									<a id="result-pager-prev" href="" title="Previous [P]">Previous</a>
									<a id="result-pager-next" href="" title="Next [N]">Next</a>
								</nav>
							</div>
						</div>
						<table></table>
					</div>
				</div>
			</div>
		</div>

		<div id="shortcut-info" tabindex="-1" hidden><div>
			<span id="shortcut-info-close">Press <span class="key">Escape</span> or click to close</span>
			<table>
				<tr>
					<td><span class="key">?</span> or <span class="key">H</span></td>
					<td>Show shortcuts help (this page)</td>
				</tr>
				<tr>
					<td><span class="key">&larr;</span> <span class="key">&rarr;</span> <span class="key">&uarr;</span> <span class="key">&darr;</span></td>
					<td>Navigate among databases, tables and result data</td>
				</tr>
				<tr>
					<td><span class="key">1</span></td>
					<td>Focus database</td>
				</tr>
				<tr>
					<td><span class="key">2</span></td>
					<td>Focus table</td>
				</tr>
				<tr>
					<td><span class="key">3</span></td>
					<td>Focus result data</td>
				</tr>
				<tr>
					<td><span class="key">Q</span></td>
					<td>Write a query</td>
				</tr>
				<tr>
					<td><span class="key">P</span> or <span class="key">N</span></td>
					<td>Show previous or next results respectively</td>
				</tr>
				<tr>
					<td><span class="key">Meta</span> + <span class="key">Enter</span></td>
					<td>Run your query (only when writing a query)</td>
				</tr>
				<tr>
					<td><span class="key">G</span> or <span class="key">Escape</span></td>
					<td>Go to a database or table</td>
				</tr>
				<tr>
					<td><span class="key">D</span> then <span class="key">Enter</span></td>
					<td>Disconnect</td>
				</tr>
			</table>
		</div></div>
	</body>
</html>
