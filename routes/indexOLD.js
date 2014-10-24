var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

/* GET Hello World page. */
router.get('/helloworld', function(req, res) {
    res.render('helloworld', { 
    	title: 'Hello, loser!' 
    });
});

/* GET Userlist page. */
router.get('/userlist', function(req, res) {
    var db = req.db;
    var collection = db.get('usercollection');
    collection.find({},{},function(e,docs){
        res.render('userlist', {
            "userlist" : docs
        });
    });
});

/* GET New User page. */
router.get('/newuser', function(req, res) {
    res.render('newuser', { title: 'Add New User' });
});

/* POST to Add User Service */
router.post('/adduser', function(req, res) {

	//set our internal DB variable
	var db = req.db;

	//get our form values, that depend on the "name" attributes
	var userName = req.body.username;
	var userEmail = req.body.useremail;

	//set our collection
	var collection = db.get('usercollection');

	//submit to the DB
	collection.insert({
		"username" : userName,
		"email" : userEmail
	}, function (err, doc) {
		if(err) {
			res.send("lol there was a problem adding data to the DB");
		}
		else {
			res.location("userlist");
			res.redirect("userlist");
		}
	});
});


module.exports = router;
