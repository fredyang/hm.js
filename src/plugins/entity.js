//
/*
 <@depends>
 subscription.js,
 model.js
 </@depends>
 */
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var hmFn = hm.fn;
	var extend = $.extend;
	var isUndefined = hm.util.isUndefined;
	//#end_merge

	var methodMap = {
		"create": "POST",
		"update": "PUT",
		"destroy": "DELETE",
		"fetch": "GET"
	};

	var entityState = {
		detached: 0,
		unchanged: 1,
		added: 3,
		deleted: 4,
		modified: 5
	};

	function markModified ( e ) {

		var basePath = this.path; //items
		var originalPath = e.originalPublisher.path; //items.1.firstName
		var diffPath = originalPath.substr( basePath.length + 1 ); //1.firstName
		var dotIndex = diffPath.indexOf( "." );
		var entityPath = basePath + "." + diffPath.substr( 0, dotIndex ); //items.1
		var statePath = entityPath + ".__state"; //items.1.__state

		if (originalPath !== statePath &&
		    hm.get( statePath ) == entityState.unchanged) {
			//use set method is deliberate, because we want
			//to raise event
			hm.set( statePath, entityState.modified );
		}
	}

	hm.onAddOrUpdateNode( function( context, index, value ) {
		if (value instanceof hm.Entity) {

			if (value.__state === entityState.detached) {
				value.__state = entityState.added;
			}

			if (isUndefined( hm( context ).get( "__entityContainer" ) )) {
				hm.sub( context, context, "afterUpdate.*", markModified );
				hm( context ).set( "__entityContainer", true );
			}
		}
	} );

	function callStaticAjaxMethod ( node, methodName ) {
		var entity = node.get();

		return entity.constructor[methodName]( entity ).done( function( data ) {

			node.set(

				"__state",

				methodName == "destroy" ?
					entityState.detached :
					entityState.unchanged
			);

			node.trigger( "afterSync." + methodName );
		} );
	}

	//the reason that we don't implement ajax in the instance method is that, we want to
	//support the call from repository node, such node.set("create"), node.set("update")..
	//we want to delegate this call the static method
	hm.Entity = hm.Class.extend(
		//instance method, which is invoked by node.get method
		//or it can be invoked the object directly
		{
			//this state is meaningful only when it entity is inside of repository
			__state: entityState.detached,

			create: function __ () {
				if (this instanceof hm) {
					if (this.get( "__state" ) == entityState.added) {
						return callStaticAjaxMethod( this, "create" );
					}
					throw "entity is not a new item";

				} else {
					// don't use Entity.create(this), because
					// this.constructor is not necessary Entity
					return this.constructor.create( this );

				}
			},

			fetch: function __ () {
				return this instanceof hm ? callStaticAjaxMethod( this, "fetch" ) :
					this.constructor.fetch( this );
			},

			update: function __ () {

				if (this instanceof hm) {
					if (this.get( "__state" ) == entityState.modified) {
						return callStaticAjaxMethod( this, "update" );
					}
				} else {
					return this.constructor.update( this );
				}
			},

			destroy: function __ () {
				if (this instanceof hm) {
					var node = this;
					return callStaticAjaxMethod( this, "destroy" ).done( function() {
						node.del();
					} );
				} else {
					return this.constructor.destroy( this );
				}
			},

			save: function __ () {
				if (this instanceof hm) {

					var state = this.get( "__state" );
					if (state == entityState.added) {

						return this.get( "create" );

					} else if (state == entityState.modified) {

						return this.get( "update" );
					}

				} else {

					throw "not supported";
				}

			}

		},

		//static method, which knows nothing about repository
		{
			state: entityState,

			create: function( instance ) {
				return this.ajax( "create", instance );
			},

			update: function( instance ) {
				return this.ajax( "update", instance );
			},
			destroy: function( instance ) {
				return this.ajax( "destroy", instance );
			},

			fetch: function( instance ) {
				if (instance) {
					return this.ajax( "fetch", instance );
				} else {
					var Constructor = this;
					//the pipe method is used to convert an array of
					// generic object into an array of object of the same "Class"
					return this.ajax( "fetch" ).pipe( function( data ) {
						return $( Constructor.list( data ) ).each(function() {
							this.__state = entityState.unchanged;
						} ).get();
					} );

				}
			},

			getUrl: function( methodName, instance ) {
				var baseUrl = this.url || instance.url,
					id = instance && instance.id;

				return id ? baseUrl + (baseUrl.charAt( baseUrl.length - 1 ) === '/' ? '' : '/') + encodeURIComponent( id ) :
					baseUrl;
			},

			ajax: function( methodName, instance ) {
				var method = methodMap[methodName];

				var ajaxOptions = {
					type: method,
					dataType: 'json',
					url: this.getUrl( methodName, instance ),
					contentType: method == "GET" ? null : "application/json",
					processData: false,
					data: method == "GET" ? null : JSON.stringify( instance )
				};

				return $.ajax( ajaxOptions ).done( function( response ) {
					instance && extend( instance, response );
				} );
			}
		} );

	extend( hmFn, {

		//node function which bridget the hm method to the static method of model
		//subPath is optional
		//method is required create/read/update/del
		//e.g node.sync("create");
		save: function() {
			return this.get( "save" );
		},

		destroy: function() {
			return this.get( "destroy" );
		},

		fetch: function() {
			return this.get( "fetch" );
		}
	} );

	//#merge
})( jQuery, hm );
//#end_merge
