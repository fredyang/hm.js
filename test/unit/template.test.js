module( "template test" );

test( "render template with data", function() {
	hm.template.engineAdapter( "jsrender", {
		render: function( templateId, dataSource, options ) {

			return templateId.startsWith( "#" ) ?

				$( templateId ).render( dataSource, options ) :

				$.render[templateId]( dataSource, options );
		}
	} );

	$.templates( "testTemplate", "{{:#data}}" );

	hm.extend( {
		dataSource: ["a", "b", "c"]
	} );

	var $view = $( "<div />" );

	$view.sub( "dataSource", "init afterUpdate", "*tmpl", "testTemplate" );

	equal( $view.html(), "abc",
		"template converter convert data into markup" );

	hm.template.engineAdapter( "jsrender" ).isTemplateLoaded = function() {
		return false;
	};

	var defer = $.Deferred();

	hm.template.load = function() {
		return defer.promise();
	};

	hm.set( "dataSource", ["x", "y", "z"] );

	equal( $view.html(), "abc",
		"if isTemplateLoaded returns false, hm.loadTemplate will be used to load the template first" +
		" and a promise object is return from getTemplatedContent, so handling process is pending" );

	defer.resolve();

	equal( $view.html(), "xyz",
		"when template is loaded, template converter will continue to generate content ," +
		"and the handling process continue" );

	//hm.del( "dataSource" ).del( "copyOfDataSource" );
	hm.debug.removeAll();
	assertEmptyDb();
} );
