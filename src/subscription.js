//

//<@depends>model.js</@depends>

//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var extend = $.extend;
	var watchTable = hm.util._referenceTable;
	var isFunction = $.isFunction;
	var shadowNamespace = hm.debug.shadowNamespace;
	var isString = hm.util.isString;
	var isObject = hm.util.isObject;
	var trigger;
	var toPhysicalPath = hm.util.toPhysicalPath;
	var isUndefined = hm.util.isUndefined;
	var RegExp = window.RegExp;
	var hmFn = hm.fn;
	var slice = [].slice;
	var util = hm.util;
	var rootNode = hm();
	var isPromise = util.isPromise;
	var defaultOptions = hm.options;
	var $fn = $.fn;
	var mergePath = hm.util.mergePath;
	var dummy = {};
	//#end_merge

	var workflowStore,
		rSpaces = /[ ]+/,
		rEndWithStarDot = /\*\.$/,
		rDotOrStar = /\.|\*/g,
	//rOriginalEvent = /^(.+?)(\.\d+)?$/,
		subscriptionManager,
		viewId = 0,
		rInit = /init(\d*)/,
		workflow,
	//the handler string should be like
	// "get set convert finalize initialize"
		activityTypes = "get,set,convert,finalize,initialize".split( "," );

	function returnFalse() {
		return false;
	}

	function returnTrue() {
		return true;
	}

	function Event( publisher, originalPublisher, eventType, proposed, removed ) {
		this.publisher = tryWrapPublisherSubscriber( publisher );
		this.originalPublisher = tryWrapPublisherSubscriber( originalPublisher );
		this.type = eventType;
		this.originalType = eventType;
		this.proposed = proposed;
		this.removed = removed;
	}

	Event.prototype = {
		constructor: Event,

		/*	isOriginal: function() {
		 return this.publisher.path == this.originalPublisher.path;
		 },

		 isBubbleUp: function() {
		 return (this.publisher.path != this.originalPublisher.path) &&
		 (this.publisher.path.startsWith( this.originalPublisher.path ));
		 },*/
		isDependent: function() {
			return (!this.publisher.path.startsWith( this.originalPublisher.path ));
		},

		stopPropagation: function() {
			this.isPropagationStopped = returnTrue;
		},

		stopImmediatePropagation: function() {
			this.isImmediatePropagationStopped = returnTrue;
			this.isPropagationStopped = returnTrue;
			this.isCascadeStopped = returnTrue;
		},

		stopCascade: function() {
			this.isCascadeStopped = returnTrue;
		},

		error: function() {
			this.hasError = returnTrue;
		},

		abort: abort,
		isCascadeStopped: returnFalse,
		isPropagationStopped: returnFalse,
		isImmediatePropagationStopped: returnFalse,
		isAborted: returnFalse,
		hasError: returnFalse,
		level: 0
	};

	// raise model event,
	trigger = function( path, originalPath, eventType, proposed, removed ) {

		var e = new Event( path, originalPath, eventType, proposed, removed );

		//event can be changed inside the function
		callbackModelSubscriptionHandler( e );

		if (!e.isPropagationStopped() && e.publisher.path) {

			if (e.isDependent()) {
				//if is dependent event, the original event has been
				// bubbled up in its direct hierarchy
				//we need to change the hierarchy by setting the target
				e.originalPublisher.path = e.publisher.path;
			}

			//continue to the same instance of event object
			do {

				e.publisher.path = e.publisher.pathContext();
				e.level++;
				e.type = e.originalType + "." + e.level;
				callbackModelSubscriptionHandler( e );

			} while (!e.isPropagationStopped() && e.publisher.path);
		}

		//restore previous values
		e.type = eventType;
		e.originalPublisher.path = originalPath;
		e.publisher.path = path;
		return e;
	};

	//#merge
	//override the trigger defined in model.js module
	hm._setTrigger( trigger );
	//#end_merge

	subscriptionManager = (function() {

		var subscriptionStore = [ ];

		//target is either publisher or subscriber
		function canRemoveSubscriptionData( target, publisher, subscriber ) {
			if (target === publisher || target === subscriber) {
				return true;
			} else {
				//if target is model path
				if (isString( target )) {
					return ( isString( publisher ) && publisher.startsWith( target + "." )) ||
					       ( isString( subscriber ) && subscriber.startsWith( target + "." ));
				} else {
					return false;
				}
			}

		}

		function getSubscriptionsBy( target, match ) {
			if (isString( target )) {
				target = toPhysicalPath( target );
			}

			var rtn = [];
			for (var i = 0, item; i < subscriptionStore.length; i++) {
				item = subscriptionStore[i];
				if (match( item, target )) {
					rtn.push( item );
				}
			}
			return rtn;
		}

		return {

			//subscriptions whose publisher is the parameter
			//publisher can be a model path or dom element, or object
			getByPublisher: function( publisher ) {
				return getSubscriptionsBy( publisher, function( item, target ) {
					return item.publisher == target;
				} );
			},

			//subscriptions whose subscriber is the parameter
			//subscriber can be a model path or dom element, or object
			getBySubscriber: function( subscriber ) {
				return getSubscriptionsBy( subscriber, function( item, target ) {
					return item.subscriber == target;
				} );
			},

			//object can be a model path or dom element, or object
			getBy: function( subscriberOrPublisher ) {
				return getSubscriptionsBy( subscriberOrPublisher, function match( item, target ) {
					return item.subscriber == target || item.publisher == target;
				} );
			},

			getAll: function() {
				return subscriptionStore;
			},

			add: function( subscriber, publisher, eventTypes, handler ) {
				if (isString( publisher )) {

					var events = eventTypes.split( rSpaces );
					for (var i = 0; i < events.length; i++) {
						var special = this.special[events[i]];
						special && special.setup && special.setup( subscriber, publisher );
					}
				}

				subscriptionStore.push( {
					publisher: publisher,
					subscriber: subscriber,
					eventTypes: eventTypes,
					handler: handler
				} );
			},

			removeBy: function( subscriberOrPublisher ) {

				var i,
					j,
					special,
					subscription,
					handler,
					subscriptionsRemoved = [];

				for (i = subscriptionStore.length - 1; i >= 0; i--) {
					subscription = subscriptionStore[i];
					handler = subscription.handler;

					if (canRemoveSubscriptionData( subscriberOrPublisher, subscription.publisher, subscription.subscriber )) {

						//if publisher is an view object, need to unbind or undelegate
						//the jQuery event handler
						if (!isString( subscription.publisher )) {
							if (handler.delegateSelector) {
								$( subscription.publisher ).undelegate( handler.delegateSelector, subscription.eventTypes, viewHandlerGateway );

							} else {
								$( subscription.publisher ).unbind( subscription.eventTypes, viewHandlerGateway );
							}
						}

						subscriptionsRemoved.push( subscriptionStore.splice( i, 1 )[0] );
					}
				}

				for (i = subscriptionsRemoved.length - 1; i >= 0; i--) {
					subscription = subscriptionsRemoved[i];
					if (isString( subscription.publisher )) {
						var events = subscription.eventTypes.split( rSpaces );
						for (j = 0; j < events.length; j++) {
							special = this.special[events[j]];
							special && special.teardown && special.teardown( subscription.subscriber, subscription.publisher );
						}
					}
				}
			},

			special: {
				/*validityChanged: {
				 setup: function (publisher, subscriber) {},
				 teardown: function (publisher, subscriber) {}
				 }
				 */
			}

		};
	})();

	function getMember( e ) {

		var handler = e.handler,
			propertyName = handler.getName,
		//getSubProperty is used for properties like css, attr, prop
			subPropertyName = handler.getParas,
			publisher = e.publisher;

		return subPropertyName ? publisher[propertyName]( subPropertyName ) :
			isFunction( publisher[propertyName] ) ? publisher[propertyName]() :
				publisher[propertyName];
	}

	function setMember( value, e ) {
		var handler = e.handler,
			propertyName = handler.setName,
		//setSubProperty is used for properties like css, attr, prop
			subPropertyName = handler.setParas,
			subscriber = this;

		subPropertyName ? subscriber[propertyName]( subPropertyName, value ) :
			isFunction( subscriber[propertyName] ) ? subscriber[propertyName]( value ) :
				subscriber[propertyName] = value;
	}

	extend( hm, {

		//Event: Event,

		trigger: trigger,

		subscription: subscriptionManager,

		//handler can be a function (e) {}
		// a string like "get set convert int"
		//or "*get *set *convert *int"
		//or it can be "*commonHandler"
		//or it can be { get:xx, set:xx, convert:xx, initialize: xx}
		//it can be a javascript object, dom element, but it can not be a jQuery object
		//subscriber can be null, "_", "null", undefined to represent a case where there is not subscriber
		//if subscriber is "", it means the the root model, the repository object
		sub: function( subscriber, publisher, eventTypes, workflow, workflowOptions, delegateSelector ) {

			if (subscriber instanceof hm) {
				subscriber = subscriber.path;
			}

			if (publisher instanceof hm) {
				publisher = publisher.path;
			}

			if (isString( subscriber ) && subscriber.startsWith( "$" )) {
				subscriber = $( subscriber.substr( 1 ) );
			}

			if (subscriber && subscriber.jquery) {
				//subscriber is like $()
				//need to convert jQuery object into dom or raw element
				if (!subscriber.length && !subscriber.selector) {
					subscriber = null;
				} else {
					subscriber.each( function( index, element ) {
						//unwrap jQuery element
						hm.sub( element, publisher, eventTypes, workflow, workflowOptions, delegateSelector );
					} );
					return;
				}
			}

			if (isString( publisher ) && publisher.startsWith( "$" )) {
				publisher = $( publisher.substr( 1 ) );
			}

			if (publisher && publisher.jquery) {
				publisher.each( function( index, element ) {
					hm.sub( subscriber, element, eventTypes, workflow, workflowOptions, delegateSelector );
				} );
				return;
			}

			if (!publisher && publisher !== "") {
				throw "publisher can not be null";
			}

			if (!eventTypes) {
				throw "eventTypes can not be null";
			}

			//allow subscriber "", because this is the path of root model
			if (subscriber === "_" || subscriber == "null" || subscriber === null) {
				subscriber = undefined;
			}

			if (workflowOptions === "_") {
				workflowOptions = undefined;
			}

			var isPublisherModel = isString( publisher ),
				isSubscriberModel = isString( subscriber );

			viewIdManager.mark( publisher );
			viewIdManager.mark( subscriber );

			if (isPublisherModel) {
				//subscriber is a model
				publisher = toPhysicalPath( publisher );
			}

			if (isSubscriberModel) {
				//subscriber is a model
				subscriber = toPhysicalPath( subscriber );

			}

			if (isPublisherModel) {

				subscribeModelEvent( publisher, eventTypes, subscriber, workflow, workflowOptions );

			} else {

				subscribeViewEvent( publisher, eventTypes, subscriber, workflow, workflowOptions, delegateSelector );
			}
		},

		handle: function( /* publisher, eventTypes, workflow, workflowOptions, delegateSelector */ ) {
			return this.sub.apply( this, [null].concat( slice.call( arguments ) ) );
		},

		//a workflowPrototype can be a string like "get set convert initialize finalize"
		// or it can be an object
		/*
		 {
		 get: "xx" or function () {},
		 set: "xx" or function () {},
		 convert: "xx" or function () {},
		 initialize: "xx" or function () {},
		 finalize: "xx" or function () {}
		 }
		 */
		workflow: workflow = function( name, workflowPrototype ) {

			if (isObject( name )) {
				for (var key in name) {
					workflowStore[key] = buildWorkflow( name[key] );
				}
				return;
			}

			if (isUndefined( name )) {
				return workflowStore;
			}

			if (isUndefined( workflowPrototype )) {
				return workflowStore[name];
			}

			workflowStore[name] = buildWorkflow( workflowPrototype );
			return workflowStore[name];

		},
		//common getter and setter are special activity in they way they are used
		//other activities use the key directly to reference the activities
		// but getters and setters need to use "*key" to reference getters and setters
		// if your getter/setter key does not begin with "*", then it will use the defaultGet
		//or defaultSet, and they key will become the getProperty, and optionally,
		// use options to pass the getProp value, the defaultGet/defaultSet
		// are not meant to be used directly like other common getters or setters
		activity: {

			//initialize( publisher, subscriber, handler, workflowOptions );
			//inside initialize function, 'this' refer to the window
			initialize: {},

			//value = handler.get.apply( subscriber, [e].concat( triggerData ) );
			//inside the getter function, 'this' refer to the subscriber
			//get(e)
			get: {
				getMember: getMember,

				//the original get is "get" current
				//because of event bubbling, the default get method for model
				//will not return the value you want, so need to getOriginal
				getOriginal: function( e ) {
					return e.originalPublisher.get();
				},

				//if we want to call a member "foo" of publisher model
				//but we don't want to do anything to the subscriber, we may want to use expression
				//"*fakeGet foo"

				//$click:items|*editShadowItem
				//$click:items*queryResult|*editShadowItem
				//workflow(handler) -->newShadowItem: "*fakeGet newShadowItem",
				fakeGet: function() {
					return dummy;
				}
			},

			//handler.set.call( subscriber, value, e );
			//inside setter function 'this' refer to the subscriber
			//set(value, e)
			set: {
				setMember: setMember,

				//because hm.js want to support simplified activity expression
				//rule 1
				// "val", when publisher is view, subscriber is model, which means "val" view,
				//"set" model
				//rule 2
				//or "html", when publisher is model, subscriber is view, which means "get" model
				//"html" view.

				//so if publisher is model, subscriber is view. We just want to call a method "get"
				//on model which modify model, but we don't want to call any method on view.
				//we are in dilemma because of rule 2, we don't have a default method for a view.
				//a case in use is that
				//shadowEdit: "!init:.|initShadowEdit *fakeSet;" +
				fakeSet: $.noop

			},

			//handler.convert.call( subscriber, value, e );
			//inside converter function 'this' refer to subscriber
			convert: {

				toString: util.toString,

				toTypedValue: util.toTypedValue,

				toNumber: function( value ) {
					return +value;
				},

				toDate: function( value ) {
					return new Date( value );
				}
			},

			//handler.finalize.call( subscriber, value, e );
			//inside the afterSet function, 'this' refer to the subscriber
			finalize: {
				//				saveLocal: function( value, e ) {
				//					util.local( e.publisher.path, value );
				//				}
			}
		}
	} );

	workflowStore = {

		change: {
			get: function( e ) {
				rootNode.change( e.handler.options );
			}
		},
		saveLocal: {
			get: function( e ) {
				var path = e.publisher.path;
				setTimeout( function() {
					hm( path ).saveLocal();
				}, 1 );
			}
		}
	};

	var viewIdManager = {

		getId: function( elem ) {
			return $( elem ).hmData( "viewId" );
		},

		unMark: function( elem ) {
			$( elem ).hmData( "viewId", undefined );
		},

		mark: function( elem ) {
			if (isObject( elem ) && !$( elem ).hmData( "viewId" )) {
				$( elem ).hmData( "viewId", ++viewId );
			}
		}
	};

	// -------- private ------------- //
	//the reason that we want to buildUniqueViewEventTypes is that
	//when unbind or undelegate the viewEventTypes, we want to the viewEventTypes
	//as unique as possible, check the unsubscribe method
	//
	//input: getUniqueViewEventTypes("click dblClick", viewWithViewId3, "customer")
	//output: "click.__hm.3.customer dblClick.__hm.3.customer"
	//input: getUniqueViewEventTypes("click dblClick", viewWithViewId3, viewWithViewId4)
	//output: "click.__hm.3.4 dblClick.__hm.3.4"
	//it try to append an event name with and ".__hm.viewId.subscriberId"
	function buildUniqueViewEventTypes( originalEventTypes, publisherView, subscriber ) {

		var publisherViewId = viewIdManager.getId( publisherView );

		/*	if original viewEvents is "click dblClick",
		 and it bind to path "firstName", it will convert to
		 click.__hm.firstName dblClick.__hm.firstName, the reason is that
		 when path is deleted, the method unbind(object) need to unbind
		 event by a namespace, if firstName is deleted, we can unbind ".__hm.firstName"*/
		return $.map(
			originalEventTypes.split( rSpaces ),
			function( originalEventName ) {
				return isString( subscriber ) ?
					originalEventName + "." + shadowNamespace + "." + publisherViewId + "." + subscriber :
					originalEventName + "." + shadowNamespace + "." + publisherViewId + "." + viewIdManager.getId( subscriber );
			}
		).join( " " );
	}

	//if object is dom element or jQuery selector then wrap into jQuery
	//if object is model path, wrap it into model
	//if it is pure object, return as it is
	//if it is _, return null
	function tryWrapPublisherSubscriber( publisherOrSubscriber ) {
		if (isString( publisherOrSubscriber )) {
			return hm( publisherOrSubscriber );

		} else if (isObject( publisherOrSubscriber ) && !publisherOrSubscriber.nodeType) {
			//not a DOM element
			return publisherOrSubscriber;

		} else if (!isUndefined( publisherOrSubscriber )) {

			return $( publisherOrSubscriber );
		}
	}

	function replaceDotOrStar( match ) {
		//if match is ".", normalize it to "\\."
		//if match is "*", normalize it to ".*"
		return match == "." ? "\\." : ".*";
	}

	//if one of the subscribed events is matched with triggering event
	//return that subscribed event
	function getMatchedSubscribedEvent( subscribedEvents, triggeringEvent ) {

		var match,
			source,
			rMatchWithTriggeringEvent,
			eventSubscribed,
			isEndWithStarDot,
			i;

		if (subscribedEvents === "*") {
			return "*";
		}

		subscribedEvents = subscribedEvents.split( rSpaces );

		for (i = 0; i < subscribedEvents.length; i++) {

			eventSubscribed = subscribedEvents[i];

			isEndWithStarDot = rEndWithStarDot.test( eventSubscribed );

			source = isEndWithStarDot ?
				//if eventSubscribed is like "*." or "before*.";
				eventSubscribed.replace( rEndWithStarDot, "" ) :
				eventSubscribed;

			source = source.replace( rDotOrStar, replaceDotOrStar );

			source = isEndWithStarDot ? "^" + source : "^" + source + "$";

			rMatchWithTriggeringEvent = new RegExp( source, "i" );

			match = rMatchWithTriggeringEvent.test( triggeringEvent );

			if (match) {
				if (isEndWithStarDot) {
					//in other browser, in the following is enough
					//var remaining = RegExp.rightContext;
					//
					//however in IE has a bug that, if rTemp is /^/, RegExp.rightContext return ""
					//while other browser RegExp.rightContext return the remaining
					//see http://jsbin.com/ikakuw/2/edit
					var remaining = source == "^" ? triggeringEvent : RegExp.rightContext;

					//if remaining is empty or remaining does not contains "."
					if (!remaining || !remaining.contains( "." )) {
						return subscribedEvents[i];
					}
				} else {
					return subscribedEvents[i];
				}
			}
		}
	}

	//check if subscription matched with the triggering event,
	// and invoke its workflow, and also cascade the events to
	//horizontally, e is mutable
	function callbackModelSubscriptionHandler( e ) {

		var subscription,
			watchingPaths,
			cascadeEvent,
			i,
			j,
			subscriptionsByPublisher = e.publisher.subsToMe();

		for (i = 0; i < subscriptionsByPublisher.length; i++) {

			subscription = subscriptionsByPublisher[i];

			e.matchedType = getMatchedSubscribedEvent( subscription.eventTypes, e.type );

			if (e.matchedType) {
				executeHandler( tryWrapPublisherSubscriber( subscription.subscriber ), subscription.handler, e );
			}

			if (e.isImmediatePropagationStopped()) {
				return;
			}
		}

		if (!e.isCascadeStopped()) {

			watchingPaths = watchTable[e.publisher.path];

			if (watchingPaths) {
				for (j = 0; j < watchingPaths.length; j++) {

					cascadeEvent = trigger(
						watchingPaths[j],
						e.originalPublisher.path,
						e.type
					);

					if (cascadeEvent.isImmediatePropagationStopped() || cascadeEvent.isImmediatePropagationStopped()) {
						return;
					}

					if (cascadeEvent.hasError()) {
						e.error();
					}
				}
			}
		}
	}

	//#debug

	if (location.search.contains( "debug" )) {
		defaultOptions.debug = true;
	}

	function unwrapObject( object ) {
		if (object) {
			if (!isUndefined( object.path )) {
				return hm.util.toLogicalPath( object.path );
			} else {
				return object[0];
			}
		} else {
			return "null";
		}
	}

	//#end_debug

	function executeHandler( subscriber, handler, e, triggerData ) {

		//#debug
		if (defaultOptions.debug) {
			log( unwrapObject( e.publisher ),
				e.type,
				unwrapObject( subscriber ),
				handler,
				unwrapObject( e.originalPublisher )
			);
		}
		//#end_debug

		var value,
			clonedEventArg;

		e.handler = handler;
		e.subscriber = subscriber;

		if (!isUndefined( triggerData )) {
			//in the get method "this" refer to the handler
			value = handler.get.apply( subscriber, [e].concat( triggerData ) );
		} else {
			//in the get method "this" refer to the handler
			value = handler.get.call( subscriber, e );
		}

		if (e.isAborted()) {
			return;
		}

		if (isPromise( value )) {
			clonedEventArg = extend( true, {}, e );
			value.done( function( value ) {
				if (handler.convert) {
					//in the convert method "this" refer to the handler
					value = handler.convert.call( subscriber, value, e );
				}

				if (handler.set || handler.finalize) {
					//make sure it is a real promise object
					if (isPromise( value )) {
						value.done( function( value ) {
							setAndFinalize( subscriber, handler, value, clonedEventArg );
						} );

					} else {
						return setAndFinalize( subscriber, handler, value, e );
					}
				}
			} );
		} else {
			if (handler.convert) {
				//in the convert method "this" refer to the handler
				value = handler.convert.call( subscriber, value, e );
			}

			if (handler.set || handler.finalize) {
				//make sure it is a real promise object
				if (isPromise( value )) {
					clonedEventArg = extend( true, {}, e );
					value.done( function( value ) {
						setAndFinalize( subscriber, handler, value, clonedEventArg );
					} );

				} else {
					setAndFinalize( subscriber, handler, value, e );
				}
			}
		}

	}

	function setAndFinalize( subscriber, handler, value, e ) {
		if (value === dummy) {
			value = undefined;
		}
		handler.set && handler.set.call( subscriber, value, e );
		handler.finalize && handler.finalize.call( subscriber, value, e );
	}

	function subscribeModelEvent( publisherPath, eventTypes, subscriber, handler, options ) {

		var match,
			delayMiniSecond,
			initEvent,
			events;

		events = eventTypes.split( " " );

		for (var i = 0; i < events.length; i++) {
			match = rInit.exec( events[i] );
			if (match) {
				initEvent = events[i];
				delayMiniSecond = +match[1];
				events.splice( i, 1 );
				eventTypes = events.join( " " );
				break;
			}
		}

		handler = buildHandler( handler, publisherPath, subscriber, options );

		if (eventTypes) {
			subscriptionManager.add( subscriber, publisherPath, eventTypes, handler );
		}

		if (initEvent) {
			var init = function() {
				var e = new Event( publisherPath, publisherPath, initEvent );
				executeHandler( tryWrapPublisherSubscriber( subscriber ), handler, e );
			};

			if (delayMiniSecond) {
				setTimeout( init, delayMiniSecond );
			} else {
				init();
			}
		}
	}

	//subscribe jQuery event
	function subscribeViewEvent( viewPublisher, eventTypes, subscriber, handler, options, delegateSelector ) {

		//get/set/convert/[init]/[options]
		var needInit,
			eventSeedData,
			temp;

		temp = eventTypes.split( " " );

		if (temp.contains( "init" )) {
			needInit = true;
			eventTypes = temp.remove( "init" ).join( " " );
		}

		handler = buildHandler( handler, viewPublisher, subscriber, options );

		eventSeedData = {
			handler: handler,
			subscriber: subscriber
		};

		if (eventTypes) {
			eventTypes = buildUniqueViewEventTypes( eventTypes, viewPublisher, subscriber );

			if (delegateSelector) {
				handler.delegateSelector = delegateSelector;
				$( viewPublisher ).delegate( delegateSelector, eventTypes, eventSeedData, viewHandlerGateway );

			} else {
				$( viewPublisher ).bind( eventTypes, eventSeedData, viewHandlerGateway );

			}

			//we have passed handler, subscriber, options as jQuery eventSeedData,
			//we still need to add them to subscriptions so that
			//the view event handler can be unbind or undelegate
			subscriptionManager.add( subscriber, viewPublisher, eventTypes, handler );

			if (needInit) {
				if (delegateSelector) {
					$( viewPublisher ).find( delegateSelector ).trigger( eventTypes );
				} else {
					$( viewPublisher ).trigger( eventTypes );
				}
			}

		} else if (needInit) {

			$( viewPublisher ).one( "init", eventSeedData, viewHandlerGateway );
			$( viewPublisher ).trigger( "init" );

		}
	}

	function abort() {
		this.isAborted = returnTrue;
	}

	//the general jQuery event handler
	function viewHandlerGateway( e ) {
		e.publisher = tryWrapPublisherSubscriber( e.currentTarget );
		e.originalPublisher = tryWrapPublisherSubscriber( e.target );
		e.isAborted = returnFalse;
		e.abort = abort;
		var subscriber = tryWrapPublisherSubscriber( e.data.subscriber );

		var handler = e.data.handler;
		delete e.data;

		if (arguments.length > 1) {
			executeHandler( subscriber, handler, e, slice.call( arguments, 1 ) );

		} else {
			executeHandler( subscriber, handler, e );
		}
	}

	function buildHandler( workflowPrototype, publisher, subscriber, initializeOptions ) {

		var handler;

		workflowPrototype = workflowPrototype || "";

		if (isString( workflowPrototype )) {

			handler = buildHandlerFromString( workflowPrototype, publisher, subscriber, initializeOptions );

		} else if (isFunction( workflowPrototype )) {

			handler = extend( {
					get: workflowPrototype,
					options: initializeOptions
				},
				workflowPrototype
			);

		} else if (isObject( workflowPrototype ) && workflowPrototype.get) {

			handler = extend( {
				options: initializeOptions
			}, workflowPrototype );

		} else {
			throw "invalid workflow expression";
		}

		initializeHandler( handler, publisher, subscriber, initializeOptions );

		convertStringAccessorToFunction( "get", handler, publisher, subscriber );
		convertStringAccessorToFunction( "set", handler, publisher, subscriber );
		//
		convertStringActivityToFunction( "convert", handler, publisher, subscriber );
		convertStringActivityToFunction( "finalize", handler, publisher, subscriber );

		return handler;
	}

	// example of workflowString
	// zero token, the subscriber must be function in repository
	//
	// single token like "*workflow", "val", "html", "#path",
	// "val" will expand to "val set" or "get val" depending the type of publisher
	//
	// multiple tokens, all token can starts with "*", "#",
	// but only "get" and "set" token can start normal characters,
	// such as "val", "html"
	function buildHandlerFromString( workflowString, publisher, subscriber, initializeOptions ) {

		//get set convert initialize finalize
		var handler,
			embeddedHandler,
			activityName,
			activityNames = workflowString.split( rSpaces ),
			activityType;

		if (activityNames.length == 1) {

			if (workflowString.startsWith( "*" )) {

				handler = workflowStore[workflowString.substr( 1 )];
				if (!handler) {
					throw "common workflow " + workflowString + " does not exist";
				}

				handler = extend( {}, handler );

			} else if (workflowString.startsWith( "#" )) {

				embeddedHandler = getEmbeddedActivity( workflowString, publisher, subscriber );

				if (isFunction( embeddedHandler )) {
					handler = extend( {
						get: embeddedHandler,
						options: initializeOptions
					}, embeddedHandler );
				} else if (isObject( embeddedHandler ) && embeddedHandler.get) {
					handler = extend( {
						options: initializeOptions
					}, embeddedHandler );
				} else {
					throw "missing handler";
				}

			} else if (!isUndefined( publisher ) && !isUndefined( subscriber )) {

				handler = inferHandlerFromPublisherSubscriberWithSingleActivity(
					publisher,
					subscriber,
					workflowString );

			} else {
				//either model is empty or view is empty,
				// and the workflow string is a single
				//key, and the key is not workflow type
				throw "invalid handler";
			}

		} else {
			//this is the case
			//activityNames.length > 1

			handler = { };

			//activityTypes is [get,set,convert,finalize,initialize]
			for (var i = 0; i < activityTypes.length; i++) {
				activityName = activityNames[i]; //activityName is the token in workflow string
				activityType = activityTypes[i]; //activityType is one of get,set,convert,finalize,initialize

				if (activityName && (activityName !== "_" && activityName != "null")) {
					handler[activityType] = activityName;
				}
			}
		}
		return handler;
	}

	//get embedded handler helper by path
	//the path should be a path prefix with "#"
	//that path can be absolute path like "#/a.b"
	//or it can be relative path relative to subscriber model or publisher model
	function getEmbeddedActivity( activityNamePrefixWithSharpCharacter, publisher, subscriber ) {

		var modelPath = activityNamePrefixWithSharpCharacter.substr( 1 );

		modelPath = isString( subscriber ) ? mergePath( subscriber, modelPath ) :
			isString( publisher ) ? mergePath( publisher, modelPath ) :
				modelPath;

		return rootNode.raw( modelPath );
	}

	function initializeHandler( handler, publisher, subscriber, workflowOptions ) {

		var initialize = handler.initialize;

		if (isString( initialize )) {
			if (initialize.startsWith( "*" )) {
				initialize = hm.activity.initialize[initialize.substring( 1 )];
				if (!initialize) {
					throw "initialize activity does not exist!";
				}
			} else {
				var path = initialize;
				if (!rootNode.raw( path )) {
					throw "initialize activity does not exist at path " + path;
				}
				initialize = function( publisher, subscriber, handler, options ) {
					rootNode.set( path, publisher, subscriber, handler, options );
				};
			}
		}

		if (initialize) {
			initialize( tryWrapPublisherSubscriber( publisher ), tryWrapPublisherSubscriber( subscriber ), handler, workflowOptions );
		} else if (!isUndefined( workflowOptions )) {
			handler.options = workflowOptions;
		}
	}

	function inferHandlerFromPublisherSubscriberWithSingleActivity( publisher, subscriber, activityName ) {
		//now workflowString does not startsWith *, it is not a workflow type
		//infer handler from publisher and subscriber
		//
		var handler,
			isPublisherModel = isString( publisher ),
			isSubscriberModel = isString( subscriber );

		if (isPublisherModel) {
			//if publisher is model, then the logic is
			//will get model's value using default get activity,
			//and update the view using workflow or  default "set" activity
			//
			handler = {

				get: "get",

				//if workflowString is not empty, it is the set method, for example
				//$("#lable").sub(hm("message"), "text");
				//
				//if workflowString is empty,
				// then it should be the case when model subscribe model
				//copy value of one node to an other node
				//hm("message").sub(hm("name"), "afterUpdate");
				set: activityName || "set"


			};

		} else if (isSubscriberModel) {

			// model subscribe view event

			if (activityName) {
				//hm("name").sub($("#textBox", "change");
				handler = {
					get: activityName,
					set: "set"
				};
			} else {

				//if workflowString is empty
				//when model subscribe view without handler
				//the model is the handler by itself
				//e.g
				//hm("functionNode").subscribe($("button"), "click");
				var temp = rootNode.raw( subscriber );
				if (isFunction( temp )) {

					handler = {
						get: rootNode.raw( subscriber )
					};

				} else if (isObject( temp ) && temp.get) {

					handler = temp;

				} else {
					throw "missing handler";
				}
			}

		} else {
			//view subscribe view's event
			//this is rarely the case, but it is still supported
			//for example, a label subscribe the change of another label
			//$("#lable2").sub("#lable1", "text");
			handler = {
				get: activityName,
				set: activityName
			};
		}

		return handler;
	}

	function buildWorkflow( workflowPrototype ) {

		var workflow;

		if (isString( workflowPrototype )) {

			workflow = buildWorkflowFromString( workflowPrototype );

		} else if (isFunction( workflowPrototype ) || (isObject( workflowPrototype ) && workflowPrototype.get)) {

			workflow = workflowPrototype;
			if (isFunction( workflowPrototype )) {

				workflow = extend(
					{
						get: workflowPrototype
					},
					workflow );
			}

		} else {
			throw "invalid workflow expression";
		}

		convertStringActivityToFunction( "initialize", workflow );
		//
		convertStringAccessorToFunction( "get", workflow );
		convertStringAccessorToFunction( "set", workflow );
		//
		convertStringActivityToFunction( "convert", workflow );
		convertStringActivityToFunction( "finalize", workflow );

		return workflow;
	}

	function buildWorkflowFromString( workflowString ) {

		var workflow,
			activityName,
			activityNames = workflowString.split( rSpaces ),
			activityType;

		if (activityNames.length > 1) {

			workflow = { };

			for (var i = 0; i < activityTypes.length; i++) {
				activityName = activityNames[i];
				activityType = activityTypes[i];

				if (activityName && (activityName !== "_" && activityName != "null")) {
					workflow[activityType] = activityName;
				}
			}
		} else {
			throw "invalid workflow type";
		}

		return workflow;
	}

	function getActivitySet( activityType ) {
		return hm.activity[activityType];
	}

	// publisher, subscriber is optional
	//accessor either "get" or "set"
	function convertStringAccessorToFunction( accessorType, handler, publisher, subscriber ) {

		//by default workflow.get == "get", workflow.set = "set"
		var accessorKey = handler[accessorType];

		if (accessorKey && isString( accessorKey )) {

			var accessors = getActivitySet( accessorType );

			if (accessorKey.startsWith( "*" )) {

				accessorKey = accessorKey.substr( 1 );
				handler[accessorType] = accessors[accessorKey];

				if (!handler[accessorType]) {
					throw accessorKey + " does not exists " + accessorType + " Activity";
				}

			} else if (accessorKey.startsWith( "#" )) {

				handler[accessorType] = getEmbeddedActivity( accessorKey, publisher, subscriber );

			} else {

				var keys = accessorKey.split( "*" );

				//use defaultGet or defaultSet and parseSubs, if accessorKey does not begin with "*"
				// handler.setProperty = accessorKey or
				// handler.getProperty = accessorKey
				handler[accessorType] = accessorType == "get" ? getMember : setMember;
				handler[accessorType + "Name"] = keys[0];

				if (keys[1]) {
					//accessorKey = "css*color"
					handler[accessorType + "Paras"] = keys[1];
				}

				if (!isUndefined( publisher ) && !isUndefined( subscriber )) {
					var publisherOrSubscriber = accessorType == "get" ? publisher : subscriber;
					ensureTargetHasAccessor( accessorType, keys[0], publisherOrSubscriber );
				}
			}
		}
	}

	function ensureTargetHasAccessor( accessorType, activityName, target ) {
		var missingMember;
		if (isString( target )) {

			if (!hmFn[activityName]) {

				missingMember = true;
			}

		} else {
			if (target.nodeType) {
				if (!$fn[activityName]) {
					missingMember = true;
				}
			} else if (!(activityName in target)) {
				missingMember = true;
			}
		}

		if (missingMember) {
			throw (accessorType == "get" ? "publisher" : "subscriber") +
			      " does not have a member " + activityName;
		}
	}

	//activityType is like initialize, convert, finalize
	//activityType for "get", "set" is taken care by convertStringAccessorToFunction
	function convertStringActivityToFunction( activityType, handler, publisher, subscriber ) {
		//because it is optional, we need make sure handler want to have this method
		var activityName = handler[activityType];
		if (isString( activityName )) {

			if (activityName.startsWith( "*" )) {
				handler[activityType] = getActivitySet( activityType )[activityName.substr( 1 )];
				if (!handler[activityType]) {
					throw  activityName + "Activity does not exists";
				}

			} else if (activityName.startsWith( "#" )) {

				handler[activityType] = getEmbeddedActivity( activityName, publisher, subscriber );

			} else {
				throw 'activity other than "get" and "set"  must begin with "*" or "#" ';

			}
		}
	}

	function unsubscribe( target ) {
		if (isObject( target )) {
			if (!viewIdManager.getId( target )) {
				return;
			}
			viewIdManager.unMark( target );
		}
		subscriptionManager.removeBy( target );
	}

	hm.onDeleteNode( unsubscribe );

	//subscription shortcut method for model
	extend( hmFn, {

		trigger: function( subPath, eventName, proposed, removed ) {

			if (!arguments.length) {
				throw "missing arguments";
			}

			if (arguments.length <= 3) {
				removed = proposed;
				proposed = eventName;
				eventName = subPath;
				subPath = "";
			}

			var physicalPath = this.physicalPath( subPath );
			trigger( physicalPath, physicalPath, eventName, proposed, removed );
			return this;
		},

		change: function( subPath ) {
			var physicalPath = this.physicalPath( subPath ),
				value = this.get( subPath );
			trigger( physicalPath, physicalPath, "afterUpdate", value, value );
			return this;
		},

		sub: function( publisher, events, handler, options, delegateSelector ) {
			hm.sub( this.path, publisher, events, handler, options, delegateSelector );
			return this;
		},

		handle: function( eventTypes, workflow, workflowOptions, delegate ) {
			hm.sub( null, this, eventTypes, workflow, workflowOptions, delegate );
			return this;
		},

		subBy: function( subscriber, events, handler, options, delegateSelector ) {
			hm.sub( subscriber, this.path, events, handler, options, delegateSelector );
			return this;
		},

		subsToMe: function( print ) {
			var rtn = subscriptionManager.getByPublisher( this.path );
			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this.path, rtn, "toMe" );
			}
			//#end_debug

			return rtn;
		},

		subsFromMe: function( print ) {
			var rtn = subscriptionManager.getBySubscriber( this.path );
			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this.path, rtn, "fromMe" );
			}
			//#end_debug

			return rtn;
		},

		subs: function( print ) {
			var rtn = subscriptionManager.getBy( this.path );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this.path, rtn );
			}
			//#end_debug

			return rtn;
		},

		/*
		 map an model event to a new model event based on a condition, like the following

		 hm("inventory").mapEvent(
		 "afterUpdate",
		 "inventoryLow",
		 function (value) {
		 return value <= 100;
		 }
		 );

		 condition is optional, if it is missing, the target event will always be triggered
		 when the source event is triggered
		 */
		mapEvent: function( sourceEvent, targetEvent, condition ) {
			condition = condition || returnTrue;
			hm.handle( this.path, sourceEvent, function( e ) {
				if (condition.call( this, e )) {
					e.publisher.trigger( targetEvent, e.proposed, e.removed );
				}
			} );
			return this;
		},

		cacheable: function( subPath ) {
			hm.handle( this.getPath( subPath ), "init after*", "*saveLocal" );
			return this;
		}

	} );

	//subscription shortcut method for jQuery object
	extend( $fn, {

		sub: function( publisher, events, handler, options, delegate ) {
			if (this.length) {
				hm.sub( this, publisher, events, handler, options, delegate );
			}
			return this;
		},

		handle: function( eventTypes, workflow, workflowOptions, delegate ) {
			if (this.length) {
				hm.sub( null, this, eventTypes, workflow, workflowOptions, delegate );
			}
			return this;
		},

		subBy: function( subscriber, events, handler, options, delegate ) {
			if (this.length) {
				hm.sub( subscriber, this, events, handler, options, delegate );
			}
			return this;
		},

		subsToMe: function( print ) {
			var rtn = subscriptionManager.getByPublisher( this[0] );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this[0], rtn, "toMe" );
			}
			//#end_debug

			return rtn;
		},

		subsFromMe: function( print ) {
			var rtn = subscriptionManager.getBySubscriber( this[0] );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this[0], rtn, "fromMe" );
			}
			//#end_debug

			return rtn;
		},

		subs: function( print ) {
			var rtn = subscriptionManager.getBy( this[0] );

			//#debug
			if (print && hm.printSubscriptions) {
				hm.printSubscriptions( this[0], rtn );
			}
			//#end_debug

			return rtn;
		},

		renderView: function( path, workflow, options ) {
			hm.sub( this, path, "init", workflow, options );
			return this;
		},

		/*
		 map a view event to a new view event based on a condition, condition is optional,
		 if it is missing, the target event will always be triggered when the source
		 event is triggered

		 usage
		 $("button").mapEvent("click", "update");
		 */
		mapEvent: function( sourceEvent, targetEvent, condition, eventData ) {
			if (condition) {
				if (!isFunction( condition )) {
					eventData = condition;
					condition = returnTrue;
				}
			} else {
				condition = returnTrue;
			}

			return this.handle( sourceEvent, function( e ) {
				if (condition.call( this, e )) {
					e.type = targetEvent;
					e.eventData = eventData;
					e.publisher.trigger( e );
				}
			} );
		}
	} );

	// create a special jQuery event (y) based on an existing jQuery event (x)
	// when event x is raised, and condition returns true, event y will be raised
	//
	// you can subscribe event y, just like any other jQuery event using
	//$("button").bind("y", fn);
	//
	//unlike $().mapEvent("click", "y"), this method create a new event type for all
	//jQuery object
	hm.newJqEvent = function( event, baseEvent, condition ) {
		if (isObject( event )) {
			for (var key in event) {
				hm.newJqEvent( key, event[key][0], event[key][1] );
			}
			return this;
		}
		var handler = function( e ) {
			if (condition === true || condition.call( this, e )) {
				$( e.target ).trigger( extend( {}, e, {
					type: event,
					currentTarget: e.target
				} ) );
			}
		};

		if ($.event.special[event]) {
			throw "event '" + event + "' has been defined";
		}

		$.event.special[event] = {
			setup: function() {
				$( this ).bind( baseEvent, handler );
			},
			teardown: function() {
				$( this ).unbind( baseEvent, handler );
			}
		};
		return this;
	};

	var _cleanDataForUnsubscribe = $.cleanData;
	//when an dom element is remove unsubscribe it first
	$.cleanData = function( elems ) {
		$( elems ).each( function() {
			unsubscribe( this );
		} );
		_cleanDataForUnsubscribe( elems );
	};

	util.getUniqueViewEventTypes = buildUniqueViewEventTypes;
	util._viewHandlerGateway = viewHandlerGateway;

	//#debug
	hm.debug.getMatchedSubscribedEvent = getMatchedSubscribedEvent;
	hm.debug.buildWorkflowType = buildWorkflow;
	hm.debug.getMember = getMember;
	hm.debug.setMember = setMember;
	hm.debug.unsub = function( object ) {
		unsubscribe( object );
	};
	//#end_debug

	//#merge
})( jQuery, hm );
//#end_merge

