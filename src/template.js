//
//<@depends>subscription.js, model.js, declarative.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var extend = $.extend;
	var isArray = $.isArray;
	var isString = hm.util.isString;
	var isObject = hm.util.isObject;
	var $fn = $.fn;
	var isFunction = $.isFunction;
	var isPromise = hm.util.isPromise;

	var bindings = hm.binding;
	var _loader = hm.loader;

	function returnTrue() {
		return true;
	}

	//#end_merge

	var template,
		rBeginWithApk = /^apk\.([^.]+)(\.?)(.*)$/,
		rBeginWithStar = /^\*/,
		templateEngineAdapters = {},
		tmpl = {
			initialize: "*templateOptions",
			get: "get", //extensible
			convert: "*template",
			set: "html", //extensible
			finalize: "*parseSubs"
		};

	function newTemplateHandler( getter, setter, finalizer ) {
		return extend( {}, tmpl,
			isObject( getter ) ? getter : {
				get: getter,
				set: setter,
				finalize: finalizer
			} );
	}

	//options can be : templateId,wrapItem,engineName
	//
	//or it can be
	// {
	//  templateId: "xxx",
	//  wrapItem: true,
	//  engineName: "xxx"
	//}
	hm.activity.initialize.templateOptions = function( publisher, subscriber, handler, options ) {
		if (isString( options )) {

			options = options.split( "," );
			handler.templateId = $.trim( options[0] );
			handler.wrapDataInArray = $.trim( options[1] ) == "true";
			handler.engineName = options[2];

		} else if (isObject( options ) && options.templateId) {

			extend( handler, options );

		} else {

			if (!(handler.templateId = subscriber.hmData( "embeddedTemplate" ))) {

				var templateSource = $.trim( subscriber.html() );
				if (templateSource) {
					templateSource = templateSource.replace( rUnescapeTokens, unescapeTokens );
					handler.templateId = "__" + $.uuid++;
					template.compile( handler.templateId, templateSource );
					subscriber.hmData( "embeddedTemplate", handler.templateId );
					subscriber.empty();
				} else {
					throw "missing template";
				}
			}
		}
	};

	var rUnescapeTokens = /&lt;|&gt;/g;
	var unescapeMap = {
		"&lt;": "<",
		"&gt;": ">"
	};

	var unescapeTokens = function( token ) {
		return unescapeMap[token] || "";
	};

	function RenderContext( e ) {
		this.modelPath = e.publisher.path;
		this.e = e;
	}

	//shortcut to this.e.publisher.get(xxx);
	RenderContext.prototype.get = function() {
		var publisher = this.e.publisher;
		return publisher.get.apply( publisher, arguments );
	};

	//this converter is used in handlers which can want to convert data
	// to markup, these handler includes foreach, and newTemplateHandler
	//which is the core of all templateHandler
	hm.activity.convert.template = function( data, e ) {

		//if dataSource is an array, it has item(s)
		//or dataSource is non-array
		if (data &&
		    (
			    (isArray( data ) && data.length) || !isArray( data )
			    )
			) {

			//if wrapDataInArray is true, wrap data with [], so that it is an item of an array, explicitly
			//some template engine can automatically wrap your data if it is not an array.
			//if you data is already in array, it treat it as an array of items.
			//however, if you want to want to treat your array as item, you need to wrap it by your
			//self, wrapDataInArray is for this purpose

			var templateId, templateData, workflow = e.handler;

			if (workflow.templateId) {
				templateId = workflow.templateId;
				templateData = workflow.wrapDataInArray ? [data] : data;
			} else {
				templateId = data;
				templateData = {};
			}

			if (!templateId) {
				return "";
			}

			//handler.templateId, handler.wrapDataInArray, handler.engineName is
			//built in during initialization , see initializers.templateOptions
			var content = renderTemplate(

				templateId,

				templateData,

				//this context can be used to access model within the template
				new RenderContext( e ),

				workflow.engineName );

			if (isPromise( content )) {
				return content;
			}
			if (isString( content )) {

				content = $.trim( content );
			}

			//to work around a bug in jQuery
			// http://jsfiddle.net/jgSrn/1/
			return $( $( "<div />" ).html( content )[0].childNodes );
		} else {
			return "";
		}
	};

	//when the template is render, need to recursively import declarative subscriptions
	hm.activity.finalize.parseSubs = function( value, e ) {
		$( value ).parseSubs();

	};

	//add reusable event handler
	hm.workflow( {
		tmpl: tmpl,
		include: newTemplateHandler( "get", "replaceWith" )
	} );

	bindings( {

		tmpl: "!init:.|*tmpl",

		tmplOnChange: "!init after*.:.|*tmpl",

		tmplOnChildChange: "!init after*. after*.1:.|*tmpl",

		tmplOnAnyChange: "!init after*:.|*tmpl",

		include: "!init:.|*include"
	} );

	//templateOptions is templateId,wrapDataInArray,templateEngineName
	//$("div").tmpl(templateId, path)
	//$("div").tmpl(templateId, path, fn)
	//if templateWorkflowExtension is a function, the function is treated
	//as finalizer
	$fn.tmpl = function( templateOptions, modelPath, templateWorkflowExtension ) {

		modelPath = modelPath || "";

		if (isFunction( templateWorkflowExtension )) {
			templateWorkflowExtension = {
				finalize: templateWorkflowExtension
			};
		}

		return this.renderView(

			modelPath,

			templateWorkflowExtension ?
				extend( {}, tmpl, templateWorkflowExtension ) :
				"*tmpl",

			templateOptions
		);
	};

	//templateOptions is templateId,wrapDataInArray,templateEngineName
	//$("div").include(path, templateId)
	$fn.include = function( templateOptions, modelPath, templateHandlerExtension ) {

		if (isFunction( templateHandlerExtension )) {
			templateHandlerExtension = {
				finalize: templateHandlerExtension
			};
		}

		return this.renderView(
			modelPath,
			templateHandlerExtension ? extend( {}, hm.workflow( "replace" ), templateHandlerExtension ) : "*replace",
			templateOptions
		);
	};

	function getTemplateEngine( engineName ) {
		engineName = engineName || template.defaultEngine;
		if (!engineName) {
			throw "engine name is not specified or default engine name is null";
		}
		var engineAdapter = templateEngineAdapters[engineName];
		if (!engineAdapter) {
			throw "engine '" + engineAdapter + "' can not be found.";
		}
		return engineAdapter;

	}

	function renderTemplate( templateId, data, renderContext, engineName ) {

		var engineAdapter = getTemplateEngine( engineName, templateId );

		templateId = $.trim( templateId );

		//remove the starting "*" from the template id to become the realTemplateId
		var realTemplateId = templateId.replace( rBeginWithStar, "" );

		if (engineAdapter.isTemplateLoaded( realTemplateId )) {

			return engineAdapter.render( realTemplateId, data, renderContext );

		} else if (engineAdapter.renderAsync) {

			return engineAdapter.renderAsync( realTemplateId, data, renderContext );

		} else {

			var defer = $.Deferred(),
				cloneEvent = extend( true, {}, renderContext.e ),
				publisher = extend( true, {}, cloneEvent.publisher ),
				clonedContext = extend( true, {}, renderContext );

			cloneEvent.publisher = publisher;
			clonedContext.e = cloneEvent;

			//template.load is implemented in external-template.js
			template.load( templateId ).done( function() {

				var content = engineAdapter.render( realTemplateId, data, clonedContext ),
					rtn = $( content );

				defer.resolve( rtn.selector || !rtn.length ? content : rtn );

			} );

			return defer.promise();

		}
	}

	hm.template = template = {

		defaultEngine: "",

		/*
		 hm.template.myEngine = {
		 render: function( templateId, data, context ) {},
		 compile: function( templateId, source ) {},
		 isTemplateLoaded: function( templateId ) {}
		 };
		 */
		engineAdapter: function( name, engineAdapter ) {
			if (!name) {
				return templateEngineAdapters;
			}
			if (!engineAdapter) {
				return templateEngineAdapters[name];
			}
			engineAdapter.isTemplateLoaded = engineAdapter.isTemplateLoaded || returnTrue;
			templateEngineAdapters[name] = engineAdapter;
			template.defaultEngine = name;
		},

		//dynamically load a template by templateId,
		//it is called by template.render
		//The default implementation required loader.js
		//but you can override this, all you need
		// is to return is that a promise, when the promise is
		// done, the template should be ready to used
		load: function( templateId ) {
			//we need to modify the id by adding an extension to the id
			// hm.loader use extension to determine what loader is used
			// handle the actual loading work
			return _loader.load( templateId.endsWith( ".html" ) ? templateId : templateId + ".template" );
		},

		//this should be called by hm.template.load after the method
		//get the source of the template
		compile: function( templateId, source, engineName ) {
			return getTemplateEngine( engineName ).compile(
				templateId.endsWith( ".template" ) ? _loader.fileName( templateId ) : templateId,
				source );
		},

		//build a customized handler which handle the change of model
		//by default
		//getFilter is "get" which is to get model value,
		// it can be a string or function (e) {}
		//
		//setFilter is "html" which is to change the content of the view
		//it can be a string or function (e, value)
		newTemplateHandler: newTemplateHandler,

		templateIdToUrl: function( templateId ) {

			var match = rBeginWithApk.exec( templateId );

			return match ?
				//apk.hello --> applet/hello/main.html
				//apk.hello.bye --> applet/hello/bye.html
				"apk/" + match[1] + "/" + (match[3] || "main" ) + ".html" :

				//xxx.html --> xxx.html
				//xxx.yyy.html --> xxx.yyy.html
				templateId.endsWith( ".html" ) ? templateId :

					//xxx --> xxx.html
					//xxx.yyy --> xxx.html
					templateId.split( "." )[0] + ".html";

		}

	};

	_loader( "template", {

		load: {
			compile: function( moduleId, sourceCode ) {

				var $scriptList = $( sourceCode );

				var hasScriptTag = false;
				$scriptList.each( function() {

					if (this.tagName == "SCRIPT") {
						hasScriptTag = true;
						return false;
					}
				} );

				if (hasScriptTag) {

					$scriptList.each( function() {

						if (this.tagName == "SCRIPT") {

							var $sourceCodeContainer = $( this );

							template.compile(
								this.id,
								$sourceCodeContainer.html(),
								$sourceCodeContainer.attr( "type" ) || template.defaultEngine );
						}

					} );
				} else {
					template.compile( moduleId, sourceCode, template.defaultEngine );
				}

			},
			buildDependencies: "parseDependsTag"
		},

		url: function( templateId ) {
			//first truncate the ".template" in the templateId, and get the real templateId
			return template.templateIdToUrl( _loader.fileName( templateId ) );
		}
	} );

	_loader( "html", "template", {
		//		load: {
		//			compile: function( moduleId, sourceCode ) {
		//				return template.compile( moduleId, sourceCode, template.defaultEngine );
		//			}
		//		}

		url: function( templateId ) {
			return templateId;
		}
	} );

	//#merge
})( jQuery, hm );
//#end_merge