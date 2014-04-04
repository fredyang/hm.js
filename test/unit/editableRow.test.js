module( "shadowEdit" );

test( "create editable shadow", function() {
	var persons,
		person,
		personTemplate;

	hm.set( "persons", persons = [ person =
	                               {
		                               firstName: "John",
		                               lastName: "Doe",
		                               phones: [
			                               "123-544-9999",
			                               "322-514-1139"
		                               ],
		                               others: {
			                               addresses: [
				                               {
					                               city: "New York",
					                               country: "USA"

				                               },
				                               {
					                               city: "Toronto",
					                               country: "Canada"
				                               }
			                               ]
		                               }
	                               }
	] );

	personTemplate = hm.util.clone( person, true );
	var subscriptions = [];
	subscriptions.appendSub = function () {};

	hm("persons" ).initShadowEdit();

	deepEqual( hm.get( "persons*edit.itemTemplate" ), hm.util.clearObj( person ),
		"if there is no template for new item of an array, it will clone the first item as " +
		"template" );

	ok( hm.get( "persons*edit.itemTemplate" ) !== person,
		"if there is no template for new item of an array, it will use a clone" );

	hm.del( "persons*edit" );

	hm.set( "persons_itemTemplate", personTemplate );

	hm("persons" ).initShadowEdit();

	ok( hm.get( "persons*edit.itemTemplate" ) === personTemplate,
		"if there is a template for new item, it will be used" );

	var fakeView = {};
	hm( "persons" ).sub( fakeView, "change", "*newShadowItem" );
	$( fakeView ).change();

	ok( hm.get( "persons*edit.item" ).firstName == personTemplate.firstName,
		"*newShadowItem handler can create a copy of itemTemplate to *edit.item" );

	hm("persons*edit.item.others.addresses" ).initShadowEdit();

	equal( hm.get( "persons*edit.item.others.addresses*edit.itemTemplate.city" ),
		personTemplate.others.addresses[0].city,
		"you can also enable editable list view for the model in shadow"
	);

	var fakeView2 = {};
	hm( "persons*edit.item.others.addresses" ).sub( fakeView2, "change", "*newShadowItem" );
	$( fakeView2 ).change();

	equal( hm.get( "persons*edit.item.others.addresses*edit.item.city" ),
		personTemplate.others.addresses[0].city,
		"*newShadowItem can also copy itemTemplate for shadow items"
	);

	assertEmptyDb();
} )