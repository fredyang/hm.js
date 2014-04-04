module( "validation.test.js" );

test( "validation", function() {

	hm.set( "a", null );
	hm( "a" ).validator( "required" );

	//	hm.validators("a", {
	//		isValid: function (value) {
	//			return !$.isNaN(value) && (value >= 10);
	//		},
	//		error: "it must be over 9"
	//	});

	strictEqual( hm( "a*errors" ).get(), undefined, "before isValid call, model*errors is undefined" );
	equal( hm( "a" ).checkValidity(), false, "when a model is required, its value cannot be null" );
	equal( hm( "a*errors" ).get().length, 1, "after isValid is called, model*errors is created" );

	hm.set( "b", "" );
	hm( "b" ).validator( "required" );
	ok( true, "a validator can be a string, which watch to a common validator" );

	equal( hm( "b" ).checkValidity(), false, "when a model is required, its value cannot be empty string" );

	hm.set( "c", 0 );
	hm( "c" ).validator( "required" )

	equal( hm( "c" ).checkValidity(), true, "when a model is required, its value can be 0" );

	hm.set( "d", null );
	hm( "d" ).validator( "email" );

	//ok( true, "A validator can be an object" )
	equal( hm( "d" ).checkValidity(), true, "if a model is not required and it is null, " +
	                                  "common validator will be by-passed" );

	hm.set( "e", null );

	hm( "e" ).validator( function( value ) {
		return false;
	}, "" );

	equal( hm( "e" ).checkValidity(), true, "if a model is not required, it is null, its customs " +
	                                   "validator will not be called" );

	hm.set( "f", null );

	hm( "f" ).validator( "required" );

	ok( hm( "f" ).checkValidity() === false && hm().get( "f*errors" ).length === 1, "If required validation is not passed, other validators will not be evaluated" );

	hm().create( "g", 1 );
	hm( "g" ).validator( function( value ) {
		return false;
	} );

	hm( "g" ).checkValidity();
	var errors = hm().get( "g*errors" );
	ok( (errors.length == 1 && errors[0] == hm.options.errors.defaultError),
		"if a custom validator is used, and it return false, the error message is hm.options.errors.defaultError" );

	equal( hm().checkValidity(), false, "parent model is invalid if any of child models is invalid" );

	hm().create( "h", "h" );
	hm( "h" ).validator( "number" );

	hm( "h" ).checkValidity();
	equal( hm().get( "h*errors" )[0], hm.options.errors.number, "error message can be preset in hm.options('errors').validatorName" );

	hm().create( "i", "i" );
	var myerror = "xxxx";
	hm( "i" ).validator( "number", myerror );

	hm( "i" ).checkValidity();
	equal( hm().get( "i*errors" )[0], myerror, "error message can be set manually set as an option" );

	hm.validator( {
		name: "dummy1",
		isValid: function( value ) {
			return false;
		},
		error: "{1},{0}"
	} );

	hm().create( "j", "j" );
	hm( "j" ).validator( "dummy1", "a,b" );
	hm( "j" ).checkValidity();
	equal( hm().get( "j*errors" )[0], "b,a", "error message can be formatted" );

	hm.validator( {
		name: "dummy2",
		isValid: function( value ) {
			return false;
		},
		error: "a",
		buildError: function( errorFormat, options ) {
			return errorFormat + "," + options;
		}
	} )
	hm().create( "k", "k" );
	hm( "k" ).validator( "dummy2", "b" );
	hm( "k" ).checkValidity();
	equal( hm().get( "k*errors" )[0], "a,b", "error message can be build with validator.buildError" );

	hm().create( "l", "jskdjf" );
	hm( "l" ).validator( "email" );
	hm( "l" ).checkValidity();
	equal( hm().get( "l*errors" )[0], hm.options.errors.email, "can check invalid email" );

	hm().create( "m", "x@gmail.com" );
	hm( "m" ).validator( "email" );
	ok( hm( "m" ).checkValidity(), "can check valid email" );

	hm().create( "n", "n" );
	hm( "n" ).validator( "minlength", "2" );
	hm( "n" ).checkValidity();
	equal( hm().get( "n*errors" )[0], hm.options.errors.minlength.supplant( { minlength: 2} ), "minlength can check invalid input" );

	hm().create( "o", "oo" );
	hm( "o" ).validator( "minlength", "2" );
	ok( hm( "o" ).checkValidity(), "minlength can check valid input" );

	hm().create( "p", "ppp" );
	hm( "p" ).validator( "maxlength", "2" );
	hm( "p" ).checkValidity();
	equal( hm().get( "p*errors" )[0], hm.options.errors.maxlength.supplant( { maxlength: 2} ), "maxlength can check invalid input" );

	hm().create( "q", "qq" );
	hm( "q" ).validator( "maxlength", "2" );
	ok( hm( "q" ).checkValidity(), "maxlength can check valid input" );

	hm().create( "r", "r" );
	hm( "r" ).validator( "rangelength", "2,3" );
	hm( "r" ).checkValidity();
	equal( hm().get( "r*errors" )[0], hm.options.errors.rangelength.supplant( { minlength: 2, maxlength: 3 } ), "rangelength can check invalid input" );

	hm().create( "s", "sss" );
	hm( "s" ).validator( "rangelength", "2,3" );
	ok( hm( "s" ).checkValidity(), "rangelength can check valid input" );

	hm().create( "t", 99 );
	hm( "t" ).validator( "min", "100" );
	hm( "t" ).checkValidity();
	equal( hm().get( "t*errors" )[0], hm.options.errors.min.supplant( { min: 100 } ), "min can check invalid input" );

	hm().create( "u", 101 );
	hm( "u" ).validator( "min", "100" );
	ok( hm( "u" ).checkValidity(), "min can check valid input" );

	hm().create( "v", 101 );
	hm( "v" ).validator( "max", "100" );
	hm( "v" ).checkValidity();
	equal( hm().get( "v*errors" )[0], hm.options.errors.max.supplant( { max: 100 } ), "max can check invalid input" );

	hm().create( "x", 100 );
	hm( "x" ).validator( "max", "100" );
	ok( hm( "x" ).checkValidity(), "max can check valid input" );

	hm().create( "y", 99 );
	hm( "y" ).validator( "range", "100,200" );
	hm( "y" ).checkValidity();
	equal( hm().get( "y*errors" )[0], hm.options.errors.range.supplant( {min: 100, max: 200 } ), "range can check invalid input" );

	hm().create( "z", 101 );
	hm( "z" ).validator( "range", "100,200" );
	ok( hm( "z" ).checkValidity(), "range can check valid input" );

	hm.extend( {
		password: "123",
		repeatPassword: null
	} );

	hm( "repeatPassword" ).validator( "equal", "password" );
	hm.set( "repeatPassword", "abc" );
	equal( hm.get( "repeatPassword*errors" )[0], hm.options.errors.equal, "equal validator works" );
	//
	//	hm( "a" ).del();
	//	hm( "b" ).del();
	//	hm( "c" ).del();
	//	hm( "d" ).del();
	//	hm( "e" ).del();
	//	hm( "f" ).del();
	//	hm( "g" ).del();
	//	hm( "h" ).del();
	//	hm( "i" ).del();
	//	hm( "j" ).del();
	//	hm( "k" ).del();
	//	hm( "l" ).del();
	//	hm( "m" ).del();
	//	hm( "n" ).del();
	//	hm( "o" ).del();
	//	hm( "p" ).del();
	//	hm( "q" ).del();
	//	hm( "r" ).del();
	//	hm( "s" ).del();
	//	hm( "t" ).del();
	//	hm( "u" ).del();
	//	hm( "v" ).del();
	//	hm( "x" ).del();
	//	hm( "y" ).del();
	//	hm( "z" ).del();
	//	hm.del( "password" ).del( "repeatPassword" );
	hm.debug.removeAll();
	ok( hm( "*invalidPaths" ).isEmpty(), "after a model is deleted, its path is removed from *invalidPaths" );
	//have to delete manually
	//	hm().unsub();
	assertEmptyDb();
} );