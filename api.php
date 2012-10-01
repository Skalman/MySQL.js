<?php
require 'config.php';
error_reporting(E_ALL);

header('Content-Type: application/json');

set_error_handler('error_handler');


function error_handler($errno, $errstr, $errfile, $errline) {
	if (!(error_reporting() & $errno)) {
		return;
	}
	if (strpos($errfile, $_SERVER['DOCUMENT_ROOT']) === 0) {
		$errfile = substr($errfile, strlen($_SERVER['DOCUMENT_ROOT']));
	}
	error('500 Internal Server Error', "$errstr in $errfile:$errline");
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
	error('405 Method Not Allowed', 'Only POST requests are supported');
}

$post = parse_post_data(file_get_contents('php://input'));

$result = array();
$modules = array(
	'q' => 'query',
	'try' => 'try_credentials',
);

foreach ($post as $param => $value) {
	if (isset($modules[$param])) {
		$error = false;
		$result[$param] = $modules[$param]($post, $error);
		if ($error) {
			if (!isset($result['error'])) {
				$result['error'] = array($param);
			} else {
				$result['error'][] = $param;
			}
		}
	}
}
if (!$result) {
	error('400 Bad Request', 'No valid parameters');
}

echo json_encode($result);

function parse_post_data($str) {
	$result = array();
	$parts = explode('&', $str);
	foreach ($parts as $part) {
		if (strpos($part, '=') === false) {
			// boolean parameter
			$key = urldecode($part);
			$value = true;
		} else {
			list($key, $value) = explode('=', $part, 2);
			$key = urldecode($key);
			$value = urldecode($value);
		}
		if (!isset($result[$key])) {
			$result[$key] = $value;
		} elseif (!is_array($result[$key])) {
			$result[$key] = array($result[$key], $value);
		} else {
			$result[$key][] = $value;
		}
	}
	return $result;
}

function query($post, &$error) {
	$queries = $post['q'];
	if (is_string($queries)) {
		$queries = array($queries);
	}
	$results;

	if (isset($GLOBALS['host'])) {
		$host = $GLOBALS['host'];
	} elseif (isset($post['q_host'])) {
		$host = $post['host'];
	} else {
		$error = true;
		return array('error' => "Parameter 'q_host' required");
	}

	// connect
	if (isset($post['q_username'], $post['q_password'])) {
		$status = @mysql_connect($host, $post['q_username'], $post['q_password']);
	} else {
		$status = @mysql_connect($host);
	}
	if (!$status) {
		$error = true;
		return query_error(count($queries));
	}

	// select db if chosen
	if (isset($post['q_db'])) {
		if (!mysql_select_db($post['q_db'])) {
			$error = true;
			$return = query_error(count($queries));
			mysql_close();
			return $return;
		}
	}

	// perform queries
	$return = array();
	foreach ($queries as $query) {
		if (!$error) {
			$return[] = query_perform($query, $error);
		} else {
			$return[] = array('error' => 'Aborted');
		}
	}

	mysql_close();
	return $return;
}

function query_perform($query, &$error) {
	if (isset($GLOBALS['query_transform']) && $GLOBALS['query_transform'] === '.') {
		$res = '';
		$len = strlen($query);
		for ($i = 0; $i < $len; $i += 4) {
			$res .= substr($query, $i, 3);
		}
		$query = $res;
	}
	$result = mysql_query($query);
	if ($result === false) {
		// error
		$error = true;
		return array('error' => mysql_error());
	} elseif ($result === true) {
		// success
		return array(
			'affected_rows' => mysql_affected_rows(),
			'error' => false,
		);
	} else {
		// return a table of data

		// get columns
		$columns = array();
		$num_columns = mysql_num_fields($result);
		for ($i = 0; $i < $num_columns; $i++) {
			$columns[] = mysql_field_name($result, $i); 
		}

		// get data
		$post = array();
		while ($row = mysql_fetch_row($result)) {
			$post[] = $row;
		}
		mysql_free_result($result);

		return array(
			'columns' => $columns,
			'data' => $post,
			'error' => false,
		);
	}
}

function query_error($count) {
	$error = array('error' => mysql_error());
	if ($count === 1) {
		return $error;
	} else {
		return array_fill(0, $count, $error);
	}
}

function error($status, $message) {
	header("HTTP/1.1 $status");
	header("X-Error: $message");
	echo json_encode(array(
		'error' => array('*'),
		'*' => array('error' => $message),
	));
	exit;
}
