// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');


// define the schema for our user model
var roomSchema = mongoose.Schema({
	ownerName: String,
	hosts: Array,
    name: String,
    id : String,
    hostMessages : Array,
    total_fans : Number,
    created_at    : { type: Date },
  	updated_at    : { type: Date }
});

roomSchema.pre('save', function(next){
  now = new Date();
  this.updated_at = now;
  if ( !this.created_at ) {
    this.created_at = now;
  }
  next();
});


// create the model for users and expose it to our app
module.exports = mongoose.model('Rooms', roomSchema);
