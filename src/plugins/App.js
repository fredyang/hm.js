// definition of custom subscription property @app
//data-sub="@app:appName,options"
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var isUndefined = hm.util.isUndefined;
	var _loader = hm.loader;
	var bindings = hm.binding;
	var rootNode = hm();

	function returnTrue() {
		return true;
	}

	var isPromise = hm.util.isPromise;

	//#end_merge

	var rDot = /\./g,
		appStore = {},
	//used to match "appName,options"
		rAppOptions = /^([^,]+)(,(.+))?$/,
		rLoadAppOptions = /^([^,]+)(,([^,]+))?(,(.+))?$/;

	//you app should implement load(elem, options) and unload(elem) method

	hm.App = hm.Class.extend(

		//instance members
		{
			//exists simply for ensure app must have a name
			initialize: function( app ) {

				if (!app.name) {
					throw "An app must have a name.";
				}
				this.callBase( "initialize", app );

			},

			//it add additional logic beside the original load method
			//such as instance counting, instance association with the container
			//prepare to unload from the container
			load: function( $viewContainer, hmModelContainer, options ) {
				if (!$viewContainer || !this.loadable()) {
					return;
				}
				var app = this,
					buildModelResult,
					appName = app.name,
					appInstance = instanceManager.get( $viewContainer[0], appName );

				//ensure that an application can be loaded into a container only once
				if (appInstance) {
					return;
				}

				if (app.loadModel) {
					buildModelResult = app.loadModel( hmModelContainer, options );

				}

				var continuation = function() {

					app.loadView( $viewContainer, hmModelContainer );
					instanceManager.add( $viewContainer[0], hmModelContainer.path, appName, app );
					$viewContainer.bind( "exitApp." + appName, function( e ) {
						app.unload( $( this ) );
						e.stopPropagation();
					} );

					app.instanceCount++;
					app.uid++;
				};

				if (isPromise( buildModelResult )) {

					buildModelResult.done( continuation );

				} else {
					continuation();

				}

			},

			unload: function( $viewContainer ) {

				var appName = this.name;
				var appInstance = instanceManager.get( $viewContainer[0], appName );

				this.unloadView( $viewContainer );

				this.unloadModel( appInstance.modelNode );

				instanceManager.remove( $viewContainer[0], appName );

				$viewContainer.unbind( "exitApp." + appName );

				this.instanceCount--;
			},

			//function( modelContainer, options ) {}
			getInitialData: null,

			//default implementation of loadModel is to call
			//app.getInitialData() and put the result into model
			//
			//You can set loadModel to null to specify that
			// there is no need to build model
			loadModel: function( hmModelContainer, options ) {
				var app = this;
				if (!app.getInitialData) {
					throw "app.getInitialData is not implemented";
				}

				var data = app.getInitialData( hmModelContainer, options );

				if (isPromise( data )) {
					return data.done( function( data ) {
						app.getModelNode( hmModelContainer ).set( data );
					} );
				} else {
					app.getModelNode( hmModelContainer ).set( data );
				}

			},

			unloadModel: function( modelNamespace ) {
				if (this.loadModel) {
					hm.del( modelNamespace );
				}
			},

			//the default loadView will create a container
			//<div appname="xxx" ns="xxx"></div>
			loadView: function( $viewContainer, hmModelContainer ) {

				var namespace = this.getModelNode( hmModelContainer ).path,
					viewWrapper = $( "<div></div>" )
						.attr( "appname", this.name )
						.attr( "ns", namespace );

				viewWrapper.hmData( "ns", namespace );

				viewWrapper.appendTo( $viewContainer ).tmpl(
					this.getTemplateOptions(),
					namespace );

			},

			unloadView: function( $viewContainer ) {
				$viewContainer.find( "> [appname='" + this.name + "']" ).remove();
			},

			//templateOptions is about template id
			//by default you can get templateOptions property or
			//the application name as templateOptions
			getTemplateOptions: function() {
				return this.templateOptions || this.name;

			},

			getModelNode: function( hmModelContainer ) {
				var subPath = this.subPath || this.name.replace( rDot, "_" );
				//if we have more than one instance, the subPath need to be
				//be suffix with an uid to make this namespace unique
				if (this.uid) {
					subPath = subPath + this.uid;
				}
				return hmModelContainer.cd( subPath );

			},

			instanceCount: 0,

			uid: 0,

			//if we want to use singleton use the following
			//		loadable: function() {
			//			return !this.instanceCount;
			//		},
			loadable: returnTrue,

			templateOptions: null,

			//path that wrap this model,
			//but this should not be used by consumer
			subPath: null


		},

		//static members
		{

			//hm.App.add({
			//  name: "gmail", //you must have a name
			//  load: function (viewContainer, modelContainer, options) {},
			//  unapp: function (viewContainer, modelContainer) {}, //optional
			//  //optional, by default it is not loadable if it has been loaded once
			//  //if it is loadable: true , it means it is always loadable
			//  loadable: function () {},
			// });
			add: function( app ) {
				if (!(app instanceof this)) {
					app = this( app );
				}
				appStore[app.name] = app;
			},

			remove: function( appName ) {
				if (appStore[appName] && !appStore[appName].instanceCount) {
					delete appStore[appName];
				}
			},

			get: function( appName ) {
				return appStore[appName];
			},

			//fetch the definition of the application
			loadDefinition: function( appName ) {
				return _loader.load( appName + ".app" );
			},

			//support the following feature
			//by default container is body, if container is missing
			//hm.App.loadApp(appName);
			//
			//hm.App.loadApp(appName, viewContainer); //viewContainer is jQuery
			//hm.App.loadApp(appName, modelContainer); //modelContainer is string
			//
			//container is jQuery object, or DOM element
			//appName is string,
			//options is optional
			loadApp: function( appName, $viewContainer, hmModelContainer, options ) {

				if (arguments.length == 1) {

					$viewContainer = $( document.body );
					hmModelContainer = rootNode;

				} else if (arguments.length == 2) {

					hmModelContainer = rootNode;

				}

				var app = appStore[appName];

				if (app) {

					app.load( $viewContainer, hmModelContainer, options );

				} else {

					this.loadDefinition( appName ).done( function() {
						appStore[appName].load( $viewContainer, hmModelContainer, options );
					} );
				}
			},

			//container by default is document.body
			//hm.App.unloadApp(appName)
			//hm.App.unloadApp(container, appName);
			unloadApp: function( appName, $viewContainer ) {
				if (isUndefined( appName )) {
					appName = $viewContainer;
					$viewContainer = $( "body" );
				}

				var appInstance = instanceManager.get( $viewContainer, appName );
				if (appInstance) {
					appInstance.app.unload( $viewContainer );
				}
			}

		} );

	var instanceManager = {

		get: function( viewContainerElem, appName ) {
			return this.appData( viewContainerElem )[appName];
		},

		add: function( viewContainerElem, modelContainerPath, appName, app ) {
			this.appData( viewContainerElem )[appName] = {
				app: app,
				modelNode: app.getModelNode( hm( modelContainerPath ) ),
				modelContainer: modelContainerPath
			};
		},

		remove: function( viewContainerElem, appName ) {
			delete this.appData( viewContainerElem )[appName];
		},

		appData: function( viewContainerElem, readOnly ) {
			var appData = $( viewContainerElem ).hmData( "app" );
			if (!readOnly && !appData) {
				appData = { };
				$( viewContainerElem ).hmData( "app", appData );
			}
			return appData;
		}
	};

	bindings( {
		//app="/|gmail,options"
		//data-sub="app:/|gmail,options"
		app: function( elem, path, context, options ) {

			var match = rAppOptions.exec( $.trim( options ) ),
				appName = match[1],
				appOptions = match[3];

			hm.App.loadApp( appName, $( elem ), hm( path ), appOptions );
		},

		//exit-app="_|gmail"
		//unload app from parent container
		//data-sub="exitApp:_|gmail"
		exitApp: function( elem, parseContext, binding, options ) {
			$( elem ).mapEvent( "click", "exitApp." + options );
		},

		//load an app when click
		//load-app="/|gmail,#containerId,options"
		//data-sub="loadApp:/|gmail,#containerId,options"
		loadApp: function( elem, path, context, options ) {

			var optionParts = rLoadAppOptions.exec( $.trim( options ) ),
				appName = optionParts[1],
				$viewContainer = $( optionParts[3] ),
				otherOptions = optionParts[5];

			$( elem ).click( function() {
				hm.App.loadApp( appName, $viewContainer, hm( path ), otherOptions );
			} );
		},

		//unloadApp
		//unload an app when click
		//unload-app=":_|gmail,#container"
		//data-sub="unloadApp:_|gmail,#container"
		unloadApp: function( elem, path, context, options ) {

			var optionParts = rLoadAppOptions.exec( $.trim( options ) ),
				appName = optionParts[1],
				$viewContainer = $( optionParts[3] );

			$( elem ).click( function() {
				hm.App.unloadApp( appName, $viewContainer );
			} );
		}
	} );

	var _cleanDataForApp = $.cleanData;

	$.cleanData = function( elems ) {
		$( elems ).each( function() {
			var appData = instanceManager.appData( this, true );
			if (appData) {
				for (var key in appData) {
					var app = appData[key];
					delete appData[key];
					app.unload( this, true );
				}
			}
		} );
		_cleanDataForApp( elems );
	};

	_loader( "app", "js", {
		url: function( moduleId ) {
			//if module id is like *hello, then it is widget
			var fileName = _loader.fileName( moduleId );
			return fileName.startsWith( "apk." ) ?
				//if app is package is apk, then load it
				//in apk folder
				"apk/" + fileName.substr( 4 ) + "/main.js" :

				//otherwise load in app folder
				"app/" + fileName + ".js";
		}
	} );

	//#merge
})( jQuery, hm );
//#end_merge
