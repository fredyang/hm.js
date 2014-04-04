//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var isBoolean = hm.util.isBoolean;
	var bindings = hm.binding;
	var util = hm.util;

	function returnTrue() {
		return true;
	}

	//#end_merge

	//don't change it to because we want to control the search order
	//check findValueAdapter($elem, adapterName)
	//{
	//   name1: adapter1,
	//   name2: adapter2
	//}
	var valueAdapters = [
		{
			//the default view adapter
			name: "textBoxOrDropDown",
			initialize: function( $elem, modelValue ) {
				if (modelValue) {
					if ($elem[0].tagName == "SELECT") {
						$elem.children().each( function() {
							if (this.value == modelValue) {
								$( this ).attr( "selected", "selected" );
								return false;
							}
						} );
					} else {
						$elem.attr( "value", modelValue );
					}
				}
			},
			get: function( $elem ) {
				return $elem.val();
			},
			set: function( $elem, value ) {
				if ($elem.val() !== value) {
					$elem.val( value );
				}
			},
			match: returnTrue
		},
		{
			name: "checkbox",
			initialize: function( $elem, modelValue ) {
				if (modelValue) {
					$elem.attr( "checked", "checked" );
				}
			},
			get: function( $elem, e ) {
				var elem = $elem[0];
				var value = elem.value;

				if (value == "true") {
					return true;
				} else if (value == "false") {
					return false;
				} else if (value !== "on") {
					return value;
				} else {
					return elem.checked;
				}
			},
			set: function setCheckbox( $elem, value ) {
				var elem = $elem[0];
				if (isBoolean( value )) {
					elem.checked = value;
				} else {
					elem.checked = (value == elem.value);
				}
			},
			match: function( $elem ) {
				return $elem.is( ":checkbox" );
			}
		},
		{
			name: "radio",
			initialize: function( $elem, modelValue ) {

				if (modelValue == $elem[0].value) {
					$elem.attr( "checked", "checked" );
				}
			},
			get: function( $elem, e ) {
				if (e.type == "resetVal" && !e.publisher.attr( "checked" )) {
					e.abort();
					return;
				}

				var elem = $elem[0];
				var value = elem.value;
				if (value == "true") {
					return true;
				} else if (value == "false") {
					return false;
				} else if (value !== "on") {
					return value;
				} else {
					return elem.checked;
				}
			},
			set: function( $elem, value, e ) {
				var elem = $elem[0];
				if (!elem.name) {
					elem.name = e.publisher.path;
				}
				elem.checked = ( util.toString( value ) == elem.value );
			},
			match: function( $elem ) {
				return $elem.is( ":radio" );
			}
		},
		{
			name: "listBox",
			initialize: function( $elem, modelValue ) {
				$elem.children().each( function() {
					if (modelValue.contains( this.value )) {
						$( this ).attr( "selected", "selected" );
					}
				} );
			},

			get: function( $elem ) {
				var options = [];
				$elem.children( "option:selected" ).each( function() {
					options.push( this.value );
				} );
				return options.length ? options : null;
			},
			set: function( $elem, value ) {
				$elem.children().each( function() {
					this.selected = !!(value && value.contains( this.value ));
				} );
			},
			match: function( $elem ) {
				return $elem.is( "select[multiple]" );
			}
		}
	];

	function findValueAdapter( $elem, adapterName ) {
		var i, adapter;

		if (adapterName) {
			for (i = valueAdapters.length - 1; i >= 0; i--) {
				adapter = valueAdapters[i];
				if (adapter.name == adapterName) {
					return adapter;
				}
			}
		} else {
			//search from tail to head
			for (i = valueAdapters.length - 1; i >= 0; i--) {
				adapter = valueAdapters[i];
				if (adapter.match && adapter.match( $elem )) {
					return adapter;
				}
			}
		}
	}

	hm.activity.get.getViewValue = function( e ) {
		//e.handler.getViewValue is initialized when on subscription
		return e.handler.getViewValue( e.publisher, e );
	};

	hm.activity.set.setViewValue = function( value, e ) {
		//e.handler.setViewValue is initialized when on subscription
		return e.handler.setViewValue( this, value, e );
	};

	function initAdapterMethodForView( model, view, handler, adapterName, methodName ) {

		var adapter = findValueAdapter( view, adapterName );

		if (!adapter || !adapter[methodName]) {

			throw "can not find " + methodName + " method for view";
		}

		//create handler.getViewValue or handler.setViewValue
		handler[methodName + "ViewValue"] = adapter[methodName];

		if (adapter.convert) {
			handler.convert = adapter.convert;
		}

		//we want to run the initialize method only once
		if (!view.hmData( "valueBound" )) {

			adapter.initialize && adapter.initialize( view, model.get() );

			//when "reset" event is trigger to parent form, the children does
			//not trigger the event, so that we need to trigger "resetVal" to update
			//back the original value to modal
			view.parents( "form" ).bind( "reset", function() {

				setTimeout( function() {
					view.triggerHandler( "resetVal" );
				}, 10 );
			} );

			view.hmData( "valueBound", true );

		}
	}

	hm.workflow( {

		//set view value with model value
		updateViewValue: {
			initialize: function( publisher, subscriber, workflow, adapterName ) {
				//subscriber is view, trying to getModel setView
				initAdapterMethodForView( publisher, subscriber, workflow, adapterName, "set" );

			},
			get: "get",
			set: "*setViewValue"
		},

		//set model value with view value
		updateModelValue: {

			initialize: function( publisher, subscriber, workflow, adapterName ) {
				//publisher is view, trying to getView setModel
				initAdapterMethodForView( subscriber, publisher, workflow, adapterName, "get" );

			},
			get: "*getViewValue",
			set: "set"
		}
	} );

	//add value adapter
	//the last added using the method, will be evaluated first
	/*
	 //a view adapter is is like
	 {
	 //optional if match function is present
	 name: "adapterName",
	 //
	 //optional if name is present
	 match: function ($elem) { return true; },
	 //
	 //prepare $element
	 initialize: function ($elem) {}
	 //
	 //get a value from element
	 get: function ($elem) {},
	 //
	 //set a value to $element
	 set: function( $elem, value ) {},
	 //
	 //optional, if get function already convert, you don't need this
	 convert: "*commonConvertActivityName" or function (value) {}

	 }
	 * */
	hm.valueAdapter = function( adapter ) {
		if (adapter) {
			valueAdapters.push( adapter );
		} else {
			return valueAdapters;
		}
	};

	//dynamic group
	//support the following
	//
	//val:path
	//val:path|keypress
	//val:path|,updateModel
	//val:path|,updateView
	//val:path|,,date
	//val:path|updateEvent,updateDirection,adapterName
	bindings( {
		val: function( elem, path, context, options ) {

			var updateTarget,
				updateEvent,
				adapterName;

			options = options || "";

			if (!options) {
				updateEvent = "change";
			} else {
				options = options.split( "," );
				updateEvent = options[0] || "change"; //by default it is "change"
				updateTarget = options[1]; //undefined, updateView or updateModel
				adapterName = options[2];
			}

			if (!updateTarget || updateTarget == "view") {
				context.appendSub( elem, path, "init1 after*", "*updateViewValue", adapterName );
			}

			if (!updateTarget || updateTarget == "model") {

				//when form is reset, the default behavior of the html form value is reset
				// to value specify "value" attribute, however the change event does not trigger,
				//
				//so we need to use a special event "resetVal" which is triggered
				// when the parent form element is triggered
				// by using this event, we want to update model from the view value
				context.prependSub( path, elem, updateEvent + " resetVal", "*updateModelValue", adapterName );

			}
		}
	} );

	//#merge
})
	( jQuery, hm );
//#end_merge


