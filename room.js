function Room(name, id, owner) {
  this.name = name;
  this.id = id;
  this.owner = owner;
  this.hosts = [];
  this.hostMessages = [];
  this.fans = [];
  this.fanLimit = 4;
  this.peopleNum = 0;
  this.status = "available";
  this.private = false;
  this.addHost(owner);

  owner.owns = this.id;
  owner.hostof = this.id;
  owner.inroom = this.id;
};

Room.prototype.addFan = function(fan) {
  if (this.status === "available") {
    fan.owns = null;
    fan.hostof = null;
    fan.inroom = this.id;
    this.fans.push(fan);
    this.peopleNum++;
  }
};

Room.prototype.killRoom = function() {
  this.status = "archived";
};

Room.prototype.removeFan = function(personID) {
  var fanIndex = -1;
  for(var i = 0; i < this.fans.length; i++){
    if(this.fans[i].id === personID){
      fanIndex = i;
      break;
    }
  }
  // this.fans.remove(fanIndex);
  this.fans.splice(fanIndex,1);
  this.peopleNum--;
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

Room.prototype.addHost = function(host) {
  if (this.status === "available") {
    host.owns = null;
    host.hostof = this.id;
    host.inroom = this.id;
    this.hosts.push(host);
    this.peopleNum++;
  }
};

Room.prototype.addOwner = function(owner) {
  if (this.status === "available") {
    if(this.owner) {
      console.error("TRIED TO ADD OWNER ("+owner.username+") BUT OWNER ALREADY EXISTS ("+this.owner.username+")");
      return false;
    }
    owner.owns = this.id;
    owner.hostof = this.id;
    owner.inroom = this.id;
    this.owner = owner;
    this.peopleNum++;
  }
};

Room.prototype.removeHost = function(personID) {
  var hostIndex = -1;
  for(var i = 0; i < this.hosts.length; i++){
    if(this.hosts[i].id === personID){
      hostIndex = i;
      break;
    }
  }
  this.hosts.splice(hostIndex,1);
  this.peopleNum--;

  //promote a fan if there are no hosts
  if(this.hosts.length == 0 && this.peopleNum) { 
    return this.promoteFanToHost(this.fans[0].id);
  }
};

Room.prototype.removeOwner = function(personID) {
  this.owner = null;
  this.peopleNum--;
  console.log("removing owner from room. peopleNum will be "+this.peopleNum);
  if(this.peopleNum) { 
      console.log("peopleNum returned true");
  }

  //promote a fan if there are no hosts
  if(this.peopleNum) { 
    var newOwner;
    if(this.hosts.length > 0){
      newOwner = this.hosts[0];
      this.addOwner(newOwner);
      this.removeHost(newOwner.id);
    } else {
      newOwner = this.fans[0];
      this.addOwner(newOwner);
      this.removeFan(newOwner.id);
    }
    return this.owner;
  }
}


Room.prototype.removePerson = function(personID) {
  if(this.getFan(personID)) {
    this.removeFan(personID);
  }
  else if(this.getHost(personID)) {
    this.removeHost(personID);
  }
  else if(this.owner.id == personID){
    this.owner.owns = null;
    this.owner

  }
  else {
    console.error("COULDNT FIND THE PERSON TO REMOVE (room.js)");
    return false;
  }
  return true;
}

Room.prototype.promoteFanToHost = function(personID) {
    var newHost = this.getFan(personID);
    this.addHost(newHost);
    this.removeFan(newHost.id);
    return newHost;
}


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
