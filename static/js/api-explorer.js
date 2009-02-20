gdn = window.gdn || {};
gdn.consolePane = gdn.consolePane || {};
(function($) {
	var api_key_cookie = 'gdn_api_key';
	var dragHeight = 25;
	var initial_console_height = 300;
	var console_height = initial_console_height;
	var saved_console_height = console_height; // So 'open' can restore it
	
	var consoleDiv, dragme;
	
	function init() {
		// Insert the console
		consoleDiv = $(
			'<div id="console"><div></div></div>'
		).hide().css({
			'position': 'relative',
			'overflow': 'auto',
		}).insertAfter('#main');
		// Set up the draggable resize header
		dragme = $(
			'<div class="dragbar"><p>API Console <a href="#">(close)</a></p></div>'
		).insertBefore(consoleDiv).css({
			'height': dragHeight + 'px',
			'background-color': '#666',
			'cursor': 'move',
			'width': '100%',
			'overflow': 'hidden'
		}).draggable({
			containment: 'window',
			helper: 'clone',
			opacity: 0.5,
			appendTo: document.body,
			axis: 'y',
			stop: function(ev, ui) {
				var top = Math.max(ui.absolutePosition.top, 0);
				console_height = $(window).height() - top - dragHeight;
				sizeIt();
				dragme.css('top', 0);
				var text = '(open)'
				if (console_height > 0) {
					text = '(close)';
				}
				$('.dragbar a').html(text);
			}
		}).find('p').css({
			'margin': '0',
			'padding': '0 0 0 1em',
			'color': '#fff',
			'line-height': '24px',
			'border-top': '1px solid black'
		}).find('a').css({
			'color': 'white',
			'font-size': '0.9em'
		}).click(function() {
			var a = $(this);
			if (console_height > 0) {
				saved_console_height = console_height;
				console_height = 0;
				sizeIt();
				a.html('(open)');
			} else {
				console_height = saved_console_height;
				sizeIt();
				a.html('(close)');
			}
			return false;
		});
		
		// If they have an API Key cookie, show the console - otherwise
		gdn.api_key = readApiKeyCookie();
		if (gdn.api_key) {
			consoleDiv.find('div').load(
				'/explorer/_console.html', function() {
				gdn.apiExplorer.init(consoleDiv);
				sizeIt();
			});
		} else {
			consoleDiv.find('div').load(
				'/explorer/_console_enter_api_key.html', function() {
				sizeIt();
			});
		}
		
		$(window).resize(sizeIt);
	}
	
	function readApiKeyCookie() {
		return $.cookies.get(api_key_cookie);
	}
	
	function sizeIt() {
		consoleDiv.height(console_height);
		$('#main').height($(window).height()-console_height-dragHeight).css(
			'overflow', 'auto'
		);
		consoleDiv.show();
		// Should we horizontally center the contained div?
		var inner = consoleDiv.find('div:first');
		if (inner.hasClass('horizontal-center')) {
			inner.css(
				'padding-top', 
				(consoleDiv.height() / 2) - (inner.height() / 2)
			);
		}
	}
	function ensureOpen() {
		if (console_height < 100) {
			console_height = initial_console_height;
			sizeIt();
			$('.dragbar a').html('(close)');
		}
	}
	
	gdn.consolePane.init = init;
	gdn.consolePane.ensureOpen = ensureOpen;
})(jQuery)

gdn.apiExplorer = gdn.apiExplorer || {};
(function($) {
	var el;
	function init(initEl) {
		el = initEl;
		$.history.init(loadUrl); // The history plugin enables the back button
		$('form', el).submit(function() {
			$.history.load($('input[name=url]', el).val());
			return false;
		});
	
		// Set up show/hide toggle behaviour for API examples
		$('<a href="#" class="hide"> [Hide]</a>').click(function() {
			var a = $(this);
			if (a.hasClass('hide')) {
				a.removeClass('hide');
				a.addClass('show');
				a.text(' [Show]');
				$('#examples').hide('fast');
			} else {
				a.removeClass('show');
				a.addClass('hide');
				a.text(' [Hide]');
				$('#examples').show('fast');
			}
			return false;
		}).css({
			'font-size': '0.6em',
			'text-decoration': 'none'
		}).appendTo($('h2', el));
		hookupLinks();
	}
	function loadUrl(url) {
		if (!url) {
			return; // loadUrl called with empty string when page first loads
		}
		// Get rid of http://hostname, if present
		url = url.replace(/^http:\/\/[^\/]+/, '');
		
		$('#tooltip').hide();
	
		$('input[name=url]', el).val(url);
		$('#results').empty().append(
			'<p id="results-loading">Loading...</p>'
		).addClass('loading');
		$('#filters').empty();
		$('#formats').hide();
	
		$.ajax({
			url: url, 
			success: function(domOrJson) {
				var is_xml = false;
				if (typeof domOrJson.nodeType != 'undefined') {
					// It's an XML DOM
					is_xml = true;
					var root = $(domOrJson).find('*:first');
					var ol = $(document.createElement('ol'));
					ol.addClass('root');
					gdn.buildListFromXml(ol[0], root[0]);
					$('#results').removeClass('loading').empty().append(ol);
				} else {
					// It should be a JSON object
					if (typeof domOrJson == 'string') {
						domOrJson = eval('(' + domOrJson+ ')');
					}
					$('#results').empty().append(
						gdn.htmlFromJson(domOrJson)
					).removeClass('loading');
				}
				// Set up the tabs to switch between formats
				$('#formats').show().attr('class', is_xml ? 'xml' : 'json');
				$('#formats .xml a').attr('href', formatUrl(url, 'xml'));
				$('#formats .json a').attr('href', formatUrl(url, 'json'));
				$('#formats .raw a').attr('href', url);
			
				// Show any filters
				if (is_xml) {
					showFilters(extractXmlFilters(domOrJson));
				} else {
					showFilters(extractJsonFilters(domOrJson));
				}
				hookupLinks();
			},
			error: function(xhr, status) {
				$('#results').html(
					'An error occurred: "' + status + 
					'". <a href="' + url + '">view API response</a>'
				);
			}
		});
	}

	function showFilters(filters) {
		$('#filters').empty();
		if (filters.length == 0) {
			return;
		}
		$('#filters').append('<h4>Filters</h4>');
		var ul = $('<ul></ul>');
		$('#filters').append(ul);
		$.each(filters, function(i, r) {
			ul.append($('<li><a href="' + r.url + '">' + 
				r.name + '</a> - ' + r.count + '</li>'
			));
		});
	}
	function extractXmlFilters(dom) {
		window.lastDom = dom;
		var filterEls = dom.getElementsByTagName('filters');
		if (filterEls.length == 0) {
			return [];
		}
		var els = filterEls[0].getElementsByTagName('tag');
		var filters = [];
		for (var i = 0, el; el = els[i]; i++) {
			filters[filters.length] = {
				'name': el.getAttribute('name'),
				'count': el.getAttribute('count'),
				'url': el.getAttribute('filter-url')
			}
		}
		return filters;
	}

	function extractJsonFilters(json) {
		window.lastJson = json;
		var filters = [];
		$.each(json['search']['filters'], function(i, f) {
			filters[filters.length] = {
				'name': f.name,
				'count': f['count'],
				'url': f['filterUrl']
			}
		});
		return filters;
	}

	function formatUrl(url, format) {
		if (/format=\w+/.exec(url)) {
			url = url.replace(/format=\w+/, 'format=' + format);
		} else {
			// Add format parameter
			if (/\?/.exec(url)) {
				url = url + '&format=' + format;
			} else {
				url = url + '?format=' + format;
			}
		}
		return url;
	}

	function hookupLinks() {
		// Hook up links to the API to call Ajax instead
		$('a[href*=/gdn-api/]').not(
			'.no-modify'
		).unbind('.explorer').bind('click.explorer', function(ev) {
			ev.preventDefault();
			$.history.load(this.getAttribute('href'));
			return false;
		}).attr(
			'title', 'Click to open in the API Explorer'
		).not('.hastooltip').tooltip({
			showURL: false
		}).addClass('hastooltip');
	
		// Links to images should show that image in the tooltip
		$('a[href$=.jpg],a[href$=.gif],a[href$=.png]').not(
			'.hastooltip'
		).tooltip({
			bodyHandler: function() {
				return $("<img/>").attr("src", this.href);
			},
			showURL: false,
			extraClass: 'tooltip-img'
		}).addClass('hastooltip');
	}
	
	// Public methods:
	gdn.apiExplorer.init = init;
	gdn.apiExplorer.load = function(url) {
		$.history.load(url);
	}
})(jQuery);

gdn.apiExplorer.show = function(url) {
	// Opens the consolePane if not already open, then loads that URL
	gdn.consolePane.ensureOpen();
	gdn.apiExplorer.load(url);
}
