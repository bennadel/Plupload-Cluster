
app.factory(
	"PluploadCluster",
	function( plupload, mOxie ) {

		// I contain the auto-incrementer for each uploader instance.
		var clusterUploaderInstanceID = 0;

		// I contain the DOM element into which each uploader instance will be injected.
		var clusterContainer = getClusterContainer();


		// In order to be instantiated, each plupload instance needs to reference an 
		// actual element. As such, we need to create a throw-away, hidden element for 
		// each uploader.
		function buildUploaderElement() {

			var id = ( "pluploadClusterUploaderInstance-" + ++clusterUploaderInstanceID );

			var element = angular.element( "<div></div>" )
				.attr( "id", id )
				.addClass( "pluploadClusterUploaderInstance" )
				.css({
					height: "1px",
					left: "0px",
					position: "absolute",
					top: "0px",
					width: "1px"
				})
				.appendTo( clusterContainer )
			;

			return( id )

		}


		// I remove the throw-away uploader element with the given ID.
		function destroyUploaderElement( id ) {

			clusterContainer.find( "#" + id )
				.remove()
			;

		}


		// The Plupload instance need to be on the page in some sort of DOM. This is
		// really a dirty move, touching the DOM inside this service; but, it is a 
		// service that interactions with the 
		function getClusterContainer() {

			var container = angular.element( "<div></div>" )
				.addClass( "pluploadClusterContainer" )
				.css({
					height: "1px",
					left: "-100px",
					overflow: "hidden",
					position: "fixed",
					top: "-100px", 
					width: "1px"
				})
				.appendTo( "head" )
			;

			return( container );

		}
	

		// -------------------------------------------------- //
		// -------------------------------------------------- //


		// I cluster a number of Plupload instances so that files can be uploaded in 
		// parallel. There is a master instance that acts as the user interface for
		// the uploader; but, this does nothing but hand off files to the various 
		// instances in the cluster.
		function PluploadCluster( clusterSize, settings ) {

			// As files are added to the cluster, they will be distributed to the 
			// clustered uplaoders using a simplistic round-robin approach. For now,
			// we're not going to worry about whether or not the given upload is 
			// available - perhaps in another demo.
			var roundRobinIndex = 0;

			// The master uploader is the point-of-contact with the user. When the user
			// selects files or drops files, the will be dropped into the master uploader.
			// The master uploader will then distribute the selected files to the cluster
			// of upload instances.
			var master = new plupload.Uploader( settings );

			// When the files are added to the master, we are going to pipe them into a 
			// "FilesSelected" event that can provide a pre-uploader hook for the calling
			// context.
			master.bind( "FilesAdded", handleMasterFilesAdded );

			// I hold the collection of uploaders in the cluster.
			var uploaders = [];

			// Create each instance.
			for ( var i = 0 ; i < clusterSize ; i++ ) {

				var instanceID = buildUploaderElement();

				// Ensure there are mulitpart params - makes life easier when performing
				// just-in-time updates to the settings during queue processing.
				var uploader = new plupload.Uploader( 
					mOxie.extend(
						{},
						{
							multipart_params: {}
						},
						settings,
						{
							pluploadClusterElementID: instanceID,
							browse_button: instanceID,
							drop_element: null
						}
					)
				);

				// We need to bind to the individual uploader events in order to keep the
				// aggregate queue up to date.
				uploader.bind( "FilesAdded", handleUploaderFilesAdded );
				uploader.bind( "UploadProgress", handleUploaderUploadProgress );
				uploader.bind( "FileUploaded", handleUploaderFileUploaded );
				uploader.bind( "FilesRemoved", handleUploaderFilesRemoved );

				uploaders.push( uploader );

			}

			// I contain the aggregated list of files being uploaded.
			// --
			// NOTE: This is being made public; so, we can't overwrite the reference to 
			// it - we can only splice into it.
			var queue = new PluploadClusterQueue();


			// Return the public API.
			return({
				addFile: addFile,
				bind: bind,
				destroy: destroy,
				init: init,
				isNotUploading: isNotUploading,
				isUploading: isUploading,
				queue: queue,
				refresh: refresh,
				removeFile: removeFile,
				start: start
			});


			// ---
			// PUBLIC METHODS.
			// ---


			// I add a new file to the cluster. This can be consumed by external 
			// instances of FileDrop or FileInput.
			function addFile( file ) {

				// When we add it to the master, the master will take care of 
				// distributing it to the next targeted uploader.
				master.addFile( files );
			
			}


			// I bind to events on the individual uploaders in the cluster.
			function bind( eventType, callback ) {

				// Some events will only be bound to the master of the cluster.
				if ( 
					( eventType === "Init" ) || 
					( eventType === "PostInit" ) ||
					( eventType === "FilesSelected" )
					) {

					return( master.bind( eventType, callback ) );

				}

				// If we made it this far, we want to bind the given event handler to 
				// all uploader instances in the cluster.
				applyToUploaders( "bind", arguments );

			}


			// I destroy the cluster of uploaders.
			function destroy() {

				master.destroy();

				// As we loop over the uploader instances, we have to remove each of the
				// throw-away elements that was used to instantantiate the uploader.
				for ( var i = 0 ; i < clusterSize ; i++ ) {

					var uploader = uploaders[ i ];
					var elementID = uploader.settings.pluploadClusterElementID;

					uploader.destroy();
					destroyUploaderElement( elementID );

				}

			}


			// I initialize the cluster. 
			function init() {
				
				// Initialize the master uploader.
				master.init();

				// Initialize each of the uploaders in the cluster.
				for ( var i = 0 ; i < clusterSize ; i++ ) {

					var uploader = uploaders[ i ];

					uploader.init();

					// This step isn't really necessary; but, since these uploaders 
					// aren't actually "exposed" on the browser, we can disable the file
					// input shims.
					uploader.disableBrowse();
					
				}

			}


			// I determine if the cluster (or proivded uploader) is currently inactive. 
			// If no uploader is provided, checks to see if ALL uploaders are currently 
			// stopped.
			function isNotUploading( uploader ) {

				// If an uploader was provided, check only the given uploader.
				if ( uploader ) {

					return( uploader.state === plupload.STOPPED );
					
				}

				// If no uploader was provided, then the cluster is considered stopped if 
				// ALL of the uploaders have stopped.
				return( ! isUploading() );

			}


			// I determine if the cluster (or proivded uploader) is currently uploading
			// a file. If no uploader is provided, checks to see if ANY uploader is 
			// actively uploading a file.
			function isUploading( uploader ) {

				// If an uploader was provided, check only the given uploader.
				if ( uploader ) {

					return( uploader.state === plupload.STARTED );
					
				}

				// If no uploader was provided, then check to see if ANY uploaders are
				// currently uploading.
				for ( var i = 0 ; i < clusterSize ; i++ ) {

					if ( uploaders[ i ].state === plupload.STARTED ) {

						return( true );

					}

				}

				// If we made it this far, none of the uploaders are uploading.
				return( false );

			}


			// I refresh the shim used by the master uploader.
			function refresh() {
				
				master.refresh();

				// NOTE: Since the master is the only instance in the entire cluster that
				// the user has access to (visually), we don't have to refresh any of the 
				// other worker instances.

			}


			// I remove the given file from the cluster.
			function removeFile( file ) {

				// Try to remove from each uploader - there are no negative consequences 
				// from calling removeFile() if there is no matching file.
				applyToUploaders( "removeFile", arguments );

			}


			// I start the uploading process for all uploaders in the cluster.
			function start() {

				applyToUploaders( "start" );

			}


			// ---
			// PRIVATE METHODS.
			// ---


			// I invoke the given method with the given arguments on all uploaders.
			function applyToUploaders( methodName, methodArguments ) {

				for ( var i = 0 ; i < clusterSize ; i++ ) {

					var uploader = uploaders[ i ];

					uploader[ methodName ].apply( uploader, ( methodArguments || [] ) );

				}

			}


			// I handle the selection of files in the master instance. This raises the 
			// "FilesSelected" event which allows the calling context to change the 
			// collection before the master starts to distribute them.
			function handleMasterFilesAdded( master, files ) {

				// The files that have been passed to this event are already bound the 
				// master uploader. As such, we want to recreate the collection with 
				// unbound mOxie file instances.
				var selectedFiles = [];

				for ( var i = 0 ; i < files.length ; i++ ) {

					// Create a new mOxie file - it won't have a UUID since it's not 
					// bound to any uploader yet.
					selectedFiles.push( 
						new mOxie.File( null, files[ i ].getSource().getSource() )
					);

				}

				// Now that we've rebuilt the file collection, remove them all from the 
				// master uploader.
				master.splice();

				// Announce the selected-files event. This gives the calling context the
				// chance to alter the selected files.
				master.trigger( "FilesSelected", selectedFiles );

				// Distribute the selected files to the cluster.
				for ( var i = 0 ; i < selectedFiles.length ; i++ ) {

					uploaders[ roundRobinIndex++ % clusterSize ].addFile( selectedFiles[ i ] );

				}

			}


			// When files are removed from the given uploader, I remove them from the 
			// cluster queue.
			function handleUploaderFilesRemoved( uploader, files ) {

				for ( var i = 0 ; i < files.length ; i++ ) {

					queue.removeFile( files[ i ] );

				}

			}


			// When files are added to the given uploader, I add them to the cluster
			// queue.
			function handleUploaderFilesAdded( uploader, files ) {

				for ( var i = 0 ; i < files.length ; i++ ) {

					queue.addFile( files[ i ] );

				}

			}


			// When a file has been uploaded, I update the file in the cluster queue.
			function handleUploaderFileUploaded( uploader, file ) {

				queue.updateFile( file );

			}


			// When a file has made progress, I update the file in the clsuter queue.
			function handleUploaderUploadProgress( uploader, file ) {

				queue.updateFile( file );

			}

		}


		// -------------------------------------------------- //
		// -------------------------------------------------- //


		// I mainain an aggregate queue of all the files in the cluster, across the 
		// individual queues of each uploader.
		function PluploadClusterQueue() {

			var queue = [];

			// Set public methods on queue.
			queue.addFile = addFile;
			queue.removeFile = removeFile;
			queue.updateFile = updateFile;

			// Return the queue reference.
			return( queue);


			// ---
			// PUBLIC METHODS.
			// ---


			// I add the given file to the queue.
			function addFile( file ) {

				var item = {
					id: file.id,
					name: file.name,
					size: file.size,
					loaded: file.loaded,
					percent: file.percent.toFixed( 0 ),
					status: file.status,
					isUploading: ( file.status === plupload.UPLOADING )
				};

				queue.push( item );

			}


			// I remove the given file from the queue.
			function removeFile( file ) {

				for ( var i = 0 ; i < queue.length ; i++ ) {

					if ( queue[ i ].id === file.id ) {

						return( queue.splice( i, 1 ) );

					}

				}

			}


			// I update the given file in the queue.
			function updateFile( file ) {

				for ( var i = 0 ; i < queue.length ; i++ ) {

					var item = queue[ i ];

					if ( item.id === file.id ) {

						item.loaded = file.loaded;
						item.percent = file.percent.toFixed( 0 );
						item.status = file.status;
						item.isUploading = ( file.status === plupload.UPLOADING );

						return;

					}

				}

			}

		}


		// -------------------------------------------------- //
		// -------------------------------------------------- //


		// Return factory value.
		return( PluploadCluster );

	}
);