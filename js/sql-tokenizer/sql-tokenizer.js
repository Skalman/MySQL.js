function Sql_tokenize(query, options) {
	"use strict";
	var undefined, i,
		length = query.length,
		const_count = 0,
		END = const_count++,
		UNEXPECTED_END = const_count++,
		SEPARATOR = const_count++,
		UNKNOWN = const_count++,
		WHITESPACE = const_count++,
		SINGLE_LINE_COMMENT = const_count++,
		MULTILINE_COMMENT = const_count++,
		VALUE = const_count++,
		IDENTIFIER = const_count++,
		QUOTED_IDENTIFIER = const_count++,
		NUMBER = const_count++,
		OPERATOR_1 = const_count++,
		OPERATOR_2 = const_count++,
		type_names = [],
		result = [],

		// options
		ignore = {},
		allow_multiline_comments = true;

	type_names[UNEXPECTED_END] = "unexpected end";
	type_names[SEPARATOR] = "separator";
	type_names[UNKNOWN] = "unknown";
	type_names[WHITESPACE] = "whitespace";
	type_names[SINGLE_LINE_COMMENT] = "comment";
	type_names[MULTILINE_COMMENT] = "comment";
	type_names[VALUE] = "value";
	type_names[IDENTIFIER] = "identifier";
	type_names[QUOTED_IDENTIFIER] = "identifier";
	type_names[NUMBER] = "number";
	type_names[OPERATOR_1] = "operator";
	type_names[OPERATOR_2] = "operator";


	// parse options
	if (options !== undefined) {
		if (options.ignore) {
			for (i = 0; i < options.ignore.length; i++) {
				ignore[options.ignore[i]] = true;
			}
		}
		if (options.allow_multiline_comments !== undefined && !options.allow_multiline_comments) {
			allow_multiline_comments = false;
		}
	}

	function error(message) {
		throw new Error("[SQL Tokenizer] Internal error: " + message);
	}

	function add_token(type, start, end) {
		var name = type_names[type];
		if (name === undefined) {
			error("Don't know the name for token type " + type);
		}
		if (!ignore[name]) {
			result.push({
				type: name,
				start: start,
				value: query.substring(start, end)
			});
		}
		return end;
	}

	function is_whitespace(ch) {
		return ch === " " || ch === "\n" || ch === "\t";
	}

	function is_digit(ch) {
		return "0" <= ch && ch <= "9";
	}

	function is_identifier_start(ch) {
		return ch === "_" || ("a" <= ch && ch <= "z") || ("A" <= ch && ch <= "Z");
	}

	function is_identifier_char(ch) {
		return is_identifier_start(ch) || is_digit(ch);
	}


	function get_token_type(i) {
		var ch1, ch2, ret;
		if (i >= length) {
			return END;
		} else {
			ch1 = query.charAt(i);

			if (ch1 === "'") {
				ret = VALUE;
			} else if (ch1 === "`") {
				ret = QUOTED_IDENTIFIER;
			} else if (ch1 === ";") {
				ret = SEPARATOR;
			} else if (is_whitespace(ch1)) {
				ret = WHITESPACE;
			} else if (is_digit(ch1)) {
				ret = NUMBER;
			} else if (is_identifier_start(ch1)) {
				ret = IDENTIFIER;
			} else if (".,()+*=".indexOf(ch1) !== -1) {
				ret = OPERATOR_1;
			} else {
				ret = undefined;
			}
			if (ret !== undefined) {
				return ret;
			}

			ch2 = query.charAt(i + 1);
			if (ch1 === "-") {
				if (ch2 === "-") {
					ret = SINGLE_LINE_COMMENT;
				} else {
					ret = OPERATOR_1;
				}
			} else if (ch1 === "/") {
				if (ch2 === "*") {
					if (allow_multiline_comments) {
						ret = MULTILINE_COMMENT;
					} else {
						ret = OPERATOR_1;
					}
				} else {
					ret = OPERATOR_1;
				}
			} else if (ch1 === "." && is_digit(ch2)) {
				ret = NUMBER;
			} else if (ch1 === "!" && ch2 === "=") {
				ret = OPERATOR_2;
			} else {
				ret = UNKNOWN;
			}
			return ret;
		}
	}

	function process_token(i) {
		var type = get_token_type(i);
		return UNKNOWN === type ? process_unknown(i)
			: WHITESPACE === type ? process_whitespace(i)
			: SEPARATOR === type ? process_separator(i)
			: SINGLE_LINE_COMMENT === type ? process_single_line_comment(i)
			: MULTILINE_COMMENT === type ? process_multiline_comment(i)
			: VALUE === type ? process_value(i)
			: QUOTED_IDENTIFIER === type ? process_quoted_identifier(i)
			: IDENTIFIER === type ? process_identifier(i)
			: NUMBER === type ? process_number(i)
			: OPERATOR_1 === type ? process_operator(i, 1)
			: OPERATOR_2 === type ? process_operator(i, 2)
			: error("Cannot process process token of type " + type);
	}

	function process_unknown(i) {
		var start = i;
		i++;
		while (get_token_type(i) === UNKNOWN) {
			i++;
		}
		return add_token(UNKNOWN, start, i);
	}

	function process_whitespace(i) {
		var start = i;
		do {
			i++;
		} while (is_whitespace(query.charAt(i)));
		return add_token(WHITESPACE, start, i);
	}

	function process_separator(i) {
		return add_token(SEPARATOR, i, i + 1);
	}

	function process_single_line_comment(i) {
		var start = i;
		i = query.indexOf("\n", start + 2);
		if (i === -1) {
			i = query.length;
		}
		return add_token(SINGLE_LINE_COMMENT, start, i);
	}

	function process_multiline_comment(i) {
		var start = i,
			unexpected_end = false;
		i = query.indexOf("*/", start + 2);
		if (i !== -1) {
			i += 2;
		} else {
			i = query.length;
			unexpected_end = true;
		}
		add_token(MULTILINE_COMMENT, start, i);
		if (unexpected_end) {
			add_token(UNEXPECTED_END, i, i);
		}
		return i;
	}

	function process_value(i) {
		var ch1, ch2,
			start = i;
		i++;
		while (ch1 !== "'" && i < length) {
			ch1 = query.charAt(i);
			i++;
			if (ch1 === "\\") {
				ch2 = query.charAt(i);
				if (ch2 === "\\" || ch2 === "'") {
					i++;
				}
			}
		}
		add_token(VALUE, start, i);
		if (ch1 !== "'") {
			add_token(UNEXPECTED_END, i, i);
		}
		return i;
	}

	function process_quoted_identifier(i) {
		var ch,
			start = i;
		i++;
		while (ch !== "`" && i < length) {
			ch = query.charAt(i);
			i++;
			if (ch === "`" && query.charAt(i) === "`") {
				ch = undefined;
				i++;
			}
		}
		add_token(QUOTED_IDENTIFIER, start, i);
		if (ch !== "`") {
			add_token(UNEXPECTED_END, i, i);
		}
		return i;
	}

	function process_identifier(i) {
		var start = i;
		do {
			i++;
		} while (is_identifier_char(query.charAt(i)));
		return add_token(IDENTIFIER, start, i);
	}

	function process_number(i) {
		var last_i, ch,
			had_point = false,
			had_e = false,
			start = i;

		while (i !== last_i && i < length) {
			ch = query.charAt(i);
			last_i = i;
			if (is_digit(ch)) {
				i++;
			} else if (!had_point && ch === ".") {
				had_point = true;
				i++;
			} else if (!had_e && (ch === "e" || ch === "E")) {
				ch = query.charAt(i + 1);
				if ((ch === "+" || ch === "-") && is_digit(query.charAt(i + 2))) {
					i += 3;
					had_e = true;
				} else if (is_digit(ch)) {
					i += 2;
					had_e = true;
				}
			}
		}
		return add_token(NUMBER, start, i);
	}

	function process_operator(i, length) {
		return add_token(length === 1 ? OPERATOR_1 : OPERATOR_2, i, i + length);
	}

	i = 0;
	while (i < length) {
		i = process_token(i);
	}

	return result;
}
