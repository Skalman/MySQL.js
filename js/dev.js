(function (window, $) {

	$(function () {
		$(
			'<ul accesskey="l" title="[L]" id="logs" class="right">' +
				'<li id="clear-logs" title="Clear logs">×</li>' +
				'<li><a href="" id="last_response">Last response</a></li>' +
			'</ul>'
		).appendTo("body");
		$(
			'<tr>' +
				'<td><span class="key">L</span></td>' +
				'<td>Move log window</td>' +
			'</tr>'
		).appendTo("#shortcut-info table");

		$("#last_response").on("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			alert(window.con.last_response + "");
		});
	});


	var load_time = +new Date;

	window.con = {
		error: function (obj) { con.log(obj, true); },
		log: function (obj, err) {
			var d = Math.round((new Date - load_time) / 100)/10,
				t = typeof obj;
			if (err) {
				console.error(obj);
			} else {
				console.log(obj);
			}
			if (t === "object" && t !== null) {
				obj = JSON.stringify(obj);
			}
			$("<li>", {text:obj, "class":err?"err":""}).prepend($("<small>", {text:d+": "})).appendTo($("#logs"));
			$("#logs").scrollTop(1e8);
		},
		last_response: void 0,
		response: function (response) {
			if (typeof response !== "string") {
				response = JSON.stringify(response, void 0, 2);
				response = response
					.replace(/\[\s*([^\n]+)\s*\]/g, "[$1]")
					;
			}
			con.last_response = response;
		}
	};
	window.onerror = function (message, url, line) {
		var match = url.match(/(([^\/]*\/)?[^\/\?]*)(\?.*)?$/);
		if (match) {
			url = match[1];
		}
		con.error(url + ":" + line + "\n" + message);
	};
	$(function () {
		function switch_log_position() {
			var $logs = $("#logs")[0];
			c = $logs.className;
			$logs.className = c === "right" ? "hidden"
				: c === "hidden" ? "left"
				: "right";
			$(".focus").removeClass("focus");
		}
		$(document).on("keydown", function (e) {
			if (e.which === 76 && !$(e.target).is("input,textarea")) {
				switch_log_position();
			}
		});
		$("#logs").click(switch_log_position);
		$("#clear-logs").click(function (e) {
			e.stopPropagation();
			$($("#logs").find("li").slice(2)).remove();
		});
	});
})(this, jQuery);