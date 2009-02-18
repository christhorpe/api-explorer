gdn = window.gdn || {};
gdn.consolePane = gdn.consolePane || {};
gdn.consolePane.init = function() {
    var $ = jQuery;
    
    // Insert the console
    var consoleDiv = $(
        '<div id="console"><div></div></div>'
    ).hide().insertAfter('#main').find('div').load(
        '/explorer/_console.html', function() {
        // Set up event handlers
        initApiExplorer(consoleDiv);
        sizeIt();
    }).end().css({
        'position': 'relative',
        'overflow': 'auto',
        'background-color': '#eee'
    });
    
    var console_height = 300;
    var saved_console_height = console_height; // For dblclick restore
    
    function sizeIt() {
        consoleDiv.height(console_height);
        $('#main').height($(window).height() - console_height - 5).css(
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
    $(window).resize(sizeIt);
    
    var dragme = $(
        '<div class="dragbar"></div>'
    ).insertBefore(consoleDiv).css({
        'height': '5px',
        'background-color': '#666',
        'cursor': 'n-resize',
        'width': '100%'
    }).draggable({
        containment: 'window',
        helper: 'clone',
        opacity: 0.5,
        appendTo: document.body,
        axis: 'y',
        stop: function(ev, ui) {
            var top = Math.max(ui.absolutePosition.top, 0);
            console_height = $(window).height() - top - 5;
            sizeIt();
            dragme.css('top', 0);
        }
    });
    
    /*
    // TODO: This should be triggered by an open/close icon instead
    dragme.dblclick(function() {
        if (console_height == 0) {
            console_height = saved_console_height;
        } else {
            saved_console_height = console_height;
            console_height = 0;
        }
        sizeIt();
    });
    */
}

function initApiExplorer(el) {
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
	
	function loadUrl(url) {
		if (!url) {
			return; // loadUrl called with empty string when page first loads
		}
		$('#tooltip').hide();
		
		$('input[name=url]', el).val(url);
		$('#results').empty().append(
			//'<img src="loading.gif">'
			'<em>Loading...</em>'
		).addClass('loading');
		$('#refinements').empty();
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
				
				// Show any refinements
				if (is_xml) {
					showRefinements(extractXmlRefinements(domOrJson));
				} else {
					showRefinements(extractJsonRefinements(domOrJson));
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
	
	function showRefinements(refinements) {
		$('#refinements').empty();
		if (refinements.length == 0) {
			return;
		}
		$('#refinements').append('<h4>Refinements</h4>');
		var ul = $('<ul></ul>');
		$('#refinements').append(ul);
		$.each(refinements, function(i, r) {
			ul.append($('<li><a href="' + r.url + '">' + 
				r.name + '</a> - ' + r.count + '</li>'
			));
		});
	}
	function extractXmlRefinements(dom) {
		window.lastDom = dom;
		var filters = dom.getElementsByTagName('filters')[0];
		var els = filters.getElementsByTagName('tag');
		var refinements = [];
		for (var i = 0, el; el = els[i]; i++) {
			refinements[refinements.length] = {
				'name': el.getAttribute('name'),
				'count': el.getAttribute('count'),
				'url': el.getAttribute('filter-url')
			}
		}
		return refinements;
	}
	
	function extractJsonRefinements(json) {
		window.lastJson = json;
		var refinements = [];
		$.each(json['search']['filters'], function(i, f) {
			refinements[refinements.length] = {
				'name': f.name,
				'count': f['@count'],
				'url': f['openplatform-url']
			}
		});
		return refinements;
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
	hookupLinks();
}
