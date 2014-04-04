module( "Class" );

test( "test", function() {

	var proto, static;

	var Person = hm.Class.extend( proto = {

		initialize: function( firstName, lastName ) {
			if (typeof firstName == "string") {
				this.firstName = firstName;
				this.lastName = lastName;
			} else {
				this.callBase( "initialize", firstName );
			}
		},

		toString: function() {
			return this.constructor.format( this );
		}

	}, static = {

		format: function( person ) {
			return person.firstName + "," + person.lastName;
		}

	} );

	var p1 = new Person( "x", "y" );
	ok( p1.firstName == "x" && p1.lastName == "y", "initialize method is called" );
	ok( proto.toString == p1.toString, "proto member is inherted" );

	var p2 = new Person( {firstName: "x", lastName: "y"} );
	ok( p2.firstName == "x" && p2.lastName == "y", "callBase method works" );

	equal( p1.toString(), "x,y", "this.constructor works fine, and the static method works fine" );

	var persons = Person.list( [
		["firstName1", "lastName1"],
		["firstName2", "lastName2"]
	] );

	ok( persons.length == 2 && persons[0].firstName == "firstName1" && persons[1].firstName == "firstName2", "static method list works" );

} );