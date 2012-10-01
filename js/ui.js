$(function () {
	"use strict";
	function hide($elem) {
		$elem.attr("hidden", "");
		return $elem;
	}
	function show($elem) {
		$elem.removeAttr("hidden");
		return $elem;
	}
	function is_visible($elem) {
		return $elem.is(":visible");
	}

	var undefined,
		win = window,
		mysql = win.mysql,

		DEFAULT_LIMIT = 30,
		index_of = [].indexOf || function (search) {
			var t = this,
				length = t.length,
				i = 0;
			for (; i < length; i++) {
				if (i in t && t[i] === search) {
					return i;
				}
			}
			return -1;
		};

	// each state indicates which data is shown: database-table-result
	// e.g. xx- means that databases are shown, tables too, but no result
	var fsm = Complex_state_machine({
		connection: Ssm("disconnected", {
			connect: { from: "disconnected", to: "connected" }
		}),
		table: Ssm("inactive", {
			select_db: { from: "inactive", to: "active" },
			custom_query_no_db: { to: "inactive" },
			custom_query_db: { to: "active" }
		}),
		shortcut_info: Ssm("hidden", {
			show_shortcut: { from: "hidden", to: "visible" },
			hide_shortcut: { from: "visible", to: "hidden" }
		})
	});

	// key codes
	var KEY_TAB = 9,
		KEY_ENTER = 13,
		KEY_SHIFT = 16,
		KEY_CTRL = 17,
		KEY_ALT = 18,
		KEY_META = -1, // TODO what's the real code?
		KEY_ESCAPE = 27,
		KEY_PG_UP = 33,
		KEY_PG_DOWN = 34,
		KEY_END = 35,
		KEY_HOME = 36,
		KEY_LEFT = 37,
		KEY_UP = 38,
		KEY_RIGHT = 39,
		KEY_DOWN = 40,
		KEY_QUESTION_MARK = 191,
		KEY_1 = 49,
		KEY_2 = 50,
		KEY_3 = 51,
		KEY_D = 68,
		KEY_G = 71,
		KEY_H = 72,
		KEY_N = 78,
		KEY_P = 80,
		KEY_Q = 81;

	// page part constants
	var DATABASES = 0,
		TABLES = 1,
		RESULT = 2;

	// saved elements
	var $page_connect = $("#page-connect"),
		$page_db = $("#page-db"),
		$connect_error = $("#connect-error"),
		$columns = $(".column"),
		$columns_content = $columns.find(".column-content"),
		$result = $("#result"),
		$result_heading = $result.find("h2"),
		$result_content = $result.find(".column-content"),
		$result_loading = $("#result-loading"),
		$result_error = $("#result-error"),
		$result_error_message = $result_error.find(".error"),
		$result_success = $("#result-success"),
		$result_success_message = $result_success.find(".success"),
		$result_data = $("#result-data"),
		$result_data_table = $result_data.find("table"),
		$result_showing_all = $("#result-showing-all"),
		$result_pager = $("#result-pager"),
		$result_empty = $("#result-empty"),
		$result_count = $result.find("#result-count"),
		$result_total_count = $result.find("#result-total-count"),
		$result_pager_start = $result_pager.find("#result-pager-start"),
		$result_pager_end = $result_pager.find("#result-pager-end"),
		$result_pager_prev = $result_pager.find("#result-pager-prev"),
		$result_pager_next = $result_pager.find("#result-pager-next"),
		$result_frames = $result_loading
			.add($result_error)
			.add($result_success)
			.add($result_data),
		$result_query = $result.find("#result-query"),
		$result_query_code = $result_query.find("#result-query-code"),
		$result_query_buttons = $result_query.find("button"),
		$result_query_run = $result_query_buttons.filter("#result-query-run"),
		$result_query_reset = $result_query_buttons.filter("#result-query-reset"),
		$databases = $("#databases"),
		$databases_content = $databases.find(".column-content"),
		$databases_list = $databases.find(".selection-list"),
		$database_links = [], // populate on load
		$tables = $("#tables"),
		$tables_content = $tables.find(".column-content"),
		$tables_list = $tables.find(".selection-list"),
		$table_links = [], // populate on load
		$selection_lists = $databases_list.add($tables_list),
		$command_input = $("#command input"),
		$nav_links = $("nav a"),
		$disconnect_link = $nav_links.filter("#disconnect"),
		$shortcut_info = $("#shortcut-info"),
		$shortcut_info_link = $("#shortcut-info-link"),
		$search = $("#search"),
		$search_input = $("#search-input"),
		$search_content = $search.find(".column-content"),
		$search_current_results = $("#search-current-results"),
		$search_other_results = $("#search-other-results"),
		$search_current_db_text = $(".search-current-db-text"),
		$search_links = [];

	function empty_results() {
		hide($result_frames);
		show_query_code("");
	}
	function show_result($result) {
		hide($result_frames);
		show($result);
	}
	function show_error(msg) {
		$result_error_message.text(msg);
		show_result($result_error);
	}
	function show_success(msg) {
		$result_success_message.text();
		show_result($result_success);
	}
	function focus_code_or_result(has_error) {
		if (has_error) {
			$result_query_code.focus();
		} else {
			$result_content.focus();
		}
	}
	var pager_query, pager_start, pager_per_page;
	function show_data(result, query, limit, result_count) {
		var i, j, row, val,
			columns = result.columns,
			data = result.data,
			col_len = columns.length,
			row_len = data.length,
			head = $("<tr>"),
			body = $("<tbody>");

		for (i = 0; i < col_len; i++) {
			$("<th>", {text: columns[i]}).appendTo(head);
		}
		for (i = 0; i < row_len; i++) {
			row = $("<tr>");
			for (j = 0; j < col_len; j++) {
				val = data[i][j];
				if (typeof val === "string" && 30 < val.length && row_len > 5) {
					$("<td>", {
						text: val.substr(0, 27) + "...",
						title: val
					}).appendTo(row);
				} else {
					$("<td>", {text: val}).appendTo(row);
				}
			}
			row.appendTo(body);
		}
		if (row_len === 0) {
			row = $("<tr>");
			$("<td>", {text: "No rows", colspan: col_len}).appendTo(row);
			$result_data_table.addClass("empty");
			row.appendTo(body);
		} else {
			$result_data_table.removeClass("empty");
		}

		if (result_count === undefined || result_count <= row_len || row_len === 0) {
			if (row_len === 0) {
				hide($result_pager.add($result_showing_all));
				show($result_empty);
			} else {
				hide($result_pager.add($result_empty));
				$result_count.text(row_len);
				show($result_showing_all);
			}
		} else if (limit) {
			hide($result_showing_all.add($result_empty));
			if (0 < limit[0]) {
				show($result_pager_prev);
			} else {
				hide($result_pager_prev);
			}
			if (limit[0] + row_len < result_count) {
				show($result_pager_next);
			} else {
				hide($result_pager_next);
			}
			$result_pager_start.text(limit[0]);
			$result_pager_end.text(limit[0] + row_len - 1);
			$result_total_count.text(result_count);
			pager_query = query;
			pager_start = limit[0];
			pager_per_page = limit[1];
			show($result_pager);
		} else {
			hide($result_showing_all.add($result_empty).add($result_pager));
		}

		$result_data_table
			.text("")
			.append(head)
			.append(body);
		show_result($result_data);
	}

	window.show_cache = function () {
		var i, ar = [];
		for (i in cache) {
			ar.push(i);
		}
		con.log(ar.join("\n"));
	};

	var cache = {},
		CACHE_EXPIRY_TIME = 1000*60*60; // one hour
	function query_cache(options, next) {
		var i, query, purge, requests, results, key,
			now = +new Date();
		if (options.query) {
			query = options.query;
			purge = options.purge;
		} else {
			query = options;
		}

		if (typeof query === "string") {
			// one
			key = query;
			if (!purge && cache[key] && cache[key].at < now + CACHE_EXPIRY_TIME) {
				next(undefined, cache[key].result);
			} else {
				mysql.query(query, function (err, result) {
					if (!err) {
						cache[key] = { result: result, at: now };
					}
					next(err, result);
				});
			}
		} else {
			// multiple queries
			results = [];
			if (purge) {
				requests = query;
			} else {
				requests = [];
				for (i = 0; i < query.length; i++) {
					key = query[i];
					if (cache[key] && cache[key].at < now + CACHE_EXPIRY_TIME) {
						results[i] = cache[key].result;
					} else {
						requests.push(query[i]);
					}
				}
			}

			if (requests.length === 0) {
				next(undefined, results);
			} else {
				mysql.query(requests, function (err, res) {
					if (requests.length === 1) {
						res = [res];
					}
					var i, j;
					j = 0;
					for (i = 0; i < query.length; i++) {
						if (!results[i]) {
							results[i] = res[j];
							if (!res[j].error) {
								key = query[i];
								cache[key] = { result: res[j], at: now };
							}
							j++;
						}
					}
					next(err, results);
				});
			}
		}
	}

	var current_query;
	function query_and_show(options, next) {
		var limit, count_query, query, queries,
			q;

		if (typeof options !== "object") {
			query = options;
		} else {
			limit = options.limit;
			query = options.query;
		}

		if (current_query === query) {
			// somebody accidentally fired this query before we got a result from the last, identical query
			return;
		}
		current_query = query;

		q = Sql_query(query);
		if (limit === undefined) {
			// add limit if there isn't one already
			limit = q.get_limit();
			if (!limit) {
				limit = [0, DEFAULT_LIMIT];
			}
		} else if (typeof limit === "number") {
			limit = [0, limit];
		} else {
			if (limit[0] < 0) {
				limit[0] = 0;
			}
		}
		if (q.update_limit(limit[0], limit[1])) {
			query = q.update_limit(limit[0], limit[1]);
		}
		count_query = q.count_query();

		if (count_query) {
			queries = [query, count_query];
		} else {
			queries = query;
		}

		// show loading page, but don't flicker
		var timeout = setTimeout(function() {
			show_result($result_loading);
		}, 200);
		show_query_code(query);

		mysql.query(queries, function (err, result) {
			clearTimeout(timeout);
			if (err) {
				show_error(err);
			} else {
				if (result.affected_rows) {
					show_success(result.affected_rows + " row(s) affected.");
				} else {
					// data
					if (count_query) {
						show_data(result[0], query, limit, result[1].data[0][0]);
					} else {
						show_data(result, query);
					}
				}
			}
			current_query = undefined;
			next && next(err);
		});
	}
	$result_pager_next.on("click", function (e) {
		e.preventDefault();
		query_and_show({
			query: pager_query,
			limit: [pager_start + pager_per_page, pager_per_page]
		}, focus_code_or_result);
	});
	$result_pager_prev.on("click", function (e) {
		e.preventDefault();
		query_and_show({
			query: pager_query,
			limit: [pager_start - pager_per_page, pager_per_page]
		}, focus_code_or_result);
	});

	// connect
	$("#connect-form").on("submit", function (e) {
		e.preventDefault();
		hide($connect_error);
		var host = $("#input-host").val(),
			config = {
				username: $("#input-username").val(),
				password: $("#input-password").val()
			};
		if (host !== undefined) {
			config.host = host;
		}
		mysql.config(config);
		show_dbs();
	});

	var showing_dbs = [], current_db,
		showing_tables = [], current_table;
	function show_dbs(next) {
		query_cache("SHOW DATABASES", function (err, databases) {
			var i, len, data, li, name;
			if (err) {
				hide($page_db);
				show($page_connect);
				show($connect_error.text("Could not connect: " + err));
			} else {
				hide($page_connect);
				show($page_db);

				$databases_list.text("").removeClass("empty");
				data = databases.data;
				len = data.length;
				showing_dbs.length = len;
				for (i = 0; i < len; i++) {
					name = data[i][0];
					showing_dbs[i] = name;
					li = $("<li>");
					$("<a>", { text: name, title: name, href: "", data: {name: name} }).appendTo(li);
					li.appendTo($databases_list);
				}
				$database_links = $databases_list.find("a");

				if (len === 0) {
					$("<li>", { text: "No databases" }).appendTo($databases_list.addClass("empty"));
				} else if (len === 1) {
					// if only one database, select that one
					$($database_links[0]).focus().click();
				} else {
					// focus the first database
					$($database_links[0]).focus();
				}

				// empty tables and results
				$tables_list.text("");
				$("<li>").appendTo($tables_list.addClass("empty"));
				$table_links = [];
				current_table = undefined;
				empty_results();
			}
			next && next(err, databases);
		});
	}
	function select_db(db, next) {
		$tables_list.text("");
		empty_results();
		$databases_list.find(".selected").removeClass("selected");
		var index = index_of.call(showing_dbs, db);
		$($database_links[index]).addClass("selected").focus();

		mysql.config({ db: db });
		query_cache("SHOW TABLES IN " + mysql.identifier(db), function (err, tables) {
			var i, len, data, li, name;
			if (err) {
				show_error("Cannot show tables in '" + db + "': " + err);
			} else {
				hide($page_connect);
				show($page_db);
				$tables_list.text("").removeClass("empty");
				data = tables.data;
				len = data.length;
				showing_tables.length = len;
				for (i = 0; i < len; i++) {
					name = data[i][0];
					showing_tables[i] = name;
					li = $("<li>");
					$("<a>", { text: name, title: name, href: "", data: {name: name} }).appendTo(li);
					li.appendTo($tables_list);
				}
				$table_links = $tables_list.find("a");
				if (len === 0) {
					$("<li>", { text: "No tables" }).appendTo($tables_list.addClass("empty"));
				} else if (len === 1) {
					// if only one table, select that one
					$($table_links[0]).focus().click();
				} else {
					// focus the first table
					$($table_links[0]).focus();
				}
			}
			current_db = db;
			current_table = undefined;
			next && next(err);
		});
	}
	// first and last parameter optional
	function select_table(table, next) {
		$tables_list.find(".selected").removeClass("selected");
		var index = index_of.call(showing_tables, table);
		$($table_links[index]).addClass("selected").focus();
		query_and_show({
			query: "SELECT *\nFROM " + mysql.identifier(table),
			limit: [0, DEFAULT_LIMIT],
			count_query: "SELECT COUNT(*)\nFROM " + mysql.identifier(table)
		}, function (err) {
			if (!err) {
				$result_content.focus();
			}
			current_table = table;
			next && next(err);
		});
	}

	function select_db_and_table(db, table, next) {
		if (current_db === db) {
			select_table(table, next);
		} else {
			select_db(db, function (err) {
				// TODO error handling
				select_table(table, next);
			});
		}
	}

	// select database
	$databases_list.on("click", "a", function (e) {
		e.preventDefault();
		select_db($(this).data("name"));
	});

	// show table
	$tables_list.on("click", "a", function (e) {
		e.preventDefault();
		select_table($(this).data("name"));
	});

	// keyboard nav
	// either databases or tables
	function focus_selection_list(which) {
		var $column, $column_content, $selection_list, $links;
		if (which === DATABASES) {
			$column = $databases;
			$column_content = $databases_content;
			$selection_list = $databases_list;
			$links = $database_links;
		} else {
			// TABLES
			$column = $tables;
			$column_content = $tables_content;
			$selection_list = $tables_list;
			$links = $table_links;
		}
		if (!$column.hasClass("focus") && $links.length !== 0) {
			$columns.removeClass("focus");
			var elem = $selection_list.find(".selected")[0]
				// no database/table selected, focus the first instead
				|| $links[0]
				// no databases/tables at all, focus the whole column if possible
				|| $column_content[0];
			$(elem).focus();
		}
	}
	function focus_result() {
		if (!$result.hasClass("focus")) {
			$columns.removeClass("focus");
			$result.addClass("focus");
		}
		$result_content.focus();
	}

	function navigate_list_keydown(which, pos, len) {
		var i,
			orig = pos,
			move = which === KEY_DOWN ? 1
				: which === KEY_PG_DOWN ? 10
				: which === KEY_UP ? -1
				: which === KEY_PG_UP ? -10
				: 0;

		if (move) {
			pos += move;
			if (pos < 0) {
				pos = 0;
			} else if (len <= pos) {
				pos = len - 1;
			}
		} else if (which === KEY_END) {
			pos = len - 1;
		} else if (which === KEY_HOME) {
			pos = 0;
		}
		return orig === pos ? false : pos;
	}
	$databases_list.on("keydown", "a", function (e) {
		var to_focus,
			which = e.which;
		if (which === KEY_HOME) {
			$databases_content.scrollTop(0);
		} else if (which === KEY_END) {
			$databases_content.scrollTop(1000*1000);
		} else if (which === KEY_RIGHT) {
			if ($table_links.length) {
				focus_selection_list(TABLES);
			} else {
				focus_result();
			}
		}
		to_focus = navigate_list_keydown(which, index_of.call($database_links, this), $database_links.length);
		if (to_focus !== false) {
			$($database_links[to_focus]).focus();
			e.preventDefault();
		}
	});
	$tables_list.on("keydown", "a", function (e) {
		var to_focus,
			which = e.which;
		if (which === KEY_HOME) {
			$tables_content.scrollTop(0);
		} else if (which === KEY_END) {
			$tables_content.scrollTop(1000*1000);
		} else if (which === KEY_LEFT) {
			focus_selection_list(DATABASES);
		} else if (which === KEY_RIGHT) {
			focus_result();
		}
		to_focus = navigate_list_keydown(which, index_of.call($table_links, this), $table_links.length);
		if (to_focus !== false) {
			$($table_links[to_focus]).focus();
			e.preventDefault();
		}
	});
	$result_content.on("keydown", function (e) {
		if (e.which === KEY_LEFT && this.scrollLeft === 0) {
			if ($table_links.length) {
				focus_selection_list(TABLES);
			} else {
				focus_selection_list(DATABASES);
			}
		}
	});
	$databases_list.on("focus", "a", function () {
		$columns.removeClass("focus");
		$databases.addClass("focus");
	});
	$tables_list.on("focus", "a", function () {
		$columns.removeClass("focus");
		$tables.addClass("focus");
	});

	$result_pager_prev.add($result_pager_next).on("focus", function () {
		$columns.removeClass("focus");
		$result.addClass("focus");
	});

	var result_query_focus_timeout;
	$result_query_buttons.add($result_query_code)
		.on("focus", function () {
			if (this !== document.activeElement) {
				// the blur has to happen before this element is focused, if it's one of they other query elems
				$(document.activeElement).blur();
			}
			clearTimeout(result_query_focus_timeout);
			$columns.removeClass("focus");
			$result.addClass("focus");
			$result_query_code.addClass("focus");
		})
		.on("blur", function (e) {
			if (e.immediate) {
				$result_query_code.removeClass("focus");
			} else {
				result_query_focus_timeout = setTimeout(function () {
					$result_query_code.removeClass("focus");
				}, 100);
			}
		})
		.on("keydown", function (e) {
			if (e.which === KEY_ESCAPE) {
				$(this).trigger({type:"blur", immediate:true});
				focus_result();
				e.stopPropagation();
			}
		});

	$columns_content.add($nav_links).on("focus", function (e) {
		if (this === $databases_content[0]) {
			focus_selection_list(DATABASES);
		} else if (this === $tables_content[0]) {
			focus_selection_list(TABLES);
		} else if (this === $result_content[0]) {
			if (!$result.hasClass("focus")) {
				$columns.removeClass("focus");
				$result.addClass("focus");
			}
		} else {
			$columns.removeClass("focus");
		}
	});
	$result_heading.on("click", focus_result);
	$(win.document).on("keydown", function (e) {
		var which = e.which;
		if (!e.metaKey && !e.ctrlKey && !$(e.target).is("[type=text], [type=password], [type=search], textarea")) {
			if (KEY_QUESTION_MARK === which || KEY_H === which) {
				toggle_shortcut();
			} else if (KEY_ESCAPE === which) {
				if (fsm.can("hide_shortcut")) {
					hide_shortcut();
				} else if (which === KEY_ESCAPE) {
					show_search();
					e.preventDefault();
				}
			} else if (KEY_1 === which && !$databases.hasClass("focus")) {
				focus_selection_list(DATABASES);
			} else if (KEY_2 === which && !$tables.hasClass("focus")) {
				focus_selection_list(TABLES);
			} else if (KEY_3 === which && !$result.hasClass("focus")) {
				focus_result();
			} else if (KEY_D === which) {
				$disconnect_link.focus();
			} else if (KEY_G === which) {
				show_search();
				e.preventDefault();
			} else if (KEY_N === which && is_visible($result_pager_next)) {
				$result_pager_next.focus().click();
			} else if (KEY_P === which && is_visible($result_pager_prev)) {
				$result_pager_prev.focus().click();
			} else if (KEY_Q === which) {
				$result_query_code.focus();
				e.preventDefault();
			} else {
				// con.log(which);
			}
		}
	});

	$shortcut_info_link.on("click", function (e) {
		e.preventDefault();
		toggle_shortcut();
	});

	var shortcut_last_focus;
	function show_shortcut() {
		shortcut_last_focus = document.activeElement;
		show($shortcut_info).focus();
		fsm("show_shortcut");
	}
	function hide_shortcut() {
		hide($shortcut_info);
		fsm("hide_shortcut");
		$(shortcut_last_focus).focus();
	}
	function toggle_shortcut() {
		if (fsm.can("show_shortcut")) {
			show_shortcut();
		} else {
			hide_shortcut();
		}
	}
	$shortcut_info.on("click keydown", function (e) {
		e.stopPropagation();
		var which = e.which;
		if (e.type === "click" || KEY_QUESTION_MARK === which || KEY_H === which || KEY_ESCAPE === which || KEY_TAB === which) {
			e.preventDefault();
			hide_shortcut();
		}
	});
	$shortcut_info.on("blur", function (e) {
		function check() {
			if (fsm.can("hide_shortcut")) {
				if (document.activeElement === this) {
					$shortcut_info.focus();
					con.log("??Focus shortcut_info again");
				} else if (document.activeElement === document.body) {
					con.log("Body focused - fine");
				} else {
					$shortcut_info.focus();
					con.log("Something else focused: focus shortcut_info again");
				}
			}
		}
		setTimeout(check, 50);
		setTimeout(check, 200); // catch slow browsers (minimize risk for race conditions)
	});

	// query code
	var query_code_last_run, current_query_code_height,
		query_code_is_last_run = false;
	function show_query_code(query) {
		query_code_last_run = $result_query_code[0].value = query;
		set_query_code_height();
		update_query_code(true);
	}
	function update_query_code(is_last_run) {
		is_last_run = !!is_last_run;
		if (query_code_is_last_run !== is_last_run) {
			query_code_is_last_run = is_last_run;
			$result_query_reset.prop("disabled", is_last_run);
		}
	}
	function set_query_code_height(only_if_bigger) {
		// line-height: 1.25
		// padding: 2 * 1
		// border: 2 * 0.125
		var height = $result_query_code[0].value.split("\n").length*1.25 + 2 + 0.25;
		if (only_if_bigger ? current_query_code_height < height : current_query_code_height !== height) {
			$result_query_code.css("height", height+"em");
			current_query_code_height = height;
		}
	}
	set_query_code_height(); // do this once, in case the browser fills in some previous value

	$result_query_code
		.on("change blur", function () { set_query_code_height(); })
		.on("keydown", function (e) {
			e.stopPropagation();
			if (e.which === KEY_ENTER && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				$result_query_run.focus().click();
			}
		})
		.on("keyup", function () {
			update_query_code(this.value === query_code_last_run);
			set_query_code_height(true);
		});
	$result_query.on("submit", function (e) {
		e.preventDefault();
		query_and_show($result_query_code[0].value, focus_code_or_result);
	});
	$result_query_reset.on("click", function () {
		$(this).blur();
		$result_query_code.val(query_code_last_run);
		set_query_code_height();
		update_query_code(true);
	});


	// search
	var ALL_SEARCH_CLASSES = "emptyquery current-is-dbs current-is-indb current-results other-results current-noresults other-noresults",
		search_prev_active, search_blur_timeout, last_search_value,
		search_data,
		search_opened_at,
		showing_search_results,
		search_current_result_pos;
	function show_search() {
		search_prev_active = document.activeElement;
		$(search_prev_active).blur();
		search_opened_at = +new Date();
		$search.removeClass(ALL_SEARCH_CLASSES).addClass("emptyquery");
		$search_input.val("");
		show($search);
		$search_input.focus();
		$columns.removeClass("focus");
	}
	function hide_search() {
		$search_content[0].scrollTop = 0;
		$search_input.val("");
		hide($search);
	}
	function hide_search_and_focus() {
		hide_search();
		if (search_prev_active) {
			$(search_prev_active).focus();
		}
	}
	function delayed_hide_search() {
		/*var now = +new Date();
		if (search_opened_at && now < search_opened_at + 200) {
			search_blur_timeout = setTimeout(function () {
				if (document.activeElement !== $search_input[0]) {
					hide_search();
				}
			}, now - search_opened_at);
		} else {*/
			search_blur_timeout = setTimeout(hide_search, 100);
		/*}*/
	}
	function clear_search_timeout() {
		clearTimeout(search_blur_timeout);
	}
	function perform_search() {
		function mark(matches, hay) {
			var i;
			for (i = 0; i < matches.length; i++) {
				hay[ matches[i][0] ] = "<mark>" + hay[ matches[i][0] ];
				hay[ matches[i][1] - 1 ] += "</mark>";
			}
			return hay.join("");
		}
		function html_escape_to_array(str) {
			var i, arr = (str+"").split("");
			for (i = 0; i < arr.length; i++) {
				if (arr[i] === "&") {
					arr[i] = "&amp;";
				} else if (arr[i] === "<") {
					arr[i] = "&lt;";
				}
			}
			return arr;
		}
		function show_results_in($selection_list, matches) {
			var i, j, key, obj, match, html,
				pre, $a,
				matches_showing = {},
				showing_results = [];
			$selection_list.text("");
			for (i = 0, j = 0; j < 20 && i < matches.length; i++) {
				match = matches[i];
				obj = match.text;
				key = obj.type === "db" ? obj.db : obj.db + "." + obj.table;
				if (matches_showing[key] !== true) {
					matches_showing[key] = true;
					showing_results.push(obj);
					$a = $("<a>", {
						href: "",
						html: (obj.search_table_only ? obj.db + "." : "") + mark(match.match, html_escape_to_array(match.text)), // TODO html encode
						title: key
					});
					$("<li>").append($a).appendTo($selection_list);
					j++;
				}
			}
			return showing_results;
		}
		var i, j, matches_current, matches_other, search_term,
			search_data_current, search_data_other,
			showing_results_current, showing_results_other;

		// split search_data into current and other
		if (current_db === undefined) {
			search_data_current = search_data.dbs;
			search_data_other = [];
			for (i in search_data.tables) {
				for (j = 0; j < search_data.tables[i].length; j++) {
					search_data_other.push(search_data.tables[i][j]);
				}
			}
		} else {
			$search_current_db_text.text(current_db);
			search_data_current = search_data.tables[current_db];
			search_data_other = search_data.dbs;
			for (i in search_data.tables) {
				if (i !== current_db) {
					for (j = 0; j < search_data.tables[i].length; j++) {
						search_data_other.push(search_data.tables[i][j]);
					}
				}
			}
		}

		search_term = $search_input.val();

		matches_current = fuzzy_match(search_term, search_data_current);
		matches_other = fuzzy_match(search_term, search_data_other);

		//con.log("Got " + matches_current.length + " current matches, " + matches_other.length + " other matches");
		//con.log(search_data_other.map(function (i) { return ""+i}));
		//con.log(matches_other.slice(0,10));

		showing_results_current = show_results_in($search_current_results, matches_current);
		showing_results_other = show_results_in($search_other_results, matches_other);

		$search_links = $search_content.find("a");
		showing_search_results = showing_results_current.concat(showing_results_other);
		search_current_result_pos = undefined;
		focus_search_result(0, {focus_element: false});

		$search.removeClass(ALL_SEARCH_CLASSES);
		$search.addClass([matches_current.length ? "current-results" : "current-noresults",
			matches_other.length ? "other-results" : "other-noresults",
			current_db === undefined ? "current-is-dbs" : "current-is-indb"
		].join(" "));
	}
	function focus_search_result(pos, options) {
		var focus_element, scroll;
		if (options) {
			focus_element = options.focus_element;
			scroll = options.scroll;
		}
		if ($search_links[pos]) {
			if (search_current_result_pos !== undefined) {
				$($search_links[search_current_result_pos]).removeClass("selected");
			}
			search_current_result_pos = pos;
			$($search_links[pos]).addClass("selected");
			if (focus_element === undefined || focus_element) {
				$($search_links[pos]).focus();
			}
			if (scroll === undefined || scroll) {
				scroll_search_pos();
			}
		}
	}
	function scroll_search_pos() {
		var focus_elem = $search_links[search_current_result_pos],
			search_content_offset = parseInt($search_content.css("border-top-width"), 10),
			parent_offset = focus_elem.offsetTop - search_content_offset,
			parent_height = $search_content[0].offsetHeight - search_content_offset,
			elem_height = focus_elem.offsetHeight,
			scroll_top = $search_content[0].scrollTop,
			extra_margin = elem_height * 1.5;

		if (search_current_result_pos === 0) {
			$search_content[0].scrollTop = 0;
		} else if (search_current_result_pos + 1 === $search_links.length) {
			$search_content[0].scrollTop = parent_height;
		} else if (parent_offset < scroll_top + extra_margin) {
			// scroll up
			$search_content[0].scrollTop = parent_offset - extra_margin;
		} else if (scroll_top + parent_height < parent_offset + elem_height + extra_margin) {
			// scroll down
			$search_content[0].scrollTop = parent_offset + elem_height - parent_height + extra_margin;
		}
	}
	function search_select(pos) {
		var item = showing_search_results[pos],
			db = item.db,
			table = item.table,
			type = item.type;
		if (type === "db") {
			hide_search();
			select_db(db);
		} else  if (type === "table") {
			hide_search();
			select_db_and_table(db, table);
		}
	}
	function search_item_to_string() {
		if (this.type === "db") {
			return this.db;
		} else {
			// type === "table"
			if (this.search_table_only) {
				return this.table;
			} else {
				return this.db + "." + this.table;
			}
		}
	}
	function purge_search_data(next) {
		if (purge_search_data.next) {
			purge_search_data.next = next;
			return;
		}
		purge_search_data.next = next;
		var data_created,
			data = {dbs:[], tables:{}};
		query_cache("SHOW DATABASES", function (err, databases) {
			// FIXME error handling
			var i, db,
				queries = [];
			databases = databases.data;
			for (i = 0; i < databases.length; i++) {
				db = databases[i][0];
				data.dbs.push({type:"db", db:db, toString: search_item_to_string});
				queries[i] = "SHOW TABLES IN " + mysql.identifier(db);
			}

			query_cache(queries, function (err, all_tables) {
				if (queries.length === 1) {
					queries = [queries];
				}

				var i, j, db, tables, table;
				for (i = 0; i < all_tables.length; i++) {
					db = databases[i][0];
					tables = all_tables[i].data;
					data.tables[db] = [];
					for (j = 0; j < tables.length; j++) {
						table = tables[j][0];
						data.tables[db].push({type:"table", db:db, table:table, toString: search_item_to_string});
						data.tables[db].push({type:"table", db:db, table:table, search_table_only:true, toString: search_item_to_string});
					}
				}

				search_data = data;
				search_data.created = +new Date();
				next = purge_search_data.next;
				purge_search_data.next = undefined;
				next && next();
			});
		});
	}

	function search_keydown(e) {
		var to_focus,
			which = e.which;
		if (which === KEY_ESCAPE) {
			hide_search_and_focus();
			e.stopPropagation();
		} else if (which === KEY_ENTER) {
			e.preventDefault();
			search_select(search_current_result_pos);
		} else if (which === KEY_DOWN || which === KEY_UP || which === KEY_PG_DOWN || which === KEY_PG_UP) {
			to_focus = navigate_list_keydown(which, search_current_result_pos, $search_links.length);
			if (to_focus !== false) {
				focus_search_result(to_focus);
				e.preventDefault();
			}
		} else {
			if (this !== $search_input[0]) {
				if (which !== KEY_TAB && which !== KEY_SHIFT && which !== KEY_CTRL && which !== KEY_ALT && which !== KEY_META) {
					$search_input.focus();
					e.stopPropagation();
				} else {
					con.log(which);
				}
			}
		}
	}
	function search_blur() {
		if ($search_input.val() === "") {
			delayed_hide_search();
		}
	}
	$search.on("mouseenter", function () {
		$search_input.focus();
	});
	$search_content.on({
		focus: function () {
			clear_search_timeout();
			var pos = index_of.call($search_links, this);
			focus_search_result(pos, {focus_element:false});
		},
		blur: search_blur,
		keydown: search_keydown,
		click: function (e) {
			e.preventDefault();
			var pos = index_of.call($search_links, this);
			search_select(pos);
		},
		mouseenter: function (e) {
			var pos = index_of.call($search_links, this);
			focus_search_result(pos, {focus_element:false, scroll:false});
		}
	}, "a");
	$search_input.on({
		focus: clear_search_timeout,
		blur: search_blur,
		keydown: search_keydown,
		keyup: function (e) {
			var purge_needed;
			if (last_search_value !== this.value) {
				last_search_value = this.value;
				purge_needed = !search_data || +new Date() + 1000*60 < search_data.created;
				if (last_search_value === "") {
					// no search results yet: show info
					$search.removeClass(ALL_SEARCH_CLASSES).addClass("emptyquery");
					if (purge_needed) {
						purge_search_data();
					}
				} else {
					if (purge_needed) {
						purge_search_data(perform_search);
					} else {
						perform_search();
					}
				}
			}
		}
	});
});
