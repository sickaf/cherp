// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');



// define the schema for our user model
var roomSchema = mongoose.Schema({
    name: String,
    id : String,
    hostMessages : Array
});




// create the model for users and expose it to our app
module.exports = mongoose.model('Room', roomSchema);