// wlff.se/simple-state-machine/
function Sm(b,f){return function g(a,c,e,d){if(a){c=b;b=f[a][b]||a();e=["leave"+c,a,"enter"+b];for(d=0;3>d;)(a=g["on"+e[d++]])&&a(c)}return b}}
// TODO
function Ssm(d,b){function c(a){if(!e(a))throw"Can't "+a;b[a].to&&(c.current=b[a].to)}function e(a){a=b[a]?b[a].from:" ";return!a||-1!==(" "+a+" ").indexOf(" "+c.current+" ")}c.current=b?d:"none";b||(b=d);c.can=e;c.events=b;return c}

function Complex_state_machine(machines) {
	var i, j, events = {};
	function fsm(event) {
		machines = events[event];
		if (!machines) {
			throw "Can't " + event;
		}

		for (i in machines) {
			if (!machines[i].can(event)) {
				throw "Can't " + event + " because of machine " + i;
			}
		}
		for (i in machines) {
			machines[i](event);
		}
	}
	function can(event) {
		machines = events[event];
		if (!machines) {
			return false;
		}

		for (i in machines) {
			if (!machines[i].can(event)) {
				return false;
			}
		}
		return true;
	}

	for (i in machines) {
		for (j in machines[i].events) {
			if (!events[j]) {
				events[j] = {};
			}
			events[j][i] = machines[i];
		}
	}
	fsm.machines = machines;
	fsm.can = can;
	fsm.events = events;
	return fsm;
}
