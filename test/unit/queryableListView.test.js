module( "queryable" );

test( "can create queryable shadow", function() {
	hm.set( "contacts", [
		{
			firstName: "Tom",
			lastLang: "Cruise"
		}
	] );

	var $list = $( "<div data-sub='ns:contacts;queryable:.'></div>" ).appendTo( testArea() );
	$list.parseSubs();

	ok( hm.get( "contacts*query" ), "queryable subscription group will create the queryable support" );
	ok( hm.get( "contacts*queryResult" ).length, "queryable will create the queryResult" );

	hm.del( "contacts" );
	assertEmptyDb();
} )
