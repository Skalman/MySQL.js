function Sql_query(query) {
	"use strict";
	var undefined,
		Sql_tokenize = window.Sql_tokenize,

		// useful functions
		trim = "".trim || function () {
			return this.replace(/^\s+/, "").replace(/\s+$/, "");
		},
		trimRight = "".trimRight || function () {
			return this.replace(/\s+/, "");
		},

		// cached function results
		c_first_query,
		c_count_query,
		c_uc_query,
		c_uc_tokens,
		c_get_limit,
		c_keyword_index,
		c_update_limit;

	function uc_query() {
		c_uc_query = query.toUpperCase();
	}

	function uc_tokens() {
		c_uc_query === undefined && uc_query();
		c_uc_tokens = Sql_tokenize(c_uc_query, {ignore:["whitespace", "comment", "value"]});
	}

	function keyword_index() {
		if (c_keyword_index !== undefined) {
			return;
		}
		c_uc_tokens === undefined && uc_tokens();

		c_keyword_index = {
			SELECT: -1,
			UPDATE: -1,
			DELETE: -1,
			DROP: -1,
			LIMIT: -1,
			INSERT: -1,
			EXPLAIN: -1,
			SHOW: -1,
			COUNT: -1,
			SEPARATOR: -1
		};

		var i, len, val, type;
		for (i = 0, len = c_uc_tokens.length; i < len; i++) {
			val = c_uc_tokens[i].value;
			type = c_uc_tokens[i].type.toUpperCase();
			if (c_keyword_index[val] === -1) {
				c_keyword_index[val] = i;
			} else if (c_keyword_index[type] === -1) {
				c_keyword_index[type] = i;
			}
		}
	}

	function first_query() {
		c_keyword_index === undefined && keyword_index();
		if (c_keyword_index.SEPARATOR === -1) {
			c_first_query = query;
		} else {
			c_first_query = query.substring(0, c_uc_tokens[c_keyword_index.SEPARATOR].start);
		}
	}

	// returns a query if the query will only show part of the results, otherwise false
	function count_query() {
		if (c_count_query !== undefined) {
			return c_count_query;
		}
		c_keyword_index === undefined && keyword_index();
		c_first_query === undefined && first_query();

		var tmp_query, i,
			tok = c_uc_tokens,
			k = c_keyword_index;
		if (k.SELECT !== -1
				&& k.UPDATE === -1
				&& k.DELETE === -1
				&& k.DROP === -1
				&& k.INSERT === -1
				&& k.EXPLAIN === -1
				&& k.SHOW === -1
				&& k.COUNT === -1) {
			// it's a query we want to process

			if (k.LIMIT !== -1) {
				// remove LIMIT
				i = k.LIMIT;
				if (i + 3 < tok.length && tok[i+1].type === "number" && tok[i+2].value === "," && tok[i+3].type === "number") {
					// syntax: LIMIT number, number
					tmp_query = c_first_query.substring(0, tok[i].start) + c_first_query.substring(tok[i+3].start + tok[i+3].value.length);
				} else if (i + 1 < tok.length && tok[i+1].type === "number") {
					// syntax: LIMIT number
					tmp_query = c_first_query.substring(0, tok[i].start) + c_first_query.substring(tok[i+1].start + tok[i+1].value.length);
				} else {
					// unknown syntax or LIMIT isn't one of the tokens
					return c_count_query = false;
				}
			} else {
				tmp_query = c_first_query;
			}
			return c_count_query = "SELECT COUNT(*) FROM (" + trim.call(tmp_query) + ") a";
		} else {
			return c_count_query = false;
		}
	}

	// returns false if no limit is found
	function get_limit() {
		if (c_get_limit !== undefined) {
			return c_get_limit;
		}
		c_keyword_index === undefined && keyword_index();

		var i = c_keyword_index.LIMIT,
			tok = c_uc_tokens;

		if (i === -1) {
			c_get_limit = false;
		} else {
			if (i + 3 < tok.length && tok[i+1].type === "number" && tok[i+2].value === "," && tok[i+3].type === "number") {
				// syntax: LIMIT number, number
				c_get_limit = [+tok[i+1].value, +tok[i+3].value];
			} else if (i + 1 < tok.length && tok[i+1].type === "number") {
				// syntax: LIMIT number
				c_get_limit = [0, +tok[i+1].value];
			} else {
				// unknown syntax or LIMIT isn't one of the tokens
				c_get_limit = false;
			}
		}
		return c_get_limit;
	}

	function update_limit_cache(from, count) {
		if (c_update_limit === false) {
			return false;
		} else {
			var glue;
			if (from <= 0) {
				glue = count;
			} else if (count === undefined) {
				glue = from;
			} else {
				glue = from + ", " + count;
			}
			return c_update_limit[0] + glue + c_update_limit[1];
		}
	}

	// returns false if the query wasn't changed
	function update_limit(from, count) {
		if (c_update_limit !== undefined) {
			return update_limit_cache(from, count);
		}
		c_keyword_index === undefined && keyword_index();
		c_first_query === undefined && first_query();

		var tok = c_uc_tokens,
			k = c_keyword_index,
			i = k.LIMIT;
		if (k.SELECT !== -1
				&& k.UPDATE === -1
				&& k.DELETE === -1
				&& k.DROP === -1
				&& k.INSERT === -1
				&& k.EXPLAIN === -1
				&& k.SHOW === -1
				&& k.COUNT === -1) {
			// it's a query we want count process
			if (from !== undefined) { from += ""; }
			if (count !== undefined) { count += ""; }

			if (i === -1) {
				// doesn't have a limit, add one
				c_update_limit = [trimRight.call(c_first_query) + "\nLIMIT ", ""];
			} else {
				// has a limit, change it
				// syntax: LIMIT number | LIMIT number, number
				if (i + 3 < tok.length && tok[i+1].type === "number" && tok[i+2].value === "," && tok[i+3].type === "number") {
					// syntax: LIMIT number, number
					if (tok[i+1].value === from && tok[i+3].value === count) {
						c_update_limit = false;
					} else {
						c_update_limit = [
							c_first_query.substring(0, tok[i+1].start),
							c_first_query.substring(tok[i+3].start + tok[i+3].value.length)
						];
					}
				} else if (i + 1 < tok.length && tok[i+1].type === "number") {
					// syntax: LIMIT number
					if ("0" === from && tok[i+1].value === count) {
						c_update_limit = false;
					} else {
						c_update_limit = [
							c_first_query.substring(0, tok[i+1].start),
							c_first_query.substring(tok[i+1].start + tok[i+1].value.length)
						];
					}
				} else {
					// unknown syntax, don't change the limit
					c_update_limit = false;
				}
			}
		} else {
			// we haven't processed this query
			c_update_limit = false;
		}
		return update_limit_cache(from, count);
	}

	return {
		count_query: count_query,
		get_limit: get_limit,
		update_limit: update_limit,
		uc_query: uc_query
	};
/*
		c_is_select,
		c_count_query,
		c_uc_query,
		c_uc_tokens,
		c_get_limit,
		c_keyword_index,
		c_update_limit;
*/
}
