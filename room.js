function Room(name, id, owner) {
  this.name = name;
  this.id = id;
  this.hosts = [];
  this.hostMessages = [];
  this.fans = [];
  this.fanLimit = 4;
  this.peopleNum = 0;
  this.status = "available";
  this.private = false;
  this.addHost(owner);
};

Room.prototype.addFan = function(fan) {
  if (this.status === "available") {
    fan.owns = null;
    fan.inroom = this.name;
    this.fans.push(fan);
    this.peopleNum++;
  }
};

// probably the better way to do it
// Room.prototype.removeFan = function(person) {
//   var fanIndex = -1;
//   for(var i = 0; i < this.fans.length; i++){
//     if(this.fans[i].id === person.id){
//       fanIndex = i;
//       break;
//     }
//   }
//   this.fans.remove(fanIndex);
//   this.peopleNum--;
// };

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
    host.owns = this.name;
    host.inroom = this.name;
    this.hosts.push(host);
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

Room.prototype.promoteFanToHost = function(personID) {
    var newHost = this.getFan(personID);
    this.addHost(newHost);
    this.removeFan(newHost.id);
    return newHost;
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
