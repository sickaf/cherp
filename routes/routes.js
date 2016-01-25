var User = require('../model/user');

module.exports = function(app, passport) {

	// =====================================
	// HOME PAGE (with login links) ========
	// =====================================
	app.get('/', function(req, res) {
		if (req.user) {
			console.log('logged in user found in session');
			req.user.wantsToJoin = req.flash('wantsToJoin');
			res.render('index', { user : req.user });
		}
		else {
			console.log('no user found, creating anon user and saving to session');
			var user = new User();
      // user.wantsToJoin = req.flash('wantsToJoin'); //TODO: CODY uncomment and debug this
      res.render('index', { user : user });
    }
	});

	// =====================================
	// LOGIN ==============================
	// =====================================
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
  		res.redirect('/');
	});

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

	// Routing for specific user chat room
	app.get('/:ownerName', function(req, res) {
		if (req.user) {
			console.log('logged in user found in session');
			req.user.wantsToJoin = req.params.ownerName;
			res.render('index', { user : req.user });
		}
		else {
			console.log('no user found, creating anon user and saving to session');
			var user = new User();
      user.wantsToJoin = req.params.ownerName;
      res.render('index', { user : user });
    }
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
