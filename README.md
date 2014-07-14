
# Clustering Plupload Instances For Parallel File Uploads

by [Ben Nadel][bennadel] (on [Google+][googleplus])

When you drop files into an instance of [Plupload][plupload], each files is uploaded in serial
until the queue is empty. The serial nature of the uploads makes life a lot easier in some cases.
But, in other cases, the seriality is unnecessary. As such, I wanted to build a proof-of-concept
of what it might look like to "cluster" Plupload instances in order to perform parallel file 
uploads.

In this demo, I create a "master" uploader which serves as the file-selection interface. This 
master than distributes files to "hidden" instances of the Plupload service so that they may be 
uploaded in parallel. The calling context can bind to events the way that they would normally. 
Some of those events are triggered on the master; some are triggered on the individual uploaders,
where the user can perform per-file setting-augmentation the way that they normally would.

This is intended to be a proof-of-concept. There's a lot more to clean up in terms of eventing.


[bennadel]: http://www.bennadel.com
[googleplus]: https://plus.google.com/108976367067760160494?rel=author
[plupload]: http://plupload.com
