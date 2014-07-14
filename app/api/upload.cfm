<cfscript>
	
	// Require the form fields.
	param name="form.file" type="string";
	param name="form.sort" type="numeric" default="-1";

	// Save the actual binary.
	upload = fileUpload(
		expandPath( "/uploads/" ),
		"file",
		"",
		"makeUnique"
	);

	// Since we are now uploading files in parallel, it's important that we lock access
	// to the repository so we don't mix up our file references.
	lock 
		name = "addImage"
		type = "exclusive"
		timeout = 5
		{

		// Add to the collection - this will assign a unique ID to the image "record".
		imageID = application.images.addImage( 
			upload.clientFile, 
			upload.serverFile,
			form.sort
		);
		
	} // END: Lock.

	// Get the full image record.
	image = application.images.getImage( imageID );

	// Prepare API response.
	response.data = {
		"id" = image.id,
		"clientFile" = image.clientFile,
		"serverFile" = image.serverFile,
		"sort" = image.sort,
		"url" = "#application.baseImageUrl##urlEncodedFormat( image.serverFile )#"
	};

	// Add some delay so we can see the parallel file uploads.
	sleep( 250 );

</cfscript>