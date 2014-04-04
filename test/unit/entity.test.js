module( "entity" );

var Person = hm.Entity.extend( null, {
	url: "http://localhost:3002/people"
} );

asyncTest( "fetch list and create entity", function() {

	var newPerson = Person( { firstName: "fred"} );
	newPerson.create().done( function( data ) {
		ok( newPerson.id !== undefined & newPerson.firstName == "fred", "instance.create works" );
		start();

		var persons;
		Person.fetch().done( function( persons ) {

			ok( persons.length, "Entity.fetch works" );
			equal(persons[0].__state, Person.state.unchanged,
				"when list is fetch its initial state is unchanged");

			start();
		} );
	} );

	expect( 3 );
} );

asyncTest( "fetch single entity", function() {

	var newPerson = Person( { firstName: "fred"} );
	newPerson.create().done( function( data ) {
		ok( newPerson.id !== undefined & newPerson.firstName == "fred", "instance.create works" );
		start();
		var p = Person( {id: newPerson.id} );
		p.fetch().done( function( data ) {
			ok( p.firstName !== undefined, "instance.fetch works" );
			start();
		} );
	} );

	expect( 2 );
} );

asyncTest( "delete single entity", function() {

	var newPerson = Person( { firstName: "fred"} );
	newPerson.create().done( function( data ) {
		ok( newPerson.id !== undefined & newPerson.firstName == "fred", "instance.create works" );
		start();

		var deletePerson = Person( { id: newPerson.id } );
		deletePerson.destroy().done( function() {
			ok( true, "delete is done" );
			start();
		} );
	} );

	expect( 2 );
} );

asyncTest( "update single entity", function() {

	var newPerson = Person( { firstName: "fred"} );
	newPerson.create().done( function( data ) {
		ok( newPerson.id !== undefined & newPerson.firstName == "fred", "instance.create works" );
		start();
		newPerson.firstName = "jeff";
		newPerson.update().done( function( x ) {
			ok( true, "update is done" );
			start();
		} );
	} );

	expect( 2 );
} );

asyncTest( "create entity using node", function() {

	var people = hm( "people", [] );
	var person = Person( {
		firstName: "John",
		lastName: "Doe"
	} );
	equal( person.__state, hm.Entity.state.detached,
		"by default entity state is empty" );

	people.push( person );

	equal( person.__state, hm.Entity.state.added,
		"after person is added to repository, it became added" );

	people.cd( 0 ).save().done( function() {
		ok( person.id !== undefined, "can create entity using node." );

		equal( person.__state, hm.Entity.state.unchanged,
			"after person is saved to server, it became unchanged" );

		people.del( 0 );

		var person2 = Person( {id: person.id} );
		people.push(person2);

		people.cd( 0 ).fetch().done( function() {

			equal(person2.firstName, "John", "we can use id to fetch entity using node method");

			equal( person2.__state, hm.Entity.state.unchanged,
						"after person is saved to server, it became unchanged" );

			people.cd( 0 ).set( "firstName", "Jane" );

			equal( person2.__state, hm.Entity.state.modified,
				"when entity is unchanged, change using node.set will" +
				"make it to be modified" );

			start();

			people.cd( 0 ).save().done( function() {

				equal( person.__state, hm.Entity.state.unchanged,
					"after a model is updated, calling it sync will update it," +
					"after that it will be unchanged again." );

				start();

				people.cd( 0 ).destroy().done( function() {
					ok( people.get( 0 ) === undefined, "after mark for deleted, and after sync" +
					                                   "is called, it will be deleted from server" +
					                                   " and at client as well" );

					start();

					assertEmptyDb();

				} );
			} );

		} );

	} );

} );

