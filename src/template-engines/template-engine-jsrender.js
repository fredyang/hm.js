//
//#merge
(function( $, hm ) {
	//#end_merge

	if ($.render && $.templates) {

		var engine;

		//#merge
		var template = hm.template;
		var isUndefined = hm.util.isUndefined;
		var slice = [].slice;
		//#end_merge

		template.engineAdapter( "jsrender", engine = {

			render: function( templateId, data, context ) {
				if (!$.render[templateId]) {
					this.compile( templateId, document.getElementById( templateId ).innerHTML );
				}
				return $.render[templateId]( data, context );
			},

			compile: function( templateId, source ) {
				$.templates( templateId, {
					markup: source,
					debug: engine.templateDebugMode,
					allowCode: engine.allowCodeInTemplate
				} );
			},

			isTemplateLoaded: function( templateId ) {
				return !!$.render[templateId] || !!document.getElementById( templateId );
			},

			//templateDebugMode is jsRender specific setting
			templateDebugMode: false,

			//allowCodeInTemplate is jsRender specific setting
			allowCodeInTemplate: true
		} );

		var tags = $.views.tags;

		//the following tags a jsrender specific helper
		tags( {
			//#debug
			//{{debugger /}} so that it can stop in template function
			"debugger": function x( e ) {
				if (x.enabled) {
					debugger;
				}
				return "";
			},
			//#end_debug

			//{{ts /}} so that it can emit a timestamp
			ts: function x() {
				return x.enabled ?
					"<span style='color:red' data-sub='show:/*ts'>updated on:" + (+new Date() + "").substring( 7, 10 ) + "</span>" :
					"";
			},

			get: function() {
				var publisher = this.ctx.e.publisher;
				return publisher.get.apply( publisher, arguments );
			},

			prop: function() {
				var index = this.tagCtx.view.index;

				if (isUndefined( index )) {
					//this is the case when template is render with
					// a single data item instead of array
					index = (this.ctx.e.publisher.count() - 1);
				}

				var itemNode = this.ctx.e.publisher.cd( index );
				return itemNode.get.apply( itemNode, arguments );
			},

			//{{fixedRowId /}}
			fixedRowId: function() {
				return "/" + this.ctx.modelPath + ".table." + this.ctx.e.publisher.itemKey( this.tagCtx.view.data );
			},

			//{{rowId /}}
			rowId: function() {
				var index = this.tagCtx.view.index,
					path = this.ctx.modelPath;

				if (isUndefined( index )) {
					//this is the case when template is render with
					// a single data item instead of array
					index = (this.ctx.e.publisher.count() - 1);
				}

				return "/" + path + "." + index;
			},

			//{{modelPath /}}
			//it useful when  in http://jsbin.com/etacob/6/edit
			modelPath: function() {
				return "/" + this.ctx.modelPath;
			}

		} );

		tags.ts.render.enabled = true;
		//#debug
		tags["debugger"].render.enabled = true;
		//#end_debug

		hm( "*ts", false );

	}

	//#merge
})( jQuery, hm );
//#end_merge


