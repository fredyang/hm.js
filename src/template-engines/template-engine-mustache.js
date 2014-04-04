//
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var extend = $.extend;
	//#end_merge

	var mu = Mustache;
	//in mustache template are called partials
	//key is template id, value is the template source
	var mustachePartials = {};

	hm.template.engineAdapter( "mustache", {

		render: function( templateId, data, context ) {
			return mu.render(
				mustachePartials[templateId], /*the source of template*/
				extend( data, context )/*data is called view, extend the data object with context*/,
				mustachePartials /*partial*/
			);
		},

		compile: function( templateId, source ) {
			return mustachePartials[templateId] = source;
		},

		isTemplateLoaded: function( templateId ) {
			return !!mustachePartials[templateId];
		}

	} );

	$( function() {
		$( "script[type=mustache]" ).each( function() {
			mustachePartials[this.id] = $( this ).html();
		} );
	} );
	//#merge
})( jQuery, hm );
//#end_merge


