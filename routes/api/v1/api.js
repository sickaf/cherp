var formidable = require('formidable');
var fs = require('fs-extra');
var util = require('util');
var User = require('../../../user');
var RoomModel = require('../../../roommodel'); 

// API

module.exports = function(app) {

	// User API Methods

	// Profiles

	app.get('/api/v1/profile/:userid', function (req, res){
	  User.findOne({'_id' : req.params.userid}, function(err, docs) {
			res.send(docs);
		}); 
	});

	// Show the upload form	
	app.get('/profile/:userid/uploadnewimage', function (req, res){
	  res.writeHead(200, {'Content-Type': 'text/html' });
	  /* Display the file upload form. */
	  var form = '<form action="/api/v1/profile/' + req.params.userid + '/avatar" enctype="multipart/form-data" method="post"><input name="title" type="text" /><input multiple="multiple" name="upload" type="file" /><input type="submit" value="Upload" /></form>';
	  res.end(form); 
	});

	app.post('/api/v1/profile/:userid/avatar', function (req, res) {

	  var form = new formidable.IncomingForm();
	  form.parse(req, function(err, fields, files) {
	  	if (err) {
	  		console.log('error parsing file upload');
	  		handleError(err, res);
	  		return;
	  	}
	  });

	  form.on('end', function(fields, files) {
	    /* Temporary location of our uploaded file */
	    var temp_path = this.openedFiles[0].path;
	    /* The file name of the uploaded file */
	    var file_name = this.openedFiles[0].name;
	    /* Location where we want to copy the uploaded file */
	    var new_location = 'uploads/';
	    // create new url
	    var new_url = new_location + req.params.userid + '.' + file_name.split('.').pop();

	    fs.copy(temp_path, new_url, function(err) {  
	      if (err) {
	      	console.log('error copying file to new path');
	        handleError(err, res);
	      } else {

	      	// setup query to find the correct user
	      	var query = { '_id': req.params.userid };
	      	User.update(query, { 'avatar_url': new_url }, {}, function (err, numberAffected, raw) {
  				if (err) {
  					console.log('error updating users avatar url');
  					handleError(err, res);
  					return;
  				}

  				console.log('The number of updated documents was %d', numberAffected);
  				console.log("users avatar successfully updated!");

	        	res.writeHead(200, {'content-type': 'text/plain'});
	    		res.write('profile pic updated');
	   			res.end();
			});
	      }
	    });
	  });
	});

	// Archives API Methods

	// Get archives for a specific user
	app.get('/api/v1/profile/archives/:userid', function(req, res) {
		var q = RoomModel.find({ ownerId: req.params.userid }).sort({'created_at': -1}).limit(10);
		q.exec(function (err, docs) {
			res.send(docs);
		});
	});

	// Get a specific archive
	app.get('/api/v1/archives/:id', function(req, res) {
		RoomModel.findOne({'id' : req.params.id}, function(err, docs) {
			res.send(docs);
		});
	});

	// Delete a specific archive
	app.delete('/api/v1/archives/:id', function(req, res) {
		RoomModel.remove({'id' : req.params.id}, function(err, docs) {
			res.send(err);
		});
	});
}

function handleError (err, res) {
	res.status(404);
	res.end(err);
}