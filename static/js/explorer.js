var current_doc = "";

jQuery(function() {
	load_document("home");
	prettyPrint();
	bind_endpoint_navigation();
	bind_sample_return_navigation();
});

function init_docpage(end_point) {
	current_doc = end_point;
	bind_sample_return_navigation();
	if (current_doc == "root") {
		$("#id_api_url_input").val("/");
	}
	else
	{
		$("#id_api_url_input").val("/"+ current_doc);
	}
}

function get_explorer_docurl(end_point) {
	return end_point_docurl = "apidocs/" + end_point + ".html";
}

function get_sample_returnurl(end_point, format) {
	return end_point_docurl = "apidocs/samplereturns/" + end_point + "." + format;
}

function load_sample_return(format) {
	end_point = current_doc;
	$('#id_sample_return').html("");
	$('#id_sample_return').load(get_sample_returnurl(end_point, format), function() {});
}

function load_document(end_point) {
	$('#documentation').load(get_explorer_docurl(end_point), function() {
		$(document).ready( function() {
			prettyPrint();
		});	
	});
}

function explore_api(end_point) {
	$('#documentation').html("");
	$("#id_insert").remove();
	load_document(end_point);
}

function bind_endpoint_navigation() {
	$("#explorer_navigation .explorer_navigation_link").hover(function() {
		$(this).addClass("explorer_navigation_hover");
	}, function() {
		$(this).removeClass("explorer_navigation_hover");
	});
	$("#explorer_navigation .explorer_navigation_link").click(function() {
		explore_api($(this).attr("name"));
	});
}

function bind_sample_return_navigation() {
	$("#samplereturn_navigation .return_format_picker").hover(function() {
		$(this).addClass("return_format_picker_hover");
	}, function() {
		$(this).removeClass("return_format_picker_hover");
	});
	$("#samplereturn_navigation .return_format_picker").click(function() {
		$(this).parent().children().removeClass("return_format_picker_selected");
		$(this).addClass("return_format_picker_selected");
		if ($(this).attr("name") == "hide")
		{
			$('#id_sample_return').html("");
		}
		else
		{
			load_sample_return($(this).attr("name"));
		}
	});
}