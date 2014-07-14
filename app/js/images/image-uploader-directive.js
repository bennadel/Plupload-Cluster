
app.directive(
	"bnImageUploader",
	function( $window, $rootScope, PluploadCluster, naturalSort ) {

		// I bind the JavaScript events to the scope.
		function link( $scope, element, attributes ) {

			// The uploader has to refernece the various elements using IDs. Rather than
			// crudding up the HTML, just insert the values dynamically here.
			element
				.attr( "id", "primaryUploaderContainer" )
				.find( "div.dropzone" )
					.attr( "id", "primaryUploaderDropzone" )
			;


			// Instantiate the Plupload cluster. The cluster works by creating a master
			// runtime and N-uploader instance runtimes. The Master never actually 
			// uploads - it just creates the UI that the user interacts with; it then
			// distributes the files across the cluster. As it does this, events are 
			// triggered on each uploader, where you can interact with each uploader the
			// way that you would have normally with a single-uploader approach.
			var cluster = new PluploadCluster( 
				// Number of parellel instances. This is going to be limited by the 
				// number of concurrent HTTP requests that the browser can make.
				5,
				// Individual uploader settings.
				{
					// For this demo, we're only going to use the html5 runtime. I 
					// don't want to have to deal with people who require flash - not
					// this time, I'm tired of it; plus, much of the point of this demo 
					// is to work with the drag-n-drop, which isn't available in Flash.
					runtimes: "html5",

					// Upload the image to the API.
					url: "api/index.cfm?action=upload",

					// Set the name of file field (that contains the upload).
					file_data_name: "file",

					// The container, into which to inject the Input shim.
					container: "primaryUploaderContainer",

					// The ID of the drop-zone element.
					drop_element: "primaryUploaderDropzone",

					// To enable click-to-select-files, you can provide a browse button. 
					// We can use the same one as the drop zone.
					browse_button: "primaryUploaderDropzone"
				}
			);


			// Initialize the plupload runtime.
			cluster.bind( "Error", handleError );
			cluster.bind( "PostInit", handleInit );
			cluster.bind( "FilesSelected", handleFilesSelected );
			cluster.bind( "QueueChanged", handleQueueChanged );
			cluster.bind( "BeforeUpload", handleBeforeUpload );
			cluster.bind( "UploadProgress", handleUploadProgress );
			cluster.bind( "FileUploaded", handleFileUploaded );
			cluster.bind( "StateChanged", handleStateChanged );
			cluster.init();

			// I provide access to the aggregate file list, across the cluster, for use
			// inside of the directive. This can be used to render the items being 
			// uploaded.
			$scope.queue = cluster.queue;

			// Wrap the window instance so we can get easy event binding.
			var win = $( $window );

			// When the window is resized, we'll have to update the dimensions of the 
			// input shim.
			win.on( "resize", handleWindowResize );

			// When the scope is destroyed, clean up bindings.
			$scope.$on(
				"$destroy",
				function() {

					win.off( "resize", handleWindowResize );
					
					cluster.destroy();

				}
			);
				

			// ---
			// PRIVATE METHODS.
			// ---


			// I handle the before upload event where the meta data can be edited right
			// before the upload of a specific file, allowing for per-file settings.
			function handleBeforeUpload( uploader, file ) {

				var params = uploader.settings.multipart_params;
				var source = file.getSource();

				// Delete any previous reference to sort.
				delete( params.sort );

				// If the dropped/selected file has a sort option, then send it through.
				if ( "sort" in source ) {

					params.sort = source.sort;

				}

			}


			// I handle errors that occur during intialization or general operation of
			// the Plupload instance.
			function handleError( uploader, error ) {

				console.warn( "Plupload error" );
				console.error( error );

			}


			// I handle the files-selected event. This is when the files have been 
			// selected for the cluster, but have not yet been added to any of the 
			// uploaders in the cluster. At this point, we have the ability to alter the
			// collection of files before they are distributed.
			function handleFilesSelected( master, files ) {

				naturalSort( files, "name" );

				// For this demo, we want to make sure that file properties added in the
				// FileSelected event can be accessed later on in the BeforeUpload 
				// event; this will be after the master has distributed the file to each
				// uploader in the cluster.
				for ( var i = 0 ; i < files.length ; i++ ) {

					files[ i ].sort = i;

				}

				// After the files have been selected, they will be distributed and the
				// cluter queue will be updated. Trigger a digest asynchronously so we 
				// can render the queue.
				$scope.$evalAsync();
				
			}


			// I handle the file-uploaded event. At this point, the image has been 
			// uploaded and thumbnailed - we can now load that image in our uploads list.
			function handleFileUploaded( uploader, file, response ) {

				$scope.$apply(
					function() {

						// Broudcast the response from the server.
						$rootScope.$broadcast( 
							"imageUploaded", 
							angular.fromJson( response.response )
						);

						// Remove the file from the uploader queue.
						uploader.removeFile( file );
						
					}
				);

			}


			// I handle the init event. At this point, we will know which runtime has 
			// loaded, and whether or not drag-drop functionality is supported. This 
			// event only gets bound to the Master since it seems that anything that 
			// fails / succeeds for the master will do the same for the enture cluster.
			function handleInit( master, params ) {

				console.log( "Initialization complete." );
				console.log( "Drag-drop supported:", !! master.features.dragdrop );

			}


			// I handle the queue changed event - this is the queue of the given uploader,
			// NOT on the cluster. However, when this changes, the master queue will be 
			// changed already. When the queue changes, it gives us an opportunity to 
			// programmatically start the upload process.
			function handleQueueChanged( uploader ) {

				if ( uploader.files.length ){

					uploader.start();

				}

				// So we can re-render the queue.
				$scope.$evalAsync();

			}


			// I handle the change in state of the uploader.
			function handleStateChanged( uploader ) {

				// If the cluster, as a whole, is uploading, indicate the activity.
				if ( cluster.isUploading() ) {

					element.addClass( "uploading" );

				} else {

					element.removeClass( "uploading" );

				}

			}


			// I get called when upload progress is made on the given file.
			// --
			// CAUTION: This may get called one more time after the file has actually
			// been fully uploaded AND the uploaded event has already been called.
			function handleUploadProgress( uploader, file ) {

				$scope.$digest();

			}


			// I handle the resizing of the browser window, which causes a resizing of 
			// the input-shim used by the master uploader.
			function handleWindowResize( event ) {

				cluster.refresh();

			}

		}


		// Return the directive configuration. We need to create a scope for this 
		// directive so that it can expose the file queue without altering the parent
		// scope.
		return({
			link: link,
			restrict: "A",
			scope: true
		});

	}
);
