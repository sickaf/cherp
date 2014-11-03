// load the things we need
var _ = require('underscore')._; //tool for doing things like calling .size on an array

function Room(id, owner, name) {
  this.name = name;
  this.id = id;
  this.hosts = [];
  this.fans = [];
  this.fanLimit = 4;
  this.peopleNum = 0;
  this.status = "available";
  this.private = false;
  this.addOwner(owner);
};

Room.prototype.addFan = function(fan) {
  //dont add anyone if this user already exists
  if(this.getUser(fan.id)) return null;
  this.fans.push(fan);
  this.peopleNum++;
};

Room.prototype.killRoom = function() {
  console.log("kill room called.  there were "+this.peopleNum+" people in the room. "+this.hosts.length+" hosts and "+this.fans.length+" fans");

  for(var i = 0; i < this.fans.length; i++){
    this.removeFan(this.fans[0].id);
  }
  for(var i = 0; i < this.hosts.length; i++){
    this.removeHost(this.hosts[0].id); //one of the hosts is the owner and they'll get removed when this gets called
  }
  this.removeOwner();
  this.status = "archived";
  console.log("kill room called.  there are now "+this.peopleNum+" people in the room.");
};

Room.prototype.removeFan = function(personId) {
  var fanIndex = -1;
  for(var i = 0; i < this.fans.length; i++){
    if(this.fans[i].id === personId){
      var fan = this.fans[i];
      this.fans.splice(i,1);
      this.peopleNum--;
      return;
    }
  }
};

Room.prototype.getFan = function(personID) {
  var fan = null;
  for(var i = 0; i < this.fans.length; i++) {
    if(this.fans[i].id === personID) {
      fan = this.fans[i];
      break;
    }
  }
  return fan;
};

Room.prototype.isOwner = function(userId) {
  if(this.owner.id == userId) return true;
  return false;
}

Room.prototype.addHost = function(host) {
  if(this.getUser(host.id)) return;
  this.hosts.push(host);
  this.peopleNum++;
};

Room.prototype.addOwner = function(owner) {
  if(this.owner) {
    console.error("TRIED TO ADD OWNER ("+owner.username+") BUT OWNER ALREADY EXISTS ("+this.owner.username+")");
    return false;
  }
  this.owner = owner;
  this.peopleNum++;
};

Room.prototype.removeHost = function(personId) {

  for(var i = 0; i < this.hosts.length; i++){
    if(this.hosts[i].id === personId){
      var hostToRemove = this.hosts[i];
      this.hosts.splice(i,1);
      if(personId == this.owner.id) {
        this.removeOwner();
        return;
      }
      this.peopleNum--;
      return;
    }
  }
};

Room.prototype.removeOwner = function() {
  this.owner = null;
  this.peopleNum--;
  console.log("removing owner from room. peopleNum will be "+this.peopleNum);
};

Room.prototype.getUser = function(userId) {
  var toRet = this.getFan(userId);
  if(toRet) return toRet;

  toRet = this.getHost(userId);
  if(toRet) return toRet;

  if(this.owner.id == userId) return this.owner;

  return null;
}

Room.prototype.removeUser = function(userId) {
  if(this.getFan(userId)) {
    this.removeFan(userId);
  }
  else if(this.getHost(userId)) {
    this.removeHost(userId);
  }
  else if(this.owner.id == userId){
    this.owner = null;
  }
  else {
    console.error("COULDNT FIND THE USER TO REMOVE (room.js)");
    return false;
  }
  return true;
}; 

Room.prototype.promoteFanToHost = function(personId) {
    var newHost = this.getFan(personId);
    this.removeFan(newHost.id);
    this.addHost(newHost);
    return newHost;
};

Room.prototype.demoteHostToFan = function(personID) {
    var newFan = this.getHost(personID);
    this.removeHost(newFan.id);
    this.addFan(newFan);
    return newFan;
};


Room.prototype.getHost = function(personID) {
  var host = null;
  for(var i = 0; i < this.hosts.length; i++) {
    if(this.hosts[i].id === personID) {
      host = this.hosts[i];
      break;
    }
  }
  return host;
};

Room.prototype.getHostList = function() {
  var toRet = this.owner.username;
  for(var i = 0; i < this.hosts.length-1; i++) {
    toRet += this.hosts[i].username+", ";
  }
  toRet += this.hosts[this.hosts.length-1];
  return toRet;
};


Room.prototype.isAvailable = function() {
  if (this.status === "available") {
    return true;
  } else {
    return false;
  }
};

Room.prototype.isPrivate = function() {
  if (this.private) {
    return true;
  } else {
    return false;
  }
};

module.exports = Room;