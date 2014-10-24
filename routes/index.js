var express = require('express');
var router = express.Router();


// router.get('/', function(req, res) {
//   res.sendFile(__dirname + '/public/index.html');
// });

/* GET New User page. */
router.get('/newmessage', function(req, res) {
    res.sendfile(__dirname+'/public/newmessage.html');
});

/* POST to Add User Service */
router.post('/addmessagetodatabase', function(req, res) {

	//set our internal DB variable
	var db = req.db;

	//get our form values, that depend on the "name" attributes

	// var $usernameInput = $('.usernameInput'); // Input for username

	var userName = req.body.username;
	// var userName = "devontestloser";

	var userMessage = req.body.usermessage;
	// var userMessage = "devontestmessage2";

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
			res.send("okay maybe that worked:\n "+JSON.stringify(req.body, undefined, 2) + " username: "+req.body.username);
		}
	});
});

router.get('/:random', function(req, res) {
  res.send('<h1>lol what are you doing trying to get to /' + req.params.random + ' ??</h1>');
});

module.exports = router;