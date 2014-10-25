var express = require('express');
var path = require('path');
var router = express.Router();

var rootFilePath = path.dirname(require.main.filename)

router.get('/newuser', function(req, res) {
	res.sendfile(rootFilePath+'/public/index.html');
});

/* GET New User page. */
router.get('/newmessage', function(req, res) {
    res.sendfile(__dirname+'/public/newmessage.html');
});

/* POST to Add User Service */
router.post('/addmessagetodatabase', function(req, res) {

	//set our internal DB variable
	var db = req.db;

	var userName = req.body.username;
	var userMessage = req.body.usermessage;

	//set our collection
	var collection = db.get('messagecollection');

	//submit to the DB
	collection.insert({
		"username" : userName,
		"message" : userMessage
	}, function (err, doc) {
		if(err) {
			res.send("lol there was a problem adding data to the DB");
		}
		else {
			//res.location("/");
			//res.redirect("/");
			res.send("okay maybe that worked");
		}
	});
});

router.get('/:random', function(req, res) {
  res.send('<h1>lol what are you doing trying to get to /' + req.params.random + ' ??</h1>');
});

module.exports = router;