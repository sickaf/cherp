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

//namespace stuff
//NOT CURRENTLY USED
var nsp = io.of('/balls');
nsp.on('connection', function(socket){
  console.log('someone connected');
});
// nsp.emit('hi', 'everyone!');


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

function pushMessageToDB(name, roomID, fullMessage){
  RoomModel.findOne({ 'id' : roomID }, function(err, room) {
    if (err)
      console.log("database ERR: "+err);
    if (room) {
      console.log("database found room with id: "+room.id);
      room.hostMessages.push(fullMessage);
      room.save(function(err) {
        if (err)
            throw err;
        else {
          console.log("no error saving room obj to db");
        }
      });
    } else {
      console.log("database did not find room");
      var newRoom = new RoomModel();
      newRoom.id = roomID;
      newRoom.name = name;
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
      io.to(socket.room).emit("tell client owner left", " left, so this room is now dead.  Join another room or start your own conversation");
      killRoom(room);
    } else {
      room.removeUser(user.id);
      io.to(room.id).emit("update room metadata", room);  
    }
  }
}

function killRoom(room){
  io.to(room.id).emit("set roomAvailable", false);
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
            ourUser.username = "ANON_USERNAME_NOT_SET_420";
            ourUser.sockets.push(socket.id);
            users.push(ourUser);
          }
      } else {console.error("NO PASSPORT io.on connection");}
  } else {console.error("NO SESSION io.on connection");}

  //messaging
  socket.emit('update', "Welcome to the world. You have connected to the server. Users ("+users.length+") are: "+getUsersList()+". you are "+JSON.stringify(ourUser)+" and your id is "+ourUser.id);  
  sockets.push(socket);

  //Received an image: broadcast to all
  socket.on('new image', function (data) {
    if(!socketIsInChat()) return;

    var fullMessage = {
      username: ourUser.username,
      base64Image: data,
      image: true
    };

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) {
      io.sockets.in(socket.room).emit('new host message', fullMessage);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, fullMessage);
    }
    else  {
      socket.emit("update", "ur not the host get a day job");
    }
  });

  // when the client emits 'new host message', this listens and executes
  socket.on('new message', function (data) {
    if(!socketIsInChat()) return;

    var fullMessage = {
      username: ourUser.username,
      message: data
    };

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) {
      socket.broadcast.to(socket.room).emit("new host message", fullMessage);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, fullMessage);
    }
    else {
      socket.broadcast.to(socket.room).emit("new fan message", fullMessage);
    }
  });

  function socketIsInChat(){
    if(getRoomWithID(socket.room)) return true;
    socket.emit("update", "ur socket is not in a chatroom buddy.  go live or join one from the left if any exist.");
    return false;
  }


  // when the client emits 'make host', this listens and executes
  socket.on('promote fan', function (username) {
    changeStatus(username, true);
  });

  // when the client emits 'make host', this listens and executes
  socket.on('demote host', function (username) {
    changeStatus(username, false);
  });

  function changeStatus(username, promoteUp) {
    if(!socketIsInChat()) return;

    var userToChange = _.where(users, {username: username})[0];
    var roomForChange = getRoomWithID(socket.room);

    if(!roomForChange.isOwner(ourUser.id)) {
      socket.emit("update", "ur not the owner u cant change users status go make ur own room");
      return;
    }

    if(!userToChange) {
      socket.emit("update", username+" is no longer with us :(");
      return;
    }

    if(!isThisUserInThisRoom(userToChange, socket.room)) {
      socket.emit("update", username+" is no longer in this chat");
      return;
    }

    if(promoteUp) { //PROMOTION (yay)
      if(isThisUserAtLeastHostOfThisRoom(userToChange, socket.room)) {
        socket.emit("update", "that person is already a host hahahahahhahaha");
        return;
      }
      roomForChange.promoteFanToHost(userToChange.id);
      socket.emit("update", "just made "+username+" a host.");
    }
    else { //DEMOTION :(
      if(roomForChange.isOwner(userToChange.id)) {
        socket.emit("update", "you cant demote urself!");
        return;
      }
      else if(!isThisUserAtLeastHostOfThisRoom(userToChange, socket.room)) {
        socket.emit("update", "that person is not a host hahahahahhahaha");
        return;
      }

      roomForChange.demoteHostToFan(userToChange.id);
      socket.emit("update", "just demoted "+username+".");
    }
    io.to(socket.room).emit("update room metadata", roomForChange);
    socket.broadcast.to(socket.room).emit("set iAmHost", username, promoteUp);
  }


  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    if(!socketIsInChat()) return;

    if(isThisUserAtLeastHostOfThisRoom(ourUser, socket.room)) {
      socket.broadcast.to(socket.room).emit('host repost', data);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, data);
    }
    else {
      socket.emit("update", "ur not the host lol pull out homie");
    }
  });

  // when the client emits 'add username', this listens and executes
  socket.on('set username', function (username) {
    ourUser.username = username;
  });

  function joinTrendingChat () {
    if(rooms.length > 0) {
      enterChatWithId(rooms[0].id);
    } else  {
      console.log("TRIED TO JOIN TRENDING CHAT BUT AINT NO ROOMS");
    }
  }

  socket.on('join trending chat', function (data) {
    joinTrendingChat();
  });

  socket.on('join chat by owner', function (ownerName) { //used when user has a direct URL
    var roomToJoin = getRoomWithName(ownerName);
    if (roomToJoin) {
      enterChatWithId(roomToJoin.id);
    } else {
      joinTrendingChat();
    }
  });

  socket.on('enter chat with id', function (id) { //used when you click the trending rooms link
    enterChatWithId(id);
  });

  function enterChatWithId(idParam) {
    var id = idParam;
    if (!id) {
      id = ourUser.id;
    }

    //check if this socket is already in the room
    var roomToEnter = getRoomWithID(id);
    if(roomToEnter) {
      if(roomToEnter.id == socket.room) {
        socket.emit("update", "this socket is already in that room so going to return");
        return;
      }
    }

    //LETS DO THIS
    socket.emit("clear messages", {});
   
    var oldRoom = getRoomWithID(socket.room);
    if (oldRoom) { 
      socket.emit("update", "Your socket is already in a room.  Going to remove the socket from room " + socket.room);
      removeSocketFromRoom(socket, ourUser, oldRoom);
    }

    //what if the chatroom already exists!!
    if(getRoomWithID(id)) {

      var existingRoom = getRoomWithID(id);

      if(existingRoom.getUser(ourUser.id)) { //user is already in the room
        if(isThisUserAtLeastHostOfThisRoom(ourUser, existingRoom.id)){
          socket.emit("set iAmHost", ourUser.username, true); //tell the client that it is host
        }
      } else {
        existingRoom.addFan(ourUser);
        socket.emit("update", "the room "+existingRoom.name + " already exists.  adding you as a FAN. now "+existingRoom.name + " has "+existingRoom.usersNum+" users");
        socket.emit("set iAmHost", ourUser.username, false); //tell the client that it is not host
      }
    }
    else { //room doesnt exist. create it
      socket.emit("update", "the room with id "+ id + " doesnt exist yet.  adding you as OWNER. pretty cool huh?");
      var room = new Room(id, ourUser);
      rooms.push(room);
      //add room to socket, and auto join the creator of the room
      socket.emit("set iAmHost", ourUser.username, true); 
    }
    socket.leave(socket.room);
    socket.room = id;
    socket.join(socket.room);

    RoomModel.findOne({'id' : id}, function(err, room) {
      if (err)
        console.log("database ERR getting hostMessages: "+err);
      if (room) {
        console.log("database found room with id: "+room.id);
        socket.emit("add database messages", room.hostMessages);

      } else {
        console.log("database couldnt find "+id+" to load messages from");
      }
    });
    
    socket.emit("set currentlyInRoom", true); //tell the client whats really good
    socket.broadcast.emit("update", ourUser.username+" is now in room "+getRoomWithID(id).name+". There are now "+_.size(rooms)+" rooms: "+getRoomList());
    io.sockets.emit("update roomsList", rooms);
    socket.emit("push state", getRoomWithID(id).owner.username); //updates the address bar
    io.to(socket.room).emit("update room metadata", getRoomWithID(id));
  }

  socket.on('kill room', function (data) {
    if(!socketIsInChat()) return;

    if(getRoomWithID(socket.room).isOwner(ourUser.id)) {
      killRoom(getRoomWithID(socket.room));
    }
    else {
      socket.emit("update", "ur not the owner omg freakin buzz off");
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

/*
                         8888  8888888
                  888888888888888888888888
               8888:::8888888888888888888888888
             8888::::::8888888888888888888888888888
            88::::::::888:::8888888888888888888888888
          88888888::::8:::::::::::88888888888888888888
        888 8::888888::::::::::::::::::88888888888   888
           88::::88888888::::m::::::::::88888888888    8
         888888888888888888:M:::::::::::8888888888888
        88888888888888888888::::::::::::M88888888888888
        8888888888888888888888:::::::::M8888888888888888
         8888888888888888888888:::::::M888888888888888888
        8888888888888888::88888::::::M88888888888888888888
      88888888888888888:::88888:::::M888888888888888   8888
     88888888888888888:::88888::::M::;o*M*o;888888888    88
    88888888888888888:::8888:::::M:::::::::::88888888    8
   88888888888888888::::88::::::M:;:::::::::::888888888     
  8888888888888888888:::8::::::M::aAa::::::::M8888888888       8
  88   8888888888::88::::8::::M:::::::::::::888888888888888 8888
 88  88888888888:::8:::::::::M::::::::::;::88:88888888888888888
 8  8888888888888:::::::::::M::"@@@@@@@"::::8w8888888888888888
  88888888888:888::::::::::M:::::"@a@":::::M8i888888888888888
 8888888888::::88:::::::::M88:::::::::::::M88z88888888888888888 
8888888888:::::8:::::::::M88888:::::::::MM888!888888888888888888
888888888:::::8:::::::::M8888888MAmmmAMVMM888*88888888   88888888
888888 M:::::::::::::::M888888888:::::::MM88888888888888   8888888
8888   M::::::::::::::M88888888888::::::MM888888888888888    88888
 888   M:::::::::::::M8888888888888M:::::mM888888888888888    8888
  888  M::::::::::::M8888:888888888888::::m::Mm88888 888888   8888
   88  M::::::::::::8888:88888888888888888::::::Mm8   88888   888
   88  M::::::::::8888M::88888::888888888888:::::::Mm88888    88
   8   MM::::::::8888M:::8888:::::888888888888::::::::Mm8     4
       8M:::::::8888M:::::888:::::::88:::8888888::::::::Mm    2
      88MM:::::8888M:::::::88::::::::8:::::888888:::M:::::M
     8888M:::::888MM::::::::8:::::::::::M::::8888::::M::::M
    88888M:::::88:M::::::::::8:::::::::::M:::8888::::::M::M
   88 888MM:::888:M:::::::::::::::::::::::M:8888:::::::::M:
   8 88888M:::88::M:::::::::::::::::::::::MM:88::::::::::::M
     88888M:::88::M::::::::::*88*::::::::::M:88::::::::::::::M             
    888888M:::88::M:::::::::88@@88:::::::::M::88::::::::::::::M
    888888MM::88::MM::::::::88@@88:::::::::M:::8::::::::::::::*8
    88888  M:::8::MM:::::::::*88*::::::::::M:::::::::::::::::88@@
    8888   MM::::::MM:::::::::::::::::::::MM:::::::::::::::::88@@
     888    M:::::::MM:::::::::::::::::::MM::M::::::::::::::::*8
     888    MM:::::::MMM::::::::::::::::MM:::MM:::::::::::::::M
      88     M::::::::MMMM:::::::::::MMMM:::::MM::::::::::::MM
       88    MM:::::::::MMMMMMMMMMMMMMM::::::::MMM::::::::MMM
        88    MM::::::::::::MMMMMMM::::::::::::::MMMMMMMMMM
         88   8MM::::::::::::::::::::::::::::::::::MMMMMM
          8   88MM::::::::::::::::::::::M:::M::::::::MM
              888MM::::::::::::::::::MM::::::MM::::::MM
             88888MM:::::::::::::::MMM:::::::mM:::::MM
             888888MM:::::::::::::MMM:::::::::MMM:::M
            88888888MM:::::::::::MMM:::::::::::MM:::M
           88 8888888M:::::::::MMM::::::::::::::M:::M
           8  888888 M:::::::MM:::::::::::::::::M:::M:
              888888 M::::::M:::::::::::::::::::M:::MM
             888888  M:::::M::::::::::::::::::::::::M:M
             888888  M:::::M:::::::::@::::::::::::::M::M
             88888   M::::::::::::::@@:::::::::::::::M::M
            88888   M::::::::::::::@@@::::::::::::::::M::M
           88888   M:::::::::::::::@@::::::::::::::::::M::M
          88888   M:::::m::::::::::@::::::::::Mm:::::::M:::M
          8888   M:::::M:::::::::::::::::::::::MM:::::::M:::M
         8888   M:::::M:::::::::::::::::::::::MMM::::::::M:::M
        888    M:::::Mm::::::::::::::::::::::MMM:::::::::M::::M
      8888    MM::::Mm:::::::::::::::::::::MMMM:::::::::m::m:::M
     888      M:::::M::::::::::::::::::::MMM::::::::::::M::mm:::M
  8888       MM:::::::::::::::::::::::::MM:::::::::::::mM::MM:::M:
             M:::::::::::::::::::::::::M:::::::::::::::mM::MM:::Mm
            MM::::::m:::::::::::::::::::::::::::::::::::M::MM:::MM
            M::::::::M:::::::::::::::::::::::::::::::::::M::M:::MM         
           MM:::::::::M:::::::::::::M:::::::::::::::::::::M:M:::MM
           M:::::::::::M88:::::::::M:::::::::::::::::::::::MM::MMM
           M::::::::::::8888888888M::::::::::::::::::::::::MM::MM
           M:::::::::::::88888888M:::::::::::::::::::::::::M::MM
           M::::::::::::::888888M:::::::::::::::::::::::::M::MM
           M:::::::::::::::88888M:::::::::::::::::::::::::M:MM
           M:::::::::::::::::88M::::::::::::::::::::::::::MMM
           M:::::::::::::::::::M::::::::::::::::::::::::::MMM
           MM:::::::::::::::::M::::::::::::::::::::::::::MMM
            M:::::::::::::::::M::::::::::::::::::::::::::MMM
            MM:::::::::::::::M::::::::::::::::::::::::::MMM
             M:::::::::::::::M:::::::::::::::::::::::::MMM
             MM:::::::::::::M:::::::::::::::::::::::::MMM
              M:::::::::::::M::::::::::::::::::::::::MMM
              MM:::::::::::M::::::::::::::::::::::::MMM
               M:::::::::::M:::::::::::::::::::::::MMM  
               MM:::::::::M:::::::::::::::::::::::MMM
                M:::::::::M::::::::::::::::::::::MMM
                MM:::::::M::::::::::::::::::::::MMM
                 MM::::::M:::::::::::::::::::::MMM
                 MM:::::M:::::::::::::::::::::MMM
                  MM::::M::::::::::::::::::::MMM
                  MM:::M::::::::::::::::::::MMM
                   MM::M:::::::::::::::::::MMM
                   MM:M:::::::::::::::::::MMM
                    MMM::::::::::::::::::MMM
                    MM::::::::::::::::::MMM
                     M:::::::::::::::::MMM
                    MM::::::::::::::::MMM
                    MM:::::::::::::::MMM
                    MM::::M:::::::::MMM:
                    mMM::::MM:::::::MMMM
                     MMM:::::::::::MMM:M
                     mMM:::M:::::::M:M:M
                      MM::MMMM:::::::M:M
                      MM::MMM::::::::M:M
                      mMM::MM::::::::M:M
                       MM::MM:::::::::M:M
                       MM::MM::::::::::M:m
                       MM:::M:::::::::::MM
                       MMM:::::::::::::::M:
                       MMM:::::::::::::::M:
                       MMM::::::::::::::::M
                       MMM::::::::::::::::M
                       MMM::::::::::::::::Mm
                        MM::::::::::::::::MM
                        MMM:::::::::::::::MM
                        MMM:::::::::::::::MM
                        MMM:::::::::::::::MM
                        MMM:::::::::::::::MM
                         MM::::::::::::::MMM
                         MMM:::::::::::::MM
                         MMM:::::::::::::MM
                         MMM::::::::::::MM
                          MM::::::::::::MM
                          MM::::::::::::MM
                          MM:::::::::::MM
                          MMM::::::::::MM
                          MMM::::::::::MM
                           MM:::::::::MM
                           MMM::::::::MM
                           MMM::::::::MM
                            MM::::::::MM
                            MMM::::::MM
                            MMM::::::MM
                             MM::::::MM
                             MM::::::MM
                              MM:::::MM
                              MM:::::MM:
                              MM:::::M:M
                              MM:::::M:M
                              :M::::::M:
                             M:M:::::::M
                            M:::M::::::M
                           M::::M::::::M
                          M:::::M:::::::M
                         M::::::MM:::::::M
                         M:::::::M::::::::M
                         M;:;::::M:::::::::M
                         M:m:;:::M::::::::::M
                         MM:m:m::M::::::::;:M
                          MM:m::MM:::::::;:;M
                           MM::MMM::::::;:m:M
                            MMMM MM::::m:m:MM
                                  MM::::m:MM
                                   MM::::MM
                                    MM::MM
*/
