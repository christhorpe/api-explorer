(function() {
	window.gdn = window.gdn || {};
	
	/* JSON stuff starts */
	var ARRAY_START = '<span class="array-start">[</span>';
	var ARRAY_END   = '<span class="array-end">]</span>';
	var OBJECT_START = '<span class="object-start">{</span>';
	var OBJECT_END = '<span class="object-end">}</span>';
	var COMMA = '<span class="comma">,</span>';
	var COLON = '<span class="colon">:</span> ';

	function isObject(obj) {
		return (typeof obj == 'object') && (obj !== null);
	}

	function isArray(obj) {
		return isObject(obj) && (typeof obj.length == 'number');
	}

	function isPrimitive(obj) {
		return !isArray(obj) && !isObject(obj);
	}

	function keysForObject(obj) {
		var keys = [];
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				keys[keys.length] = key;
			}
		}
		return keys;
	}

	function doObject(obj, indent) {
		indent = indent || 0;
		var lines = [[indent, OBJECT_START]];
		indent++;
		var keys = keysForObject(obj);
		for (var x = 0, y = keys.length; x < y; x++) {
			var key = keys[x];
			var value = obj[key];
			var isLast = (x + 1 == y);
			if (isPrimitive(value)) {
				lines[lines.length] = [indent, htmlForPair(key, value)];
			} else {
				var innerLines = doCollection(value, indent);
				if (innerLines) {
					// Steal the first one and combine with our line
					lines[lines.length] = [
						indent, htmlForPair(key, innerLines[0][1])
					];
					// Glue on the other ines
					for (var i = 1, j = innerLines.length; i < j; i++) {
						lines[lines.length] = innerLines[i];
					}
				}
			}
			if (!isLast) {
				lines[lines.length - 1][1] += COMMA;
			}
		}
		indent--;
		lines[lines.length] = [indent, OBJECT_END];
		return lines;
	}

	function doArray(obj, indent) {
		indent = indent || 0;
		var lines = [[indent, ARRAY_START]];
		indent++;
		for (var i = 0, j = obj.length; i < j; i++) {
			var value = obj[i];
			if (isPrimitive(value)) {
				lines[lines.length] = [indent, htmlForValue(value)];
			} else {
				var innerLines = doCollection(value, indent);
				for (var s = 0, t = innerLines.length; s < t; s++) {
					lines[lines.length] = innerLines[s];
				}
			}
			// Should we have a comma?
			if (i < j - 1) {
				lines[lines.length - 1][1] += COMMA;
			}
		}
		indent--;
		lines[lines.length] = [indent, ARRAY_END];
		return lines;
	}

	function doCollection(obj, indent) {
		indent = indent || 0;
		if (isArray(obj)) {
			return doArray(obj, indent);
		} else {
			return doObject(obj, indent);
		}
	}

	function htmlForPair(key, value) {
		return (
			'<span class="key">"' + key + '"</span>' + 
			COLON + htmlForValue(value)
		);
	}

	function htmlForValue(value) {
		if (value == ARRAY_START || value == ARRAY_END || 
			value == OBJECT_START || value == OBJECT_END) {
			return value;
		}
		// Assume not a primitive
		if (value === null) {
			return '<span class="null">null</span>';
		}
		if (typeof value == 'string') {
			return (
				'"<span class="string">' + prepareContent(value) + '</span>"'
			);
		}
		if (typeof value == 'number') {
			return '<span class="number">' + value + '</span>';
		}
		if (typeof value == 'boolean') {
			return '<span class="boolean">' + value + '</span>';
		}
		alert(value + ' is unknown type: ' + typeof value);
	}

	function render(lines) {
		var wrapper = document.createElement('div');
		wrapper.className = 'highlighted-json';
		for (var i = 0, pair; pair = lines[i]; i++) {
			var indent = pair[0];
			var html = pair[1];
			var div = document.createElement('div');
			div.style.marginLeft = (indent * 1.5) + 'em';
			div.innerHTML = html;
			wrapper.appendChild(div);
		}
		return wrapper
	}
	
	function htmlFromJson(json) {
		return render(doCollection(json));
	}
	/* JSON stuff ends */
	
	/* XML stuff starts */
	function getChildren(node) {
		var children = [];
		for (var i = 0, j = node.childNodes.length; i < j; i++) {
			if (node.childNodes[i].nodeType == 1) {
				children[children.length] = node.childNodes[i];
			}
		}
		return children;
	}
	function makeSpan(contents, optionalClass) {
		var span = document.createElement('span');
		span.innerHTML = contents;
		if (optionalClass) {
			span.className = optionalClass;
		}
		return span;
	}
	function buildListFromXml(ol, root) {
		var li = document.createElement('li');
		li.appendChild(makeSpan(
			'&lt;' + root.tagName + attrString(root) + '&gt;', 't'
		));
		var children = getChildren(root);
		var closeTagSpan = makeSpan('&lt;/' + root.tagName + '&gt;', 't');
		if (children.length) {
			var inner_ol = document.createElement('ol');
			var inner_li = document.createElement('li');
			inner_li.appendChild(inner_ol);
			li.appendChild(inner_li);
			for (var i = 0, child; child = children[i]; i++) {
				buildListFromXml(inner_ol, child);
			}
			var close_li = document.createElement('li');
			li.appendChild(closeTagSpan);
			ol.appendChild(li);
		} else {
			var s = extractText(root);
			if (s) {
				li.appendChild(makeSpan(prepareContent(s), 'c'));
			}
			li.appendChild(closeTagSpan);
		}
		ol.appendChild(li);
	}
	function extractText(el) {
		var s = '';
		for (var i = 0, child; child = el.childNodes[i]; i++) {
			if (child.nodeType != 8) {
				if (child.nodeType != 1) {
					s += child.nodeValue;
				} else {
					s += extractText(child);
				}
			}
		}
		return s;
	}
	function prepareContent(text) {
		text = text.replace(
			/&/g, '&amp;'
		).replace(
			/</g, '&lt;'
		).replace(
			/>/g, '&gt;'
		);
		if (/^http:/.exec(text)) {
			return '<a href="' + text + '">' + text + '</a>';
		}
		return text;
	}
	function attrString(el) {
		var bits = [];
		for (var i = 0, j = el.attributes.length; i < j; i++) {
			attr = el.attributes[i];
			bits[bits.length] = (
				attr.nodeName + '="' + prepareContent(attr.nodeValue) + '"'
			);
		}
		var s = bits.join(' ');
		if (s) {
			s = ' ' + s;
		}
		return '<span class="a">' + s + '</span>';
	}
	
	// Public API:
	window.gdn.htmlFromJson = htmlFromJson;
	window.gdn.buildListFromXml = buildListFromXml;
})();
