//
//<@depends>subscription.js, model.js, declarative.js, template.js</@depends>
//#merge
(function( $, hm ) {
	//#end_merge

	//#merge
	var extend = $.extend;
	var defaultOptions = hm.options;
	var shadowRoot = hm( "*" ).get();
	var rootNode = hm();
	var RegExp = window.RegExp;
	var isArray = $.isArray;
	var trigger = hm.trigger;
	var isString = hm.util.isString;
	var hmFn = hm.fn;
	var isObject = hm.util.isObject;
	var slice = [].slice;
	var isFunction = $.isFunction;
	var toTypedValue = hm.util.toTypedValue;
	var isPrimitive = hm.util.isPrimitive;
	var isUndefined = hm.util.isUndefined;
	var bindings = hm.binding;

	function returnTrue() {
		return true;
	}

	//#end_merge

	defaultOptions.errors = {
		defaultError: "Please enter a valid value"
	};

	var afterUpdateAndCheckValidity = "afterUpdate* checkValidity",
		invalidPaths = shadowRoot.invalidPaths = [],
		invalidPathsModel = hm( "*invalidPaths" ),
		rEmpty = /^\s*$/,
		rEmail = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?$/i,
		rUrl = /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i,
		rDateISO = /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,
		rNumber = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/,
		rDigit = /^\d+$/,
		rInvalidDate = /Invalid|NaN/,
		rRegEx = /^(\/(\\[^\x00-\x1f]|\[(\\[^\x00-\x1f]|[^\x00-\x1f\\\/])*\]|[^\x00-\x1f\\\/\[])+\/[gim]*)(,(.*))*$/,
		rFirstToken = /([^,]+)(,(.*))?/,
		rFirstTwoToken = /(\w+),(\w+)(,(.*))?/;

	/*	this method is to create a subscription group and
	 workflow type using the name of validator
	 and also add a class rule using the name of validator
	 so make sure the name of validator do not collide with other validator

	 a validator is object like
	 {
	 name: "validatorName",
	 error: "error message"
	 isValid: function( value, options ); // options let user to help the isValid to work better
	 initialize: function(options); //allow user convert string value of modelEvent.options to the options passed in isValid function
	 buildError: function(defaultMessage, options )
	 }
	 */
	hm.validator = function( validator ) {

		if (isArray( validator )) {
			for (var i = 0; i < validator.length; i++) {
				hm.validator( validator[i] );
			}
			return this;
		}

		var validatorName = validator.name;

		if (hm.workflow( validatorName )) {
			throw "validator name '" + validatorName + "' collide with name in hm.workflowTypes";
		}

		//add default error if applicable
		//user can localize errors message
		if (validator.error) {
			defaultOptions.errors[validatorName] = validator.error;
		}

		if (validator.isValid instanceof RegExp) {
			validator.isValid = buildRegexFn( validator.isValid );
		}

		var workflowTypeName = "v_" + validatorName;
		hm.workflow( workflowTypeName, buildValidationWorkflowType( validator ) );

		//data-sub="required:path" or data-sub="required:path|options"
		bindings( validatorName, "!afterUpdate checkValidity:.|*" + workflowTypeName );

	};

	hm.workflow( {
		checkValidity: function( e ) {
			if (!hm.checkValidity( this.path )) {
				//because it is the first handler, e.stopImmediatePropagation will
				//stop process all other handler
				e.stopImmediatePropagation();
			}
		},

		// use by group
		// warn: "!after*:*errors|*warn",
		warn: function( e ) {
			//e.publisher points to "model*errors"
			if (e.publisher.isEmpty()) {

				this
					.removeClass( "error" )
					.next( "span.error" )
					.remove();

			} else {

				this
					.addClass( "error" )
					.next( "span.error" )
					.remove()
					.end()
					.after( "<span class='error'>" + e.publisher.get() + "</span>" );
			}
		},

		highlightError: function( e ) {
			this[e.publisher.isEmpty() ? "removeClass" : "addClass"]( "error" );

		},

		renderErrorSummary: hm.template.newTemplateHandler(
			function( e ) {
				return [e.publisher.getErrors()];
			}
		)
	} );

	bindings( {

		validator: function( elem, path, context, options ) {
			if (!options) {
				throw "missing validator path";
			}
			if (!options.startsWith( "#" )) {
				options = "#" + options;
			}
			hm( path ).validator( options );
		},

		//add a click handler to element to checkValidity
		checkValidity: function( elem, path, context, options ) {
			//prepend to to subscriptions array
			//so that it is the first subscriptions, and it will be evaluated first
			context.prependSub( path, elem, "click", "*checkValidity" );
		},

		resetValidity: "$click:.|*fakeGet resetValidity",

		warn: "!after*:*errors|*warn",

		"highlightError": "!after*:*errors|*highlightError",

		warnSummary: "!afterUpdate* validityChecked:.|*renderErrorSummary;!validityReset:.|empty"

	} );

	bindings( "form", function( elem, path, context, options ) {
		context.appendSub( path, elem, "reset", "*fakeGet resetValidity" );
	}, true );

	function isPathValid( path ) {

		if (path === "") {
			return !invalidPaths.length;
		}

		var prefix = path + ".";

		for (var i = 0, invalidPath, length = invalidPaths.length; i < length; i++) {
			invalidPath = invalidPaths[i];
			if (invalidPath == path || invalidPath.startsWith( prefix )) {
				return false;
			}
		}
		return true;
	}

	//$("x").subscribe("person", "checkValidityd", function (e) {
	// alert(e.proposed);
	//}
	hm.subscription.special.validityChanged = {
		setup: function( subscriber, publisher ) {
			var isValidPath = publisher + "*isValid";

			if (isUndefined( hm.get( isValidPath ) )) {
				hm.sub( publisher, "*invalidPaths", "!after*. after*.1", function() {
					var isValid = isPathValid( publisher );
					if (hm.get( isValidPath ) !== isValid) {
						hm.trigger( publisher, publisher, "validityChanged", isValid, !isValid );
						hm.set( isValidPath, isValid );
					}
				} );
			}
		}
	};

	extend( hmFn, {

		/*
		 * 1. the objects in path "*invalidPaths", it holds all the path of model which is in error
		 * 2. the object in path "model*errors", it holds all error message that is
		 * */
		checkValidity: function( subPath ) {

			var fullPath = this.getPath( subPath ); // this.cd( subPath ).path;

			traverseModelNeedValidation( fullPath, function( path ) {
				trigger( path, path, "checkValidity", rootNode.get( path ) );
			} );

			//after checkValidity fired, we can check the invalid paths count for the model,
			var isValid = isPathValid( fullPath );
			//
			hm.trigger( fullPath, fullPath, "validityChecked", isValid );

			return isValid;
		},

		//hm("x").check(validatorName, error)
		//example
		//hm("x").check("number", "my error message")
		//
		//hm("x").check(fnIsValid, error)
		//example
		//hm("x").check(function( value ) { return false; }, "my error message");
		validator: function( validator, options ) {
			var subPath,
				i,
				currentValidator;

			if (isObject( validator )) {

				for (subPath in validator) {

					this.cd( subPath ).validator( validator[subPath] );

				}
			} else {

				if (isFunction( validator ) || (isString( validator ) && validator.startsWith( "#" ))) {

					if (isString( validator )) {
						validator = this.raw( validator.substr( 1 ) );
					}

					hm.handle( this.path, afterUpdateAndCheckValidity, function( e ) {
						var publisher = e.publisher,
							previousError = validator.previousError;

						//don't check when it is empty
						if (!isEmptyString( e.proposed )) {

							var errorMessage = validator( publisher.get() );

							if (errorMessage === false) {
								errorMessage = defaultOptions.errors.defaultError;
							}

							if (isString( errorMessage )) {
								// the "!=" is deliberate, don't change to "!=="
								if (errorMessage != previousError) {

									publisher.addError( errorMessage );

									if (!previousError) {
										publisher.removeError( previousError );
									}

									validator.previousError = errorMessage;
								}

							} else {
								if (previousError) {
									publisher.removeError( previousError );
									validator.previousError = "";
								}
							}
						} else {
							if (previousError) {
								publisher.removeError( previousError );
								validator.previousError = "";
							}
						}

					} );

				} else if (isString( validator )) {

					hm.handle( this.path, afterUpdateAndCheckValidity, "*v_" + validator, options );

				} else if (isArray( validator )) {

					for (i = 0; i < validator.length; i++) {

						currentValidator = validator[i];

						if (isArray( currentValidator )) {
							this.validator( currentValidator[0], currentValidator[1] );

						} else {
							this.validator( currentValidator );
						}
					}
				}

			}
			return this;
		},

		resetValidity: function() {
			resetValidity( this.path );

			if (!isPrimitive( this.get() )) {
				traverseModelNeedValidation( this.path, resetValidity );
			}
			hm.trigger( this.path, this.path, "validityReset" );
		},

		addError: function( error ) {
			this.createIfUndefined( "*errors", [] )
				.cd( "*errors" )
				.pushUnique( error );

			invalidPathsModel.pushUnique( this.path );
			return this;

		},

		removeError: function( error ) {

			var errors = this.createIfUndefined( "*errors", [] ).cd( "*errors" );
			errors.removeItem( error );
			if (errors.isEmpty()) {
				invalidPathsModel.removeItem( this.path );
			}
			return this;
		},

		getErrors: function() {

			var i,
				path = this.path,
				invalidPath,
				rtn = [];

			for (i = 0; i < invalidPaths.length; i++) {
				invalidPath = invalidPaths[i];
				if (invalidPath == path || invalidPath.startsWith( path )) {
					rtn = rtn.concat( hm.get( invalidPath + "*errors" ) );
				}
			}
			return rtn;
		}

	} );

	hm.checkValidity = function( path ) {
		return rootNode.checkValidity( path );
	};

	//when path is deleted, remove it from invalidPathsModel
	hm.onDeleteNode( function( path ) {
		invalidPathsModel.removeItem( path );
	} );

	function buildRegexFn( ex, reverse ) {
		return reverse ? function( value ) {
			return !ex.test( value );
		} : function( value ) {
			return ex.test( value );
		};
	}

	function defaultErrorBuilder( format, options ) {
		return options.error || format.supplant( options );
	}

	hm.validator.defaultErrorBuilder = defaultErrorBuilder;
	hm.validator.buildRegexFn = buildRegexFn;

	hm.validator( [
		{
			name: "required",
			error: "This field is required.",
			//when it is checked it is always true
			isValid: returnTrue
		},
		{
			name: "email",
			error: "Please enter a valid email address.",
			isValid: rEmail
		},
		{
			name: "url",
			error: "Please enter a valid URL.",
			isValid: rUrl
		},
		{
			name: "date",
			error: "Please enter a valid date.",
			isValid: function( value ) {
				return !rInvalidDate.test( new Date( value ).toString() );
			}
		},
		{
			name: "dateISO",
			error: "Please enter a valid date (ISO).",
			isValid: rDateISO
		},
		{
			name: "number",
			error: "Please enter a valid number.",
			isValid: rNumber
		},
		{
			name: "digits",
			error: "Please enter only digits.",
			isValid: rDigit

		},
		{
			name: "creditcard",
			error: "Please enter a valid credit card number.",
			isValid: function( value ) {
				if (/[^0-9\-]+/.test( value )) {
					return false;
				}

				var nCheck = 0,
					nDigit = 0,
					bEven = false,
					cDigit;

				value = value.replace( /\D/g, "" );

				for (var n = value.length - 1; n >= 0; n--) {
					cDigit = value.charAt( n );
					nDigit = parseInt( cDigit, 10 );
					if (bEven) {
						if ((nDigit *= 2) > 9) {
							nDigit -= 9;
						}
					}
					nCheck += nDigit;
					bEven = !bEven;
				}

				return (nCheck % 10) === 0;
			}

		},
		{
			name: "minlength",
			error: "Please enter at least {minlength} characters.",
			isValid: function( value, options ) {

				return value.length >= options.minlength;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {

					handler.options = {
						minlength: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for minlength validator";
				}
			},

			buildError: defaultErrorBuilder
		},
		{
			name: "maxlength",
			error: "Please enter no more than {maxlength} characters.",
			isValid: function( value, options ) {

				return value.length <= options.maxlength;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {
					handler.options = {
						maxlength: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for maxlength validator";
				}
			},
			buildError: defaultErrorBuilder
		},
		{
			name: "rangelength",
			error: "Please enter a value between {minlength} and {maxlength} characters long.",
			isValid: function( value, options ) {

				return value.length >= options.minlength &&
				       value.length <= options.maxlength;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstTwoToken.exec( options ))) {
					handler.options = {
						minlength: +match[1],
						maxlength: +match[2],
						error: match[4]
					};
				} else {
					throw "invalid options for rangelength validator";
				}
			},
			buildError: defaultErrorBuilder

		},
		{
			name: "min",
			error: "Please enter a value greater than or equal to {min}.",
			isValid: function( value, options ) {

				return value >= options.min;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {
					handler.options = {
						min: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for min validator";
				}

			},
			buildError: defaultErrorBuilder
		},
		{
			name: "max",
			error: "Please enter a value less than or equal to {max}.",
			isValid: function( value, options ) {

				return value <= options.max;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {
					handler.options = {
						max: +match[1],
						error: match[3]
					};
				} else {
					throw "invalid options for max validator";
				}
			},
			buildError: defaultErrorBuilder
		},
		{
			name: "range",
			error: "Please enter a value between {min} and {max}.",
			isValid: function( value, options ) {

				return value >= options.min && value <= options.max;

			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstTwoToken.exec( options ))) {
					handler.options = {
						min: +match[1],
						max: +match[2],
						error: match[4]
					};
				} else {
					throw "invalid options for range validator";
				}
			},
			buildError: defaultErrorBuilder
		},
		{
			name: "equal",
			error: "Please enter the same value again.",
			isValid: function( value, options ) {
				return rootNode.get( options.comparePath ) === value;
			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (options && (match = rFirstToken.exec( options ))) {

					var comparePath = publisher.cd( match[1] ).path;
					handler.options = {
						comparePath: comparePath,
						error: match[3]
					};

					publisher.sub( comparePath, "afterUpdate", function( e ) {
						if (!this.isEmpty()) {
							trigger(
								this.path,
								this.path,
								"checkValidity",
								this.get() //proposed value
							);
						}
					} );

				} else {
					throw "invalid options for equal validator";
				}
			}
		},
		{
			name: "regex",
			error: "Please enter a value match with required pattern.",
			isValid: function( value, options ) {
				return options.regex.test( value );
			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;

				if (options && (match = rRegEx.exec( options ))) {
					handler.options = {
						regex: eval( match[1] ),
						error: match[5]
					};
				} else {
					throw "invalid options for regex validator";
				}
			}
		},
		{
			name: "fixedValue",
			error: 'Please enter value "{fixedValue}"',
			isValid: function( value, options ) {
				return value == options.fixedValue;
			},
			initialize: function( publisher, subscriber, handler, options ) {
				var match;
				if (isString( options )) {
					match = /^(\w+)(,(.*))*$/.exec( options );
					if (match) {
						handler.options = {
							fixedValue: toTypedValue( match[1] ),
							error: match[3]
						};
					}
				} else if (isObject( options )) {

					handler.options = options;

				} else if (!isUndefined( options )) {

					handler.options = {
						fixedValue: options
					};

				} else {
					throw "missing options in fixedValue validator";
				}
			},
			buildError: defaultErrorBuilder
		}
	] );

	function resetValidity( path ) {
		var errorsModel = hm( path + "*errors" );
		if (!errorsModel.isEmpty()) {
			errorsModel.clear();
			invalidPathsModel.removeItem( path );
		}
	}

	var isRequired = hm.workflow( "v_required" ).get;

	function isModelRequired( path ) {
		var subscriptionByModel = hm( path ).subsToMe();// subscriptions.getByPublisher( path );
		for (var i = 0; i < subscriptionByModel.length; i++) {
			var subscription = subscriptionByModel[i];
			if (subscription.handler.get === isRequired) {
				return true;
			}
		}
		return false;
	}

	function buildErrorMessage( validator, options ) {

		//named validator normally has a defaultError
		var defaultError = validator.name && defaultOptions.errors[validator.name];

		//if validator has buildError function, this take the highest priority
		if (validator.buildError) {

			//return userError || format.apply( null, [defaultError].concat( options.minlength ) );
			return validator.buildError( defaultError, options );

			//if defaultError is format string,
		} else {

			//userError is normally passed in options of each instance
			var userError = isObject( options ) ? options.error : options;

			if (defaultError && defaultError.contains( "{0}" )) {

				return defaultError.format.apply( defaultError, userError.split( "," ) );

			} else {

				return userError || defaultError || validator.error;
			}
		}
	}

	function buildValidationWorkflowType( validator ) {

		return {

			initialize: validator.initialize,

			get: function( e ) {

				//if it violate required rule, don't do further validation,
				//as we expect the required rule will capture it first.
				var isValid,
					violateRequiredRule,
					publisher = e.publisher,
					options = e.handler.options,
					proposed = e.proposed,
					errorMessage = buildErrorMessage( validator, options );

				//if model is empty, only check the "require" validator
				//If it is required, then it is invalid, no further validation is checked
				//if it is not required, it is valid, no further validation is checked
				if (isEmptyString( proposed )) {

					if (isModelRequired( publisher.path )) {
						isValid = false;
						violateRequiredRule = true;
					} else {
						isValid = true;
					}

				} else {

					isValid = validator.isValid( proposed, options );
				}

				if (!isValid) {

					//add error when the current rule is the "required rule"
					//or when "required" rule is not violated
					if (!violateRequiredRule || validator.name === "required") {
						publisher.addError( errorMessage );
					} else {
						publisher.removeError( errorMessage );
					}
				} else {
					publisher.removeError( errorMessage );
				}
			}
		};
	}

	function traverseModelNeedValidation( path, callback ) {

		//the following code try to trigger the "checkValidity" event, so that the validator will
		// be called to check current value of the model
		//you can not call afterUpdate, because there might trigger other non-validator handler
		//that are attached to afterUpdate
		var allSubscriptions = hm.subscription.getAll();
		var checkValiditydPaths = {};

		for (var i = allSubscriptions.length - 1, subscription, publisherPath; i >= 0; i--) {

			subscription = allSubscriptions[i];
			publisherPath = subscription.publisher;

			var isValidationRequired =
				isString( publisherPath ) && !checkValiditydPaths[publisherPath] &&
				publisherPath.startsWith( path ) &&
				subscription.eventTypes.contains( "checkValidity" );

			if (isValidationRequired) {

				checkValiditydPaths[publisherPath] = true;
				callback( publisherPath );

			}
		}
	}

	function isEmptyString( value ) {
		return value === null || value === undefined || rEmpty.test( value );
	}

	//#merge
})( jQuery, hm );
//#end_merge
