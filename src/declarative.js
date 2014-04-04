//
//<@depends>subscription.js, model.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var defaultOptions = hm.options;
	var $fn = $.fn;
	var toTypedValue = hm.util.toTypedValue;
	var mergePath = hm.util.mergePath;
	var isUndefined = hm.util.isUndefined;
	var isObject = hm.util.isObject;
	var rootNode = hm();
	var isString = hm.util.isString;
	var isFunction = $.isFunction;
	var isArray = $.isArray;
	var extend = $.extend;
	//#end_merge

	var rSubscriptionProperty = /([!$]?)([\w \+\-\*\.]+?):([\w\W]+?)\s*(?:[;]\s*|$)/g,
		rBindingText = /^([^|]+)(\|(.*))?$/,
		rSubscriptionValueSeparator = /\s*\|\s*/g;

	defaultOptions.subsAttr = "data-sub";
	defaultOptions.autoParse = true;

	function mergeOptions( parentOptions, localOptions ) {
		if (localOptions !== "_") {
			return  (localOptions && localOptions.startsWith( "_" )) ?
				localOptions.substr( 1 ) :
				parentOptions || localOptions;
		}
	}

	function getInheritedNamespace( elem ) {

		var $parent = $( elem );

		while (($parent = $parent.parent()) && $parent.length) {

			var ns = $parent.hmData( "ns" );

			if (!isUndefined( ns )) {
				return ns;
			}
		}
		return "";
	}

	var reUnderscore = /_/g;
	var reAttrDash = /-(\w)/g;
	var rDataAttrPrefix = /^data-/;

	var replaceAttrDashWithCapitalCharacter = function( match, $1 ) {
		return $1.toUpperCase();
	};

	//convert add-class to addClass
	//convert $enter_blur to $enter blur
	function normalizeAttributeName( attributeName ) {
		attributeName = attributeName.replace( rDataAttrPrefix, "" );

		//if subscription involve with more than one events, you can
		//concatenate them with "_", here we need to revert them back
		//such as "$click_mouseover" need to be changed to "$click mouseover"
		if (attributeName.startsWith( "!" ) || attributeName.startsWith( "$" )) {

			attributeName = attributeName.replace( reUnderscore, " " );

		}
		return attributeName.replace( reAttrDash, replaceAttrDashWithCapitalCharacter );
	}

	function extractSubscriptionText( elem ) {
		if (elem.nodeType !== 1) {
			return;
		}
		var i,
			attr,
			attributeName,
			attributes = elem.attributes,
			subscriptionText = attributes[defaultOptions.subsAttr] && attributes[defaultOptions.subsAttr].nodeValue || "";

		for (i = 0; i < attributes.length; i++) {
			attr = attributes[i];
			if (attr.name !== defaultOptions.subsAttr) {
				attributeName = normalizeAttributeName( attr.name );
				//if attributeName is recognized by the Hm.js,
				// such as ns="xxx", bindingName="xxx", !event="xxx" , $event="xxx"
				//extract them and append to the subscription text
				if (attributeName == "ns" || _bindings[attributeName]) {
					//if the attribute does not have a value like <div debug>
					//it is the same as <div debug="/">
					subscriptionText = subscriptionText + ";" + attributeName + ":" + (attr.nodeValue || "/");

				} else if (attributeName.startsWith( "!" ) || attributeName.startsWith( "$" )) {
					var nodeValues = attr.nodeValue.split( ";" );
					for (var j = 0; j < nodeValues.length; j++) {
						var nodeValue = nodeValues[j];
						subscriptionText = subscriptionText + ";" + attributeName + ":" + nodeValue;
					}
				}
			}
		}

		var tagBindingName = "tag_" + elem.tagName;
		if (_bindings[tagBindingName]) {
			subscriptionText = subscriptionText + ";" + tagBindingName + ":.";
		}
		return subscriptionText.replace( /^;/, "" );
	}

	//support
	//new Binding()
	//new Binding(subscriptionText, parentBinding)
	//new Binding("$click|*alert;val:path", parentBinding);
	function Binding( subscriptionText, parentBinding, bindingNs, bindingOptions ) {

		var nsProperty, match, emptyBinding;

		//handle the case: new Binding()
		if (!subscriptionText) {
			//
			//shared property
			this.subscriptions = [];
			return;
		}

		//handle the case : new Binding (elem);
		if (subscriptionText.nodeType) {
			var elem = subscriptionText;
			subscriptionText = parentBinding || extractSubscriptionText( elem );
			if (subscriptionText) {
				emptyBinding = new Binding();
				emptyBinding.elem = elem;
				emptyBinding.ns = getInheritedNamespace( elem );
				return new Binding( subscriptionText, emptyBinding );
			}
			return;
		}

		if (!parentBinding) {
			emptyBinding = new Binding();
			//fake an elem
			emptyBinding.elem = {};
			return new Binding( subscriptionText, emptyBinding );
		}

		//handle the case: new Binding(subscriptionText, parentBinding);
		//
		//private data
		this.sub = [];
		this.pub = [];
		this.bindings = [];

		while ((match = rSubscriptionProperty.exec( subscriptionText ))) {

			var prefix = match[1],
				prop = $.trim( match[2] ),
				value = $.trim( match[3] );

			if (prefix) {

				this[prefix == "$" ? "pub" : "sub"].push( { eventTypes: prop, value: value } );

			} else {

				if (prop == "ns") {
					nsProperty = value;

				} else {
					this.bindings.push( { bindingName: prop, value: value} );
				}
			}
		}

		this.ns = mergePath( mergePath( parentBinding.ns, bindingNs ), nsProperty );
		//shared data
		this.text = subscriptionText;
		this.elem = parentBinding.elem;
		//this is a singleton
		//this.subscriptions = parentBinding.subscriptions;

		if (parentBinding.context) {

			this.context = parentBinding.context;

		} else {

			this.context = this;
			this.dynamicBindings = [];
			this.subscriptions = [];
			$( this.elem ).hmData( "ns", this.ns );
		}

		this.options = mergeOptions( parentBinding.options, bindingOptions );

		this._importBindings();
		this._importSubscriptions( "sub" );
		this._importSubscriptions( "pub" );

	}

	Binding.prototype = {

		_importBindings: function() {

			var i,
				bindingName,
				wellknownBinding,
				binding,
				subTextParts,
				bindingNs,
				bindingOptions,
				bindings = this.bindings;

			for (i = 0; i < bindings.length; i++) {

				binding = bindings[i];
				bindingName = binding.bindingName;

				//if value is "path|option1|option2"
				//
				subTextParts = rBindingText.exec( binding.value );
				bindingNs = subTextParts[1]; // "path"
				bindingOptions = subTextParts[3]; //"option1|option2"

				wellknownBinding = _bindings[bindingName];

				if (isFunction( wellknownBinding )) {

					var temp = [
						wellknownBinding,
						this.elem,
						mergePath( this.ns, bindingNs ),
						this,
						mergeOptions( this.options, bindingOptions )
					];

					if (bindingName == "runFirst") {

						this.context.runFirst = temp;

					} else if (bindingName == "runLast") {

						this.context.runLast = temp;

					} else {

						this.context.dynamicBindings.push( temp );
					}

				} else if (isString( wellknownBinding )) {

					//recursively import referencedBinding
					new Binding( wellknownBinding, this, bindingNs, bindingOptions );

				}
			}
		},

		//subscriptionType is either "pub" or "sub"
		_importSubscriptions: function( subscriptionType ) {

			var i,
				subscriptionEntry,
				subscriptionParts,
				publisher,
				eventTypes,
				subscriber,
				subscriptionEntries = this[subscriptionType];

			for (i = 0; i < subscriptionEntries.length; i++) {

				subscriptionEntry = subscriptionEntries[i];
				eventTypes = subscriptionEntry.eventTypes;

				subscriptionParts = subscriptionEntry.value.split( rSubscriptionValueSeparator );

				if (subscriptionType == "sub") {

					//path|handler|options|delegate
					publisher = subscriptionParts[0];

					publisher = publisher.startsWith( "$" ) ?
						publisher : //publisher is a view
						mergePath( this.ns, publisher );

					subscriber = this.elem;

				} else {
					//path|handler|options|delegate
					publisher = this.elem;

					subscriber = subscriptionParts[0];
					subscriber = subscriber.startsWith( "$" ) ?
						subscriber : //subscriber is a view
						mergePath( this.ns, subscriber );
				}

				this.appendSub(
					subscriber,
					publisher,
					eventTypes,
					subscriptionParts[1], //handler
					toTypedValue( mergeOptions( this.options, subscriptionParts[2] ) ), //options
					subscriptionParts[3] //delegate
				);
			}

		},

		appendSub: function( subscriber, publisher, eventTypes, handler, options, delegate ) {
			this.context.subscriptions.push( {
				publisher: publisher,
				eventTypes: eventTypes,
				subscriber: subscriber,
				handler: handler,
				options: options,
				delegate: delegate
			} );
		},

		prependSub: function prependSub( subscriber, publisher, eventTypes, handler, options, delegate ) {
			this.context.subscriptions.unshift( {
				publisher: publisher,
				eventTypes: eventTypes,
				subscriber: subscriber,
				handler: handler,
				options: options,
				delegate: delegate
			} );
		},

		clearSubs: function() {
			this.context.subscriptions.splice( 0, this.subscriptions.length );
		}
	};

	function parseSubs( elem ) {

		var subscriptionText,
			context,
			subscriptions,
			i,
			subscription,
			$elem = $( elem );

		if (!$elem.hmData( "parsed" ) && (subscriptionText = extractSubscriptionText( elem ))) {

			context = new Binding( elem, subscriptionText );
			subscriptions = context.subscriptions;

			var runFirst = context.runFirst;
			if (runFirst) {
				runFirst[0]( runFirst[1], runFirst[2], runFirst[3], runFirst[4] );
			}

			var dynamicBindings = context.dynamicBindings;
			for (i = 0; i < dynamicBindings.length; i++) {
				var dynamicBinding = dynamicBindings[i];
				dynamicBinding[0]( dynamicBinding[1], dynamicBinding[2], dynamicBinding[3], dynamicBinding[4] );
			}

			var runLast = context.runLast;
			if (runLast) {
				runLast[0]( runLast[1], runLast[2], runLast[3], runLast[4] );
			}

			for (i = 0; i < subscriptions.length; i++) {

				subscription = subscriptions[i];
				hm.sub(
					subscription.subscriber,
					subscription.publisher,
					subscription.eventTypes,
					subscription.handler,
					subscription.options,
					subscription.delegate
				);
			}

			//#debug
			context.debug && context.print();
			//#end_debug

			//
			$elem.hmData( "parsed", true );
		}

		$elem.children().each( function() {
			parseSubs( this );
		} );
	}

	//delay auto parse to way for some dependencies to resolve asynchronously
	setTimeout( function() {
		$( function() {
			if (defaultOptions.autoParse) {
				parseSubs( document.documentElement );
			}
		} );
	}, 1 );

	$fn.parseSubs = function() {
		return this.each( function() {
			parseSubs( this );
		} );
	};

	var logModel = hm( "*log", [] );

	var _bindings = {};

	function bindings( name, definition, isTag ) {
		if (!name) {
			return _bindings;
		}

		if (!definition) {

			if (isObject( name )) {
				for (var key in name) {
					bindings( key, name[key] );
				}
				return this;

			} else {
				return _bindings[name];
			}
		}

		if (isArray( definition )) {
			definition = definition.concat( ";" );
		}

		_bindings[isTag ? "tag_" + name.toUpperCase() : name] = definition;
		return this;
	}

	extend( hm, {

		binding: bindings,

		//#debug
		Binding: Binding,
		//#end_debug

		log: function( message, color ) {
			message = message + "";
			message = color ? "<div style='color:" + color + "'>" + message + "</div> " : message;
			logModel.push( message );
		},

		clearlog: function() {
			logModel.clear();
		}
	} );

	function adhocBinding( elem, path, context, options ) {
		rootNode.get( path, elem, path, context, options );
	}

	bindings( "runFirst", adhocBinding );
	bindings( "runLast", adhocBinding );

	//#merge
})( jQuery, hm );
//#end_merge
