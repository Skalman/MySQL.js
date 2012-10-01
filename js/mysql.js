(function (window, $) {
	"use strict";
	var undefined,

		// useful functions
		has_own = {}.hasOwnProperty,
		to_string = {}.toString,
		is_array = [].isArray || function(obj) {
			return to_string.call(obj) === "[object Array]";
		},
		urlencode = function (str) {
			return encodeURIComponent(str).replace(/%20/g, "+");
		},

		options = {
			host: undefined,
			api_url: undefined,
			username: undefined,
			password: undefined,
			db: undefined,
			query_transform: undefined
		};

	function query_transform_dot(query) {
		var i = 0,
			i3 = 0,
			len = query.length,
			res = [];
		while (i3 < len) {
			res[i] = query.substring(i3, i3 + 3);
			i++;
			i3 += 3;
		}
		return res.join(".");
	}

	var mysql = window.mysql = {
		config: function mysql_config(opts) {
			for (var option in opts) {
				if (has_own.call(options, option)) {
					options[option] = opts[option];
				} else {
					throw new Error("Invalid option '" + option + "'");
				}
			}
		},
		get_config: function mysql_get_config() {
			var option, ret = {};
			for (option in options) {
				if (option !== "password" && options[option] !== undefined) {
					ret[option] = options[option];
				}
			}
			return ret;
		},
		value: function mysql_value(value) {
			if (value == null) { // null or undefined
				return "NULL";
			} else if (typeof value === "number") {
				return value;
			} else {
				return ("'" + value.replace(/[\0\n\r\\'"\x1a]/g, "\\$1") + "");
			}
		},
		identifier: function mysql_identifier(name) {
			// TODO find some foolproof way to identify keywords
			if (typeof name !== "string") {
				throw new Error("Expected 'name' to be a string, was " + name);
			}
			if (false && /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(name)) {
				return name;
			} else {
				return "`" + name.replace(/`/g, "``") + "`"; // TODO verify
			}
		},

		query: function mysql_query(query, next) {
			var i = 0, len, is_single_query,
				query_transform = options.query_transform;
			if (typeof query !== "string") {
				con.log("[mysql.query]\n" + query.join(";\n").replace(/;;\n/g, ";\n"));
			} else if (query.indexOf("\n") === -1) {
				con.log("[mysql.query] " + query);
			} else {
				con.log("[mysql.query]\n" + query);
			}
			is_single_query = !is_array(query);
			if (is_single_query) {
				query = [query];
			}
			for (i = 0, len = query.length; i < len; i++) {
				if (query_transform) {
					if (query_transform === ".") {
						query_transform = query_transform_dot;
					}
					query[i] = "q=" + urlencode(query_transform(query[i]));
				} else {
					query[i] = "q=" + urlencode(query[i]);
				}
			}
			if (options.host !== undefined) { query[i++] = "q_host=" + urlencode(options.host); }
			if (options.username !== undefined) { query[i++] = "q_username=" + urlencode(options.username); }
			if (options.password !== undefined) { query[i++] = "q_password=" + urlencode(options.password); }
			if (options.db !== undefined) { query[i++] = "q_db=" + urlencode(options.db); }

			query = query.join("&");

			function find_error_message(result) {
				var container, text, i, len;
				try {
					container = result[result.error];
					if (is_array(container)) {
						for (i = 0, len = container.length; i < len; i++) {
							if (container[i].error) {
								text = container[i].error;
								break;
							}
						}
					} else {
						text = container.error;
					}
					if (result.q) {
						result = result.q;
					}
				} catch (e) {}
				return [text, result];
			}

			$.ajax({
				url: options.api_url,
				type: "POST",
				data: query,
				cache: false,
				dataType: "json",
				success: function (data, text_status, xhr) {
					con.response(data);
					var err;
					if (data.error) {
						err = find_error_message(data);
						con.error(err);
						data = err[1];
						err = err[0] || "Internal error";
					} else {
						// temporary, for debug
						/*
						var rows, i, len, q = data.q;
						if (q.columns) {
							len = q.data.length;
							if (len && len < 6) {
								rows = [];
								for (i = 0; i < len; i++) {
									rows[i] = q.data[i].join("|");
								}
							} else {
								rows = len + " rows";
							}
							con.log({columns: q.columns.join(" "), data: rows});
						} else {
							con.log(data.q);
						}
						*/
						data = data.q;
					}
					if (is_single_query && data[0]) {
						data = data[0];
					}
					next(err, data);
				},
				error: function (xhr, text_status, error_thrown) {
					con.response(xhr.responseText);
					var result = [undefined, undefined];
					try {
						result = find_error_message($.parseJSON(xhr.responseText));
					} catch (e) {}
					next(result[0] || error_thrown, result[1]);
				}
			});
		}
	};
})(this, jQuery);
