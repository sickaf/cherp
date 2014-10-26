module.exports = function(app, passport) {

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', isLoggedIn, function(req, res) {
		 res.sendfile('public/index.html');
	});

	app.get('/login', function(req, res) {
		res.sendfile('public/login.html');
	});

	// process the login form
	app.post('/login', passport.authenticate('local-login', {
		successRedirect : '/', // redirect to index
		failureRedirect : '/login', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {
		// render the page and pass in any flash data if it exists
		res.sendfile('public/signup.html');
		// res.render('signup.ejs', { message: req.flash('signupMessage') });
	});

	// process the signup form
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect : '/', // redirect to the index
		failureRedirect : '/signup', // redirect back to the signup page if there is an error
		failureFlash : true // allow flash messages
	}));

	// =====================================
	// TWITTER ROUTES ======================
	// =====================================
	// route for twitter authentication and login
	app.get('/auth/twitter', passport.authenticate('twitter'));

	// handle the callback after twitter has authenticated the user
	app.get('/auth/twitter/callback',
		passport.authenticate('twitter', {
			successRedirect : '/',
			failureRedirect : '/login'
	}));

	// =====================================
	// PROFILE SECTION =====================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	// app.get('/profile', isLoggedIn, function(req, res) {
	// 	res.sendfile(rootFilePath+'/public/profile.html');
	// 	// res.render('profile.ejs', {
	// 	// 	user : req.user // get the user out of session and pass to template
	// 	// });
	// });

	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.logout();
		res.redirect('/login');
	});

	/* GET New User page. */
	app.get('/newmessage', function(req, res) {
	    res.sendfile('public/newmessage.html');
	});

	/* POST to Add User Service */
	app.post('/addmessagetodatabase', function(req, res) {

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
}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on 
	// if (req.user) {
		return next();
	// }

	// if they aren't redirect them to the login
	res.redirect('/login');
}