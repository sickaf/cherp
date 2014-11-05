// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;
var TwitterStrategy  = require('passport-twitter').Strategy;

// load up the user model
var User       		= require('../user');

// load the auth variables
var configAuth = require('./auth');

// expose this function to our app using module.exports
module.exports = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    // =========================================================================
    // TWITTER =================================================================
    // =========================================================================
    passport.use(new TwitterStrategy({

        consumerKey     : configAuth.twitterAuth.consumerKey,
        consumerSecret  : configAuth.twitterAuth.consumerSecret,
        callbackURL     : configAuth.twitterAuth.callbackURL

    },
    function(token, tokenSecret, profile, done) {

        // make the code asynchronous
        // User.findOne won't fire until we have all our data back from Twitter
        process.nextTick(function() {

            console.log(profile);

            var newFields = {   'username' : "@"+profile.username,
                                'twitter.id' : profile.id,
                                'twitter.token' : token,
                                'twitter.username' : profile.username,
                                'twitter.displayName' : profile.displayName,
                                'avatar_url' : profile["_json"]["profile_image_url"].replace('_normal', ''),
                                'bio' : profile["_json"]["description"]
                            };

            User.findOneAndUpdate({ 'twitter.id' : profile.id }, newFields, { upsert : true }, function(err, user) {

                // if there is an error, stop everything and return that
                // ie an error connecting to the database
                if (err)
                    return done(err);

                return done(null, user);
            });
        });
    }));
};