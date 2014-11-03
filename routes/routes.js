var User = require('../user');

module.exports = function(app, passport) {

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		if (req.user) {
			console.log('logged in user found in session');
			req.user.wantsToJoin = req.flash('wantsToJoin');
			res.render('index', { user : req.user });
		} else {
			console.log('no user found, creating anon user and saving to session');
			var user = new User();
      		user.username = randomUsername();
      		user.wantsToJoin = req.flash('wantsToJoin');
      		res.render('index', { user : user });
        }
	});


	app.get('/login', function(req, res) {
		res.render('login', { message: req.flash('loginMessage') });
	});


	// =====================================
	// LOGOUT ==============================
	// =====================================
	app.get('/logout', function(req, res) {
		req.flash('loginMessage', 'Logged out');
		req.session.destroy();
		req.logout();
  		res.redirect('/login');
	});



	// =====================================
	// SIGNUP ==============================
	// =====================================
	// show the signup form
	app.get('/signup', function(req, res) {
		// render the page and pass in any flash data if it exists
		res.render('signup', { message: req.flash('signupMessage') });
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
	app.get('/profile', isLoggedIn, function(req, res) {
		res.render('profile', {
			user : req.user // get the user out of session and pass to template
		});
	});

	app.get('/:ownerName', function(req, res) {
		if (req.user) {
			console.log('logged in user found in session');
			req.user.wantsToJoin = req.params.ownerName;
			res.render('index', { user : req.user });
		} else {
			console.log('no user found, creating anon user and saving to session');
			var user = new User();
      		user.username = randomUsername();
      		user.wantsToJoin = req.params.ownerName;
      		res.render('index', { user : user });
        }
		// req.flash('wantsToJoin', req.params.ownerName);
		// res.redirect('/');
	});

}

// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {

	// if user is authenticated in the session, carry on 
	if (req.user) {
		return next();
	}

	// if they aren't redirect them to the login
	res.redirect('/login');
}

function randomUsername() {
	var nouns = ['fart','weed','420','snowboard','longboarding','blaze','pussy'];
	var descriptors = ['fan','dude','man','doctor','expert','thug'];
	var numbers = ['420','69'];
    var noun = nouns[Math.floor(Math.random() * nouns.length)];
    var descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];
    var number = numbers[Math.floor(Math.random() * numbers.length)];
    return noun+descriptor+numbers;
}