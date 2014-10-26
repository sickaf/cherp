function Room(name, id, owner) {
  this.name = name;
  this.id = id;
  this.hosts = [];
  this.hostMessages = [];
  this.hosts[0] = owner;
  this.fans = [];
  this.fanLimit = 4;
  this.peopleNum = 1;
  this.status = "available";
  this.private = false;
};

Room.prototype.addFan = function(username) {
  if (this.status === "available") {
    this.fans.push(username);
  }
  this.peopleNum++;
};

// probably a better way to do it
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

Room.prototype.removeFan = function(username) {
  var fanIndex = -1;
  for(var i = 0; i < this.fans.length; i++){
    if(this.fans[i] == username){
      fanIndex = i;
      break;
    }
  }
  // this.fans.remove(fanIndex);
  this.hosts.splice(fanIndex,1);

  this.peopleNum--;
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

Room.prototype.addHost = function(username) {
  if (this.status === "available") {
    this.hosts.push(username);
  }
  this.peopleNum++;
};

Room.prototype.removeHost = function(username) {
  var hostIndex = -1;
  for(var i = 0; i < this.hosts.length; i++){
    if(this.hosts[i].username === username){
      hostIndex = i;
      break;
    }
  }
  this.hosts.splice(hostIndex,1);
  this.peopleNum--;
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
