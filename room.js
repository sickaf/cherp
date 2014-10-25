function Room(name, id, owner) {
  this.name = name;
  this.id = id;
  this.hosts = [];
  this.hosts[0] = owner;
  this.fans = [];
  this.fanLimit = 4;
  this.status = "available";
  this.private = false;
};

Room.prototype.addFan = function(personID) {
  if (this.status === "available") {
    this.fans.push(personID);
  }
};

Room.prototype.removeFan = function(person) {
  var fanIndex = -1;
  for(var i = 0; i < this.fans.length; i++){
    if(this.fans[i].id === person.id){
      fanIndex = i;
      break;
    }
  }
  this.fans.remove(fanIndex);
};

Room.prototype.getFan = function(personID) {
  var fan = null;
  for(var i = 0; i < this.fans.length; i++) {
    if(this.fans[i].id == personID) {
      fan = this.fans[i];
      break;
    }
  }
  return fan;
};

Room.prototype.addHost = function(personID) {
  if (this.status === "available") {
    this.hosts.push(personID);
  }
};

Room.prototype.removeHost = function(person) {
  var hostIndex = -1;
  for(var i = 0; i < this.hosts.length; i++){
    if(this.hosts[i].id === person.id){
      hostIndex = i;
      break;
    }
  }
  this.hosts.remove(hostIndex);
};

Room.prototype.getHost = function(personID) {
  var host = null;
  for(var i = 0; i < this.hosts.length; i++) {
    if(this.hosts[i].id == personID) {
      host = this.hosts[i];
      break;
    }
  }
  return host;
};


Room.prototype.isAvailable = function() {
  if (this.available === "available") {
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
