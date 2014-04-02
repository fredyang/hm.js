var _gaq = _gaq || [];
_gaq.push( ['_setAccount', 'UA-38317100-1'] );
_gaq.push( ['_setDomainName', 'semanticsworks.com'] );
_gaq.push( ['_trackPageview'] );

(function() {
	var ga = document.createElement( 'script' );
	ga.type = 'text/javascript';
	ga.async = true;
	ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
	(document.getElementsByTagName( 'head' )[0] || document.getElementsByTagName( 'body' )[0]).appendChild( ga );
})();

if (!hm.loader.baseUrl()) {
	hm.loader.baseUrl( "../assets/" );
}

hm.loader.hash( true );

hm.loader.load( true,
	"prettify/prettify.css," +
	"prettify/prettify.js"
);

hm.binding( {
	preview: function( elem, path, context, options ) {

		if (!options) {
			return;
		}

		var urlView = options,
			iconClass = "",
			urlEdit, text;

		if (options.indexOf( "jsbin.com" ) !== -1) {
			urlEdit = urlView + "/edit?live,javascript,html";
			text = "Preview and edit code";
			iconClass = "jsin";
		} else if (options.indexOf( "plnkr.co" ) !== -1) {
			var reg = /\/(\w+)\/preview$/;
			//http://run.plnkr.co/plunks/H0m1N3OfC1bx6Vtph77C/
            //http://embed.plnkr.co/YhiNMQ/preview
			var id = reg.exec( options )[1];
			urlEdit = "http://plnkr.co/edit/" + id + "?p=preview";
			text = "Edit in Plunker";
			iconClass = "plnkr";
		} else {
			urlEdit = urlView;
			text = "Preview";
		}

		$( elem )
			.wrap( "<div class='preview'></div>" )
			.parent()
			.append( "<a class='preview " + iconClass +
		             "' title='click to edit code' target='_blank' href='" + urlEdit + "'>" +
		             text +
		             "</a>" +
		             "<iframe class='preview' src='" + urlView +
		             "' />" );
	},

	prettyprint: function( elem, path, context, options ) {
		$( elem ).html( prettyPrintOne( $( elem ).html() ) ).addClass( "code" );
	},

	linkOut: function( elem, path, context, options ) {
		$( elem ).find( "a" ).attr( "target", "_blank" );
	},

	plusone: function( elem, path, context, options ) {
		gapi.plusone.render( elem, {"size": "standard"} );
	}
} );

$( function() {
	var url = location.href;

	$( ".leftCol nav a" ).each( function() {
		if (this.href == url) {
			$( this ).addClass( "selected" );
			return false;
		}
	} );
} );

//overwrite the default hm.template.templateIdToUrl function
hm.template.templateIdToUrl = function( templateId ) {

	var rBeginWithApk = /^apk\.([^.]+)(\.?)(.*)$/;
	var match = rBeginWithApk.exec( templateId );

	return match ?
		//apk.hello --> applet/hello/main.html
		//apk.hello.bye --> applet/hello/bye.html
		"apk/" + match[1] + "/" + (match[3] || "main" ) + ".html" :

		//abc --> template/abc.html
		"template/" + templateId + ".html";

};