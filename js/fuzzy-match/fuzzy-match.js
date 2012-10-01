function fuzzy_match(search, hay_stacks) {
	"use strict";

	function calculate_score(search, hay_stack) {
		var 

			// constants
			INITIAL_SCORE = 10,
			SEQUENCE_SCORE = 10,
			ADDITIONAL_CHAR_SCORE = -1,

			// variables
			i, hay_last, hay_this, hay_start, matches, matches_group,
			search_len = search.length,
			hay_len = hay_stack.length,
			score = 0;

		score += ADDITIONAL_CHAR_SCORE * (hay_len - search_len);

		if (search === hay_stack) {
			return {score: INITIAL_SCORE + (search_len - 1) * SEQUENCE_SCORE, match: [[0, search_len]]};
		} else if (hay_len <= search_len || search_len === 0) {
			return false;
		} else if ((hay_this = hay_stack.indexOf(search)) !== -1) {
			score += hay_this === 0 ? INITIAL_SCORE : 0;
			score += (search_len - 1) * SEQUENCE_SCORE;
			return {score: score, match: [[hay_this, hay_this + search_len]]};
		}

		// find matching characters
		matches = [];
		hay_last = -1;
		for (i = 0; i < search_len; i++) {
			matches[i] = hay_last = hay_stack.indexOf(search.charAt(i), hay_last + 1);

			if (hay_last === -1) {
				// no match
				return false;
			}
		}

		// group matches
		matches_group = [];
		hay_start = matches[0];
		hay_last = hay_start;
		for (i = 1; i < search_len; i++) {
			hay_this = matches[i];
			if (hay_last + 1 !== hay_this) {
				matches_group.push([hay_start, hay_last + 1]);
				hay_start = hay_this;
			}
			hay_last = hay_this;
		}
		matches_group.push([hay_start, hay_last + 1]);

		// calculate score
		score += hay_this === 0 ? INITIAL_SCORE : 0;
		score += SEQUENCE_SCORE * (search_len - matches_group.length);
		return {score: score, match: matches_group};
	}

	search = (""+search).toLowerCase();

	var i, len, this_score,
		scores = [];

	for (i = 0, len = hay_stacks.length; i < len; i++) {
		this_score = calculate_score(search, (""+hay_stacks[i]).toLowerCase());
		if (this_score !== false) {
			this_score.text = hay_stacks[i];
			scores.push(this_score);
		}
	}

	// sort in descending order by score
	scores.sort(function (a, b) {
		return b.score - a.score;
	});

	return scores;

}
