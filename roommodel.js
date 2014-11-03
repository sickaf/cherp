// load the things we need
var mongoose = require('mongoose');
var bcrypt   = require('bcrypt-nodejs');

// this.name = name;
//   this.id = id;
//   this.owner = owner;
//   this.hosts = [];
//   this.hostMessages = [];
//   this.fans = [];
//   this.fanLimit = 4;
//   this.peopleNum = 0;
//   this.status = "available";
//   this.private = false;
//   this.addHost(owner);


// define the schema for our user model
var roomSchema = mongoose.Schema({
	owner: String,
	hosts: Array,
    name: String,
    id : String,
    hostMessages : Array
});

// methods ======================
// generating a hash
// userSchema.methods.generateHash = function(password) {
//     return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
// };


// create the model for users and expose it to our app
module.exports = mongoose.model('Room', roomSchema);