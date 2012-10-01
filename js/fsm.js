/*
 * Finite state machine by Dan Wolff (wlff.se/simple-state-machine/)
 * No license, this code is in the public domain. I do however appreciate attribution.
 */

function Finite_state_machine(current, transitions) {
	"use strict";
	function to_json(obj) {
		return JSON.stringify(obj, null, 2);
	}
	function is_string(obj) {
		// as opposed to an array
		return !obj.pop;
	}
	function $(str) {
		return "$" + str;
	}
	function $undo(str) {
		return str.substring(1);
	}
	var $$cache = {};
	function $$(state) {
		// db.in_database.search > :db, :db.in_database, :db.in_database.search
		var $$state = $(state).split("."),
			i = 0;
		while (++i < $$state.length) {
			$$state[i] = $$state[i - 1] + "." + $$state[i];
		}
		// console.log(to_json($$state));
		return $$state;
	}
	function $$undo($$state) {
		// console.log(to_json($$state) + " > " + $undo($$state[$$state.length - 1]));
		return $undo($$state[$$state.length - 1]);
	}

	// both current and transitions are optional
	if (!transitions) {
		if (current && !is_string(current)) {
			transitions = current;
		} else {
			transitions = [];
		}
	}
	if (!current || !is_string(current)) {
		current = "none";
	}

	var undefined,
		listeners_to_call = [],
		listeners = {},
		$$current = $$(current),
		current_data,
		$$last_state = false,
		last_data,
		tmp_transitions = transitions;
	transitions = {};
	bind(tmp_transitions);

	function call_listeners() {
		var i, j, event, listener, matches, match, event_obj;

		for (i = listeners_to_call.length - 1; (event = listeners_to_call[i]); i--) {
			// [event_obj, matches, matched_suffix]
			event_obj = event[0];
			matches = event[1];
			for (j = 0; j < matches.length; j++) {
				match = matches[j];
				if (!match) {
					// removed (we were interrupted last time)
					continue;
				}
				if (is_string(match)) {
					// we have to save the listeners to matches[j] in case somebody interrupts us
					match += event[2] || ""; // add suffix (:leave, :enter or nothing)
					event_obj['match'] = match;
					matches[j] = match = listeners[match]
						? listeners[match].slice(0).reverse()
						: [];
				}

				while (listener = match.pop()) {
					listener(event_obj);
				}
				matches[j] = undefined;
			}
			listeners_to_call.pop();
		}
	}

	// the state machine which will be returned
	function fsm(event, data) {
		if (event) {
			// trigger event

			var i, to_state = can_one(event),
				$$to_state = $$(to_state),
				$$from_state = $$current,
				from_state = $$undo($$from_state),
				$event = $(event),
				event_obj = {
					'name': event,
					'from': from_state,
					'to': to_state,
					'data': data,
					'machine': fsm
					// later: match
				};

			if (!to_state) {
				throw new Error("Can't " + event);
			}

			if (from_state !== to_state) {
				$$last_state = $$current;
				$$current = $$to_state;
				if (can_one(event, true) === ":back") {
					current_data = last_data;
				} else {
					current_data = data;
				}

				// TODO
				if (!$$current) {
					throw $$current;
				}
			}

			i = 0;
			while ($$from_state[i] === $$to_state[i] && $$from_state[i] !== undefined) {
				i++;
			}
			// suffixes :leave and :enter
			$$from_state = $$from_state.slice(i).reverse();
			$$to_state = $$to_state.slice(i);

			// call listeners $$from_state:leave, event, $$to_state:enter, [:change, :event]
			listeners_to_call.unshift(
				// [event, matches, matched_suffix]
				[event_obj, [$(":event"),
					from_state !== to_state && $(":change")]],
				[event_obj, $$to_state, ":enter"],
				[event_obj, [$event]],
				[event_obj, $$from_state, ":leave"]
			);

			call_listeners();
		}

		return $$undo($$current);
	}

	// internal
	function can_one(event, raw) {
		event = transitions[$(event)] || {};
		var i = 0, $$to, to;
		// iterate through $$current
		while (!($$to = event[$$current[i++]]) && i < $$current.length) {
			// go on
		}
		$$to = $$to || event[$("")]; // do we allow all events?
		if ($$to) {
			// if the result is an empty string, the state won't change
			to = $$undo($$to) || $$undo($$current);
			if (!raw && to === ":back") {
				to = $$last_state && $$undo($$last_state);
			}
			return to;
		} else {
			return false;
		}
	}

	function can(events) {
		// events[event][from] === [to, to.state]
		var result, event, i, j;
		if (is_string(events)) {
			result = can_one(events);
		} else {
			result = [];
			i = 0;
			while ((result[i] = can_one(events[i]))) {
				i++;
			}
			if (i !== events.length) {
				result = false;
			}
		}
		return result;
	}

	function data() {
		return current_data;
	}

	function on(event, listener) {
		var i = 0, $event,
			events = is_string(event) ? [event] : event;
		while ((event = events[i++])) {
			$event = $(event);
			if (!listeners[$event]) {
				listeners[$event] = [listener];
			} else {
				listeners[$event].push(listener);
			}
		}
		// for chaining
		return fsm;
	}

	function off(event, listener) {
		var i = 0, j, new_listeners, existing_listener, $event,
			events = is_string(event) ? [event] : event;
		while ((event = events[i++])) {
			new_listeners = [];
			$event = $(event);
			if (listener) {
				j = 0;
				while ((existing_listener = listeners[$event][j++])) {
					if (existing_listener !== listener) {
						new_listeners.push(existing_listener);
					}
				}
			}
			listeners[$event] = new_listeners;
		}
		// for chaining
		return fsm;
	}

	function bind(more_transitions) {
		var item, events, from, $from_arr, $state, $$to, $event,
			// iterator variables
			i = 0, e, s;
		while (item = more_transitions[i++]) {
			// prepare events
			events = item.event;
			if (is_string(events)) {
				events = [events];
			}

			// prepare from states
			from = item.from || "";
			if (is_string(from)) {
				$from_arr = [$(from)];
			} else {
				$from_arr = [];
				s = from.length;
				while (s-- && ($from_arr[s] = $(from[s]))) {
					// go on
				}
			}
			// console.log(item.event + ": " + from + " >>> " + to_json($from_arr));

			// prepare to states
			$$to = $$(item.to || "");

			// add transitions
			e = 0;
			// an empty string events[e] will fail
			while (events[e]) {
				$event = $(events[e++]);
				if (!transitions[$event]) {
					transitions[$event] = {};
				}

				s = 0;
				// $state is at least "$" (empty string not possible)
				while ($state = $from_arr[s++]) {
					transitions[$event][$state] = $$to;
				}
			}
		}
		// console.log(to_json(transitions));
		// for chaining
		return fsm;
	}

	// publish methods
	fsm.can = can;
	fsm.data = data;
	fsm.on = on;
	fsm.off = off;
	fsm.bind = bind;

	return fsm;
}

