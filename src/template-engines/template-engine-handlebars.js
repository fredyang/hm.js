//
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var extend = $.extend;
	var slice = [].slice;
	var isUndefined = hm.util.isUndefined;
	//#end_merge

	var Handlebars = window.Handlebars;

	if (!isUndefined( Handlebars )) {

		hm.template.engineAdapter( "handlebars", {

			render: function( templateId, data, context ) {

				return Handlebars.partials[templateId]( data, {
					data: {renderContext: context}
				} );
			},

			compile: function( templateId, source ) {
				Handlebars.registerPartial( templateId, Handlebars.compile( source ) );
			},

			isTemplateLoaded: function( templateId ) {
				return !!Handlebars.partials[templateId];
			}

		} );

		//{{modelPath}}
		Handlebars.registerHelper( "modelPath", function( options ) {
			return options.data.renderContext.modelPath;
		} );

		//{{rowId}}
		Handlebars.registerHelper( "rowId", function( options ) {
			return "/" + options.data.renderContext.modelPath + "." + options.data.index + ";";
		} );

		//{{fixedRowId}}
		Handlebars.registerHelper( "fixedRowId", function( options ) {
			var renderContext = options.data.renderContext;
			return "/" + renderContext.modelPath + ".table." + renderContext.e.publisher.itemKey( this );
		} );

		//{{get "..setTo" name}}
		Handlebars.registerHelper( "get", function() {
			var args = arguments,
				last = args.length - 1,
			//args[last].data is options.data
				renderContext = args[last].data.renderContext;

			return renderContext.get.apply( renderContext, slice.call( args, 0, last ) );
		} );

		//{{{prop "link"}}}
		Handlebars.registerHelper( "prop", function() {
			var slice = [].slice,
				args = arguments,
				last = args.length - 1,
				options = args[last],
				data = options.data,
				renderContext = data.renderContext,
				itemNode = renderContext.e.publisher.cd( data.index );

			return itemNode.get.apply( itemNode, slice.call( args, 0, last ) );
		} );

		$( function() {
			$( "script[type=handlebars]" ).each( function() {
				Handlebars.registerPartial( this.id, Handlebars.compile( $( this )[0].innerHTML ) );
			} );
		} );

	}

	//#merge
})( jQuery, hm );
//#end_merge


