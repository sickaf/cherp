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
var logger = require('morgan'); //hoping this will make debugging easier
var _ = require('underscore')._; //tool for doing things like calling .size on an array
var uuid = require('node-uuid'); //for generating IDs for things like rooms
var RoomModel = require('./roommodel');


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

// people which are currently connected to the chat
var Room = require('./room.js');
var people = []; 
var rooms = [];
var sockets = [];

//namespace stuff
//NOT CURRENTLY USED
var nsp = io.of('/balls');
nsp.on('connection', function(socket){
  console.log('someone connected');
});
// nsp.emit('hi', 'everyone!');


function getPeopleList () {
  var toReturn = "";
  var first = true;
  for (var i = 0; i < people.length; i++) {
    if (first) {
      toReturn = people[i].username;
      first = false;
    } else {
      toReturn += ", " + people[i].username;
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

// function pushMessageToDB(roomID, fullMessage){
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

  var ourHeroID;
  if (socket.request.session) {
      if ("passport" in socket.request.session) {
          if ("user" in socket.request.session.passport) {
            
            console.log('socket connecton from logged in twitter user');
            var authorizedUser = socket.request.session.passport.user;
            ourHeroID = authorizedUser;

          } else {
            console.log("socket connecton from anon user, generating temp ID");
            ourHeroID = uuid.v4();
          }
      } else {console.error("NO PASSPORT io.on connection");}
  } else {console.error("NO SESSION io.on connection");}

  console.log('hero id: ' + ourHeroID);

  var ourHero = { "id" : ourHeroID,
                  "socketID" : socket.id, 
                  "username" : "usernamenotset", 
                  "owns" : null,
                  "hostof" : null, 
                  "inroom": null};

  people.push(ourHero);

  //messaging
  socket.emit('update', "Welcome to the world. You have connected to the server. People ("+people.length+") are: "+getPeopleList()+". you are "+JSON.stringify(ourHero));
  //sets connected = true
  
  sockets.push(socket);

  var addedUser = true;  

  //Received an image: broadcast to all
  socket.on('new image', function (data) {
    if(!getRoomWithID(socket.room)){
      socket.emit("update", "ur not in a chatroom buddy.  go live or join one from the left if any exist.");
      return;
    }

    var fullMessage = {
      username: ourHero.username,
      base64Image: data,
      image: true
    };

    if(ourHero.hostof == socket.room) {
      io.sockets.in(socket.room).emit('new host message', fullMessage);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, fullMessage);
    }
    else  {
      socket.emit("update", "ur not the host get a day job");
    }
  });

  // when the client emits 'new host message', this listens and executes
  socket.on('new message', function (data) {
    if(!getRoomWithID(socket.room)){
      socket.emit("update", "ur not in a chatroom buddy.  go live or join one from the left if any exist.");
      return;
    }

    var fullMessage = {
      username: ourHero.username,
      message: data
    };

    if(ourHero.hostof == socket.room) {
      console.log(" ourhero owns : socket.room : "+ourHero.hostof+" : "+socket.room);
      socket.broadcast.to(socket.room).emit("new host message", fullMessage);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, fullMessage);
    }
    else {
      socket.broadcast.to(socket.room).emit("new fan message", fullMessage);
    }
  });


  // when the client emits 'make host', this listens and executes
  socket.on('promote fan', function (username) {
    changeStatus(username, true);
  });

  // when the client emits 'make host', this listens and executes
  socket.on('demote host', function (username) {
    changeStatus(username, false);
  });

  function changeStatus(username, promoteUp) {
    if(ourHero.owns != socket.room) {
      socket.emit("update", "ur not the owner u cant change peoples status go make ur own room");
      return;
    }
    var userToChange = _.where(people, {username: username})[0];
    var roomForChange = getRoomWithID(ourHero.owns);

    if(promoteUp) { //PROMOTION (yay)
      if(userToChange.hostof != null) {
        socket.emit("update", "that person is already a host hahahahahhahaha");
        return;
      }
      roomForChange.promoteFanToHost(userToChange.id);
      socket.emit("update", "just made "+username+" a host.");
      io.to(socket.room).emit("update room metadata", roomForChange);
    }
    else { //DEMOTION :(
      if(userToChange.owns == socket.room) {
        socket.emit("update", "you cant demote urself!");
        return;
      }
      else if(userToChange.hostof != socket.room ) {
        socket.emit("update", "that person is not a host hahahahahhahaha");
        return;
      }

      roomForChange.demoteHostToFan(userToChange.id);
      socket.emit("update", "just demoted "+username+".");
      io.to(socket.room).emit("update room metadata", roomForChange);
    }
    socket.broadcast.to(socket.room).emit("set iAmHost", username, promoteUp);
  }


  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {

    if(!getRoomWithID(socket.room).isAvailable()){
      socket.emit("update", "THIS ROOM IS FUCKING DEAD");
      return;
    }
    if(ourHero.hostof == socket.room) {
      console.log(" hostrepost ourhero owns : socket.room : "+ourHero.hostof+" : "+socket.room);
      socket.broadcast.to(socket.room).emit('host repost', data);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, data);
    }
    else {
      socket.emit("update", "ur not the host lol pull out homie");
    }
  });

  // when the client emits 'add username', this listens and executes
  socket.on('set username', function (username) {
    ourHero.username = username;
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

  socket.on('join chat by owner', function (ownerName) {
    var roomToJoin = getRoomWithName(ownerName+"Room");
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
      id = ourHero.id;
    }

    if (ourHero.owns) {
      socket.emit("update", "You already own a room! This is madness!");
      return;
    }

    //LETS DO THIS
    socket.emit("clear messages", {});
    
    socket.emit("update", "you ("+ourHero.username + ") want to enter chat with id: "+JSON.stringify(id));
   
    var oldRoom = getRoomWithID(ourHero.inroom);;
    if (oldRoom) {
      socket.emit("update", "You are already in a room.  Going to remove you from room "+ourHero.inroom);
      getRoomWithID(ourHero.inroom).removePerson(ourHero.id);
      io.to(oldRoom.id).emit("update room metadata", oldRoom);
    }

    //what if the chatroom already exists!!
    if(getRoomWithID(id)) {
      var existingRoom = getRoomWithID(id);
      if(existingRoom.peopleNum == 0) { //TODO: change to .available
        getRoomWithID(id).addOwner(ourHero);
        socket.emit("set iAmHost", ourHero.username, true); 
        socket.emit("update", "the room "+getRoomWithID(id).name + " already exists but no one is in it.  adding you as OWNER. now "+getRoomWithID(id).name + " has "+getRoomWithID(id).peopleNum+" people");
      }
      else {
        getRoomWithID(id).addFan(ourHero);
        socket.emit("update", "the room "+getRoomWithID(id).name + " already exists.  adding you as a FAN. now "+getRoomWithID(id).name + " has "+getRoomWithID(id).peopleNum+" people");
      }
    }
    else { //room doesnt exist. create it
      socket.emit("update", "the room with id "+ id + " doesnt exist yet.  adding you as OWNER");

      var id = uuid.v4();
      var room = new Room(ourHero.username+"Room", id, ourHero);
      rooms.push(room);
      //add room to socket, and auto join the creator of the room
      socket.emit("set iAmHost", ourHero.username, true); 
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
    socket.broadcast.emit("update", ourHero.username+" is now in room "+getRoomWithID(id).name+". There are now "+_.size(rooms)+" rooms: "+getRoomList());
    io.sockets.emit("update roomsList", rooms);
    socket.emit("push state", getRoomWithID(id).owner.username);

    io.to(socket.room).emit("update room metadata", getRoomWithID(id));
  }


  socket.on('kill room', function (data) {
    if(ourHero.owns == socket.room) {
      socket.emit("update", ourHero.username + "wants to end the chat");
      io.to(socket.room).emit("set roomAvailable", false);
      getRoomWithID(socket.room).killRoom();
    }
    else {
      socket.emit("update", "ur not the owner omg freakin buzz off");
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    if(ourHero.hostof == socket.room) { //we only give a shit if they are a host
      socket.broadcast.to(socket.room).emit('typing', {
        username: ourHero.username
      });
    }
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {

    if(ourHero.hostof == socket.room) { //we only give a shit if they are a host
      socket.broadcast.to(socket.room).emit('stop typing', {
        username: ourHero.username
      });
    }
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global people list
    var roomForDeletingUser;
    console.log("ourHero ("+ourHero.username+") is disconnecting");
    if (ourHero) {
      roomForDeletingUser = getRoomWithID(ourHero.inroom);

      if(roomForDeletingUser){
        console.log("roomForDeletingUser exists");

        if(ourHero.hostof == null) { //fan
          console.log(ourHero.username+" was just a FAN so going to remove them from the room");
          roomForDeletingUser.removeFan(ourHero.id);
          io.to(socket.room).emit("update room metadata", roomForDeletingUser);

        } 
        else if(ourHero.owns == null) { //host
          console.log(ourHero.username+" was just a HOST so going to remove them from the room");
          roomForDeletingUser.removeHost(ourHero.id);
          io.to(socket.room).emit("update room metadata", roomForDeletingUser);
        }
        else { //owner
          // var newOwner = roomForDeletingUser.removeOwner(ourHero.id);
          io.to(socket.room).emit("tell client owner left", ourHero.username+" left, so this room is now dead.  Join another room or start your own conversation");
          roomForDeletingUser.killRoom();

          //the owner left so were going to delete the room
          rooms = _.without(rooms, roomForDeletingUser);
          // roomForDeletingUser.killRoom();  //this would be to archive it. revisit this when we build profile pages
          delete roomForDeletingUser;
        }
      }

      io.sockets.emit("update roomsList", rooms);
      io.sockets.emit("update", "brother "+ourHero.username+" is no longer with us");

      people = _.without(people, ourHero);
      delete ourHero;

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
