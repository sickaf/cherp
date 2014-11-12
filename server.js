// set up ======================================================================
// Setup basic express server
var port = process.env.PORT || 3000;
var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
var session = require('express-session');
var server = require('http').createServer(app);
var bodyParser = require('body-parser');
var passport = require('passport');
var io = require('socket.io')(server);
var flash    = require('connect-flash');
var path = require('path');
var _ = require('underscore')._; //tool for doing things like calling .size on an array
var logger = require('morgan'); //hoping this will make debugging easier
var uuid = require('node-uuid'); //for generating IDs for things like rooms
var RoomModel = require('./roommodel');
var User = require('./user');
var qt   = require('quickthumb');
var sanitizeHtml = require('sanitize-html');

// Use quickthumb
app.use(qt.static(__dirname + '/'));



//
// database stuff
//
var mongoose = require('mongoose');
var configDB = require('./config/database.js')
mongoose.connect(configDB.url, configDB.options);
var RedisStore = require('connect-redis')(session);

// configuration ===============================================================

require('./config/passport')(passport); // pass passport for configuration

// allows us to parse the HTML body. currently used to parse newmessage.html
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set('view engine', 'ejs');

//i think we need this to print the stack trace in the event of an error
app.use(logger('dev'));

app.use(cookieParser());


// passport
var sessionMiddleware = session({
  store : new RedisStore({
      host: 'pub-redis-17900.us-east-1-4.3.ec2.garantiadata.com',
      port: '17900'
  }),
  secret: 'devon is gay',
  cookie : {
    maxAge: 3600000
  },
  resave: true,
  saveUninitialized: true,
});

app.use(sessionMiddleware);

app.use(flash()); // use connect-flash for flash messages stored in session

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

io.use(function(socket, next){
  sessionMiddleware(socket.request, {}, next);
})

//
// Routing
//
require('./routes/routes.js')(app, passport); // pass in app and passport
require('./routes/api/v1/api.js')(app);
app.use(express.static(path.join(__dirname, 'views'))); // tells express that static content is in the views directory

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

//
// Chatroom
//

// users which are currently connected to the chat
var Room = require('./room.js');
var users = []; 
var rooms = [];
var sockets = [];

function randomUsername() {
  var nouns = ['fart','weed','poop','snowboard','longboarding','blaze','pussy','meat','slippery','dumb','heady','messy','drunk','blood'];
  var descriptors = ['fan','dude','man','doctor','expert','thug','hero','king','queen','idiot','queef','muscles','splatter','satan','worshipper', 'virgin'];
  var numbers = ['420','69'];
  var noun = nouns[Math.floor(Math.random() * nouns.length)];
  var descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];
  var number = numbers[Math.floor(Math.random() * numbers.length)];
  return noun+descriptor+number;
}

function getUsersList () {
  var toReturn = "";
  var first = true;
  for (var i = 0; i < users.length; i++) {
    if (first) {
      toReturn = users[i].username;
      first = false;
    } else {
      toReturn += ", " + users[i].username;
    }
  }
  return toReturn;
}

function getRoomWithName (name) {
  var toRet = _.where(rooms, {name: name});
  if(toRet.length > 0) return toRet[0];
  else return null;
}

function getRoomWithOwnerName (name) {
  var toRet = _.where(rooms, {ownerName: name});
  if(toRet.length > 0) return toRet[0];
  else return null;
}


function getRoomWithID (id) {
  var toRet = _.where(rooms, {id: id});
  if(toRet.length > 0) return toRet[0];
  else return null;
}   

function getUserWithId (idParam) {
  for(var i = 0; i < users.length; i++) {
    if (users[i].id == idParam) {
      return users[i];
    }
  }
  return null;
}   

function getSocketWithId(socketId) {
  var toRet = _.where(sockets, {id: socketId});
  if(toRet.length > 0) return toRet[0];
  else return null;
}

function pushMessageToDB(ownerId, room, fullMessage){
  RoomModel.findOne({ 'id' : room.id }, function(err, roomModel) {
    if (err)
      console.log("database ERR: "+err);
    if (roomModel) {
      console.log("database found room with id: "+roomModel.id);
      roomModel.hostMessages.push(fullMessage);
      roomModel.save(function(err) {
        if (err)
            throw err;
        else {
          console.log("no error saving room obj to db");
        }
      });
    } else {
      console.log("database did not find room");
      var newRoom = new RoomModel();
      newRoom.id = room.id;
      newRoom.name = room.name;
      newRoom.ownerId = ownerId;
      newRoom.hosts = [];
      newRoom.hostMessages = [];
      newRoom.hostMessages.push(fullMessage);
      newRoom.save(function(err) {
      if (err)
          throw err;
      else {
        console.log("no error saving room obj to db");
      }
      });
    }
  });
}

function addDatabaseMessagesWithRoomId(roomId, socket){
    RoomModel.findOne({'id' : roomId}, function(err, room) {
      if (err)
        console.log("database ERR getting hostMessages: "+err);
      if (room) {
        console.log("database found room with id: "+room.id);
        socket.emit("add database messages", room.hostMessages);
      } else {
        console.log("database couldnt find "+roomId+" to load messages from");
      }
    });
}

function isThisUserInThisRoom (userParam, roomId) {
  var room = getRoomWithID(roomId);
  if(room.getUser(userParam.id)) return true;
  return false;
}

function removeSocketFromRoom(socket, user, room) {
  var otherSocketForThisUserIsInThisRoom = false;
  for(var i = 0; i < user.sockets.length; i++) { // loop through all the users sockets
    var ourUsersSocket = getSocketWithId(user.sockets[i]);
    if(ourUsersSocket.room == socket.room && (ourUsersSocket.id != socket.id)) {
      otherSocketForThisUserIsInThisRoom = true;
      console.log("setting otherSocketForThisUserIsInThisRoom TRUE");
    }
  }
  if(!otherSocketForThisUserIsInThisRoom){
    if(room.isOwner(user.id)){ //this guy is owner, so killing the room
      killRoom(room);
    } else {
      room.removeUser(user.id);
      io.to(room.id).emit("update room metadata", room);  
    }
  }
}

function killRoom(room){
  io.to(room.id).emit("set in active room", false);
  room.killRoom();
  rooms = _.without(rooms, room);
  delete room;
}

function isThisUserHostOfThisRoom (userParam, roomId) {
  var room = getRoomWithID(roomId);
  if(room.getHost(userParam.id)) return true;
  return false;
} 

function isThisUserAtLeastHostOfThisRoom (userParam, roomId) {
  if (isThisUserHostOfThisRoom(userParam, roomId)) return true;
  return getRoomWithID(roomId).isOwner(userParam.id);
}

function getRoomList () {
  var toReturn = "";
  var first = true;
    for (var i = 0; i < rooms.length; i++) {
      if (first) {
        toReturn = rooms[i].name;
        first = false;
      } else {
      toReturn += ", " + rooms[i].name;
      }
    }
  return toReturn;
}

io.on('connection', function (socket) {

  console.log(socket.request.session);

  var ourUser = null;
  var ourUserId;
  if (socket.request.session) {
      if ("passport" in socket.request.session) {
          if ("user" in socket.request.session.passport) {
            console.log('socket connection from logged in twitter user');
            
            ourUserId = socket.request.session.passport.user._id;
            ourUser = getUserWithId(ourUserId);
            if (ourUser) { //user already exists
              ourUser.sockets.push(socket.id);
            } else {  //wooo lets start fresh
              ourUser = socket.request.session.passport.user;
              ourUser.id = ourUserId;
              ourUser.sockets.push(socket.id);
              users.push(ourUser);
            }
          } else { //anon user wooo
            console.log("socket connecton from anon user, generating uuid");
            ourUser = new User();
            ourUser.username = randomUsername();
            ourUser.sockets.push(socket.id);
            ourUser.anon = true;
            users.push(ourUser);
          }
      } else {console.error("NO PASSPORT io.on connection"); return;}
  } else {console.error("NO SESSION io.on connection"); return;}

  //messaging
  socket.emit("set client username and id", ourUser.username, ourUser.id);   
  sockets.push(socket);

  //Received an image: broadcast to all
  socket.on('new image', function (data) {
    if(!socketIsInChat()) return;

    var fullMessage = {
      username: ourUser.username,
      base64Image: data,
      id: ourUser.id,
      avatar_url: ourUser.avatar_url,
      anon: ourUser.anon
    };

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) {
      io.sockets.in(socket.room).emit('new host message', fullMessage);
      pushMessageToDB(ourUser.id, getRoomWithID(socket.room), fullMessage);
    }
    else  {
      socket.emit("log notification", { message: "ur not the host get a day job", type : "danger" });   
    }
  });

  // when the client emits 'new host message', this listens and executes
  socket.on('new message', function (data) {
    if(!socketIsInChat()) return;

    var fullMessage = {
      username: ourUser.username,
      message: sanitizeHtml(data, {allowedTags: ['marquee']}),
      id: ourUser.id,
      avatar_url: ourUser.avatar_url,
      anon: ourUser.anon
    };

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) {
      socket.broadcast.to(socket.room).emit("new host message", fullMessage);
      pushMessageToDB(ourUser.id, getRoomWithID(socket.room), fullMessage);
    }
    else {
      socket.broadcast.to(socket.room).emit("new fan message", fullMessage);
    }
  });

  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    if(!socketIsInChat()) return;

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) {
      data.message = sanitizeHtml(data.message, {allowedTags: ['marquee']});
      socket.broadcast.to(socket.room).emit('host repost', data);
      pushMessageToDB(ourUser.id, getRoomWithID(socket.room), data);
    }
    else {
      socket.emit("log notification", { message: "ur not the host lol pull out homie", type : "danger" });   
    }
  });

  function socketIsInChat(){
    if(getRoomWithID(socket.room)) return true;
    socket.emit("log notification", { message: "your socket is not in a chatroom buddy.  go live or join one from the left if any exist.", type : "danger" });
    return false;
  }

  // when the client emits 'make host', this listens and executes
  socket.on('promote fan', function (fanId) {
    changeStatus(fanId, true);
  });

  // when the client emits 'make host', this listens and executes
  socket.on('demote host', function (hostId) {
    changeStatus(hostId, false);
  });

  function changeStatus(userId, promoteUp) {
    if(!socketIsInChat()) return;

    var userToChange = getUserWithId(userId);
    var roomForChange = getRoomWithID(socket.room);

    if(!roomForChange.isOwner(ourUser.id)) {
      socket.emit("log notification", { message: "ur not the owner u cant change users status go make ur own room", type : "danger" });   
      return;
    }

    if(!userToChange) {
      socket.emit("log notification", { message: "that user ("+userId+") logged off", type : "danger" });   
      return;
    }

    if(!isThisUserInThisRoom(userToChange, socket.room)) {
      socket.emit("log notification", { message: "that user ("+userId+") is no longer in this chat", type : "danger" });   
      return;
    }

    if(promoteUp) { //PROMOTION (yay)
      if(isThisUserAtLeastHostOfThisRoom(userToChange, socket.room)) {
        socket.emit("log notification", { message: "that user ("+userId+") is already a host hahahahahhahaha", type : "danger" });   
        return;
      }
      roomForChange.promoteFanToHost(userToChange.id);
      socket.emit("log notification", { message: "just made "+userToChange.username+" a host.", type : "success" }); 
      socket.broadcast.to(socket.room).emit("user was promoted", userToChange.username); 
    }
    else { //DEMOTION :(
      if(roomForChange.isOwner(userToChange.id)) {
        socket.emit("log notification", { message: "you cant demote urself!", type : "danger" });   

        return;
      }
      else if(!isThisUserAtLeastHostOfThisRoom(userToChange, socket.room)) {
        socket.emit("log notification", { message: "that user ("+userId+") is not a host", type : "danger" });   
        return;
      }

      roomForChange.demoteHostToFan(userToChange.id);
      socket.emit("log notification", { message: "just demoted "+userToChange.username+".", type : "success" });
      socket.broadcast.to(socket.room).emit("user was demoted", userToChange.username); 
    }
    io.to(socket.room).emit("update room metadata", roomForChange);
    socket.broadcast.to(socket.room).emit("set iAmHost", userToChange.username, promoteUp);
  }

  // when the client emits 'add username', this listens and executes
  socket.on('set username', function (username) {
    ourUser.username = sanitizeHtml(username);
    socket.emit('set client username', ourUser.username);
    io.to(socket.room).emit("update room metadata", getRoomWithID(socket.room));
    io.sockets.emit("update roomsList", rooms);
  });

  socket.on('join trending chat', function () {
    joinTrendingChat();
  });

  socket.on('join chat by owner', function (ownerName) { //used when user has a direct URL
    var roomToJoin = getRoomWithOwnerName(ownerName);
    if (roomToJoin) {
      enterChatWithId(roomToJoin.id);
    } else {
      joinTrendingChat();
    }
  });

  socket.on('enter chat with id', function (data) { //used when you click the trending rooms link
    enterChatWithId(data.id, data.name);
  });

  function joinTrendingChat () {
    if(rooms.length > 0) {
      enterChatWithId(rooms[0].id);

    } else  {
      // socket.emit("no rooms");
      socket.emit("update roomsList", rooms);
      console.log("TRIED TO JOIN TRENDING CHAT BUT AINT NO ROOMS");
    }
  }


  function enterChatWithId(idParam, name) {
    var id = idParam ? idParam : uuid.v4();
    var roomName = name ? sanitizeHtml(name) : "Untitled";

    //check if this socket is already in the room
    var roomToEnter = getRoomWithID(id);
    if(roomToEnter && roomToEnter.id == socket.room) {
      socket.emit("log notification", { message: "this socket is already in that room", type : "danger" });   
      return;
    }

    //LETS DO THIS
    socket.emit("clear messages", {});
   
    var oldRoom = getRoomWithID(socket.room);
    if (oldRoom) removeSocketFromRoom(socket, ourUser, oldRoom);
    
    //what if the chatroom already exists!!
    if(getRoomWithID(id)) {

      var existingRoom = getRoomWithID(id);

      if(existingRoom.getUser(ourUser.id)) { //user is already in the room
        if(isThisUserAtLeastHostOfThisRoom(ourUser, existingRoom.id)){
          socket.emit("set iAmHost", ourUser.username, true); //tell the client
        }
      } else {
        existingRoom.addFan(ourUser);
        socket.emit("log notification", { message:  "Adding you to this already existing room...", type : "normal" });   
        socket.broadcast.to(id).emit("fan joined room", ourUser.username);

        socket.emit("set iAmHost", ourUser.username, false); //tell the client
      }
    }
    else { //room doesnt exist. create it
      socket.emit("log notification", { message:  "Creating a new room for ya and adding you as OWNER. pretty cool huh?", type : "normal" });   
      var room = new Room(id, ourUser, roomName);
      rooms.push(room);

      //add room to socket, and auto join the creator of the room
      socket.emit("set iAmHost", ourUser.username, true); 
    }
    socket.leave(socket.room);
    socket.room = id;
    socket.join(socket.room);

    addDatabaseMessagesWithRoomId(id, socket);
    
    socket.emit("set in active room", true); //tell the client whats really good
    io.sockets.emit("update roomsList", rooms);
    socket.emit("push state", getRoomWithID(id).owner.username); //updates the address bar
    io.to(socket.room).emit("update room metadata", getRoomWithID(id));
  }
  
  socket.on('enter archived chat', function (id) {
    enterArchivedChat(id);
  });

  function enterArchivedChat(idParam, name) {
    
    var id = idParam ? idParam : uuid.v4();
    var roomName = name ? name : "Untitled";
    
    //LETS DO THIS
    socket.emit("clear messages", {});
   
    var oldRoom = getRoomWithID(socket.room);
    if (oldRoom) removeSocketFromRoom(socket, ourUser, oldRoom);
  
    socket.leave(socket.room);
    socket.room = id;
    socket.join(socket.room);

    addDatabaseMessagesWithRoomId(id, socket);
    
    socket.emit("set in active room", false); //tell the client whats really good
    io.sockets.emit("update roomsList", rooms);
    socket.emit("push state", "archivedChat"); //updates the address bar
  }

  socket.on('kill room', function (data) {
    if(!socketIsInChat()) return;

    if(getRoomWithID(socket.room).isOwner(ourUser.id)) {
      killRoom(getRoomWithID(socket.room));
    }
    else {
      socket.broadcast.emit("log notification", { message: "ur not the owner omg freakin buzz off", type : "danger" });   
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    if(!socketIsInChat()) return;

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) { //we only give a shit if they are a host
      socket.broadcast.to(socket.room).emit('typing', {
        username: ourUser.username
      });
    }
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    if(!socketIsInChat()) return;

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) { //we only give a shit if they are a host
      socket.broadcast.to(socket.room).emit('stop typing', {
        username: ourUser.username
      });
    }
  });

  // when the socket disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global users list
    var roomForDeletingUser;
    console.log("socket belonging to ("+ourUser.username+") is disconnecting");
    if (!ourUser) {
      console.log("ourUser doesnt exist! Adios!");
      return;
    }

    console.log("socket.room is "+socket.room);
    roomForDeletingUser = getRoomWithID(socket.room);

    if(roomForDeletingUser){
      console.log("roomForDeletingUser exists. ");
      removeSocketFromRoom(socket, ourUser, roomForDeletingUser);
    }

    io.sockets.emit("update roomsList", rooms);
    io.sockets.emit("update", ourUser.username+" closed a tab");
    ourUser.sockets = _.without(ourUser.sockets, socket.id);

    if(ourUser.sockets.length == 0) {
      users = _.without(users, ourUser);
      delete ourUser; 
    }
  });

});

module.exports = app; 
