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

// //
// // error handlers
// //
// // development error handler -- will print stacktrace
// if (app.get('env') === 'development') {
//     app.use(function(err, req, res, next) {
//         res.status(err.status || 500);
//         res.render('error', {
//             message: err.message,
//             error: err
//         });
//     });
// }

// // production error handler -- no stacktraces leaked to user
// app.use(function(err, req, res, next) {
//     res.status(err.status || 500);
//     res.render('error', {
//         message: err.message,
//         error: {}
//     });
// });

//
// Chatroom
//

// people which are currently connected to the chat
var Room = require('./room.js');
var people = []; 
var rooms = [];
var sockets = [];

      //socket.broadcast.to(socket.room).emit("new host message", {

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
  // RoomModel.findOne({ 'id' : roomID }, function(err, room) {
  RoomModel.findOne({ 'name' : name }, function(err, room) {
  if (err)
    console.log("database ERR: "+err);
  if (room) {
    console.log("database found room with name: "+room.name);
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

          } else {console.error("NO USER io.on connection");}
      } else {console.error("NO PASSPORT io.on connection");}
  } else {console.error("NO SESSION io.on connection");}

  if (!ourHeroID) {
    console.log('socket connecton from anon user, generating temp ID');
    ourHeroID = uuid.v4();
  }

  console.log('hero id: ' + ourHeroID);

  var ourHero = { "id" : ourHeroID,
                  "socketID" : socket.id, 
                  "username" : "usernamenotset", 
                  "owns" : null, 
                  "inroom": null};

  people.push(ourHero);

  socket.emit("update", "ourhero is "+JSON.stringify(ourHero));

  //messaging
  socket.emit('login', "Welcome to the world. You have connected to the server. People are: "+getPeopleList()); //sets connected = true
  
  sockets.push(socket);

  var addedUser = true;  

  //Received an image: broadcast to all
  socket.on('new image', function (data) {
    var fullMessage = {
      username: ourHero.username,
      base64Image: data,
      image: true
    };

    if(ourHero.owns == socket.room) {
      io.sockets.in(socket.room).emit('new host message', fullMessage);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, fullMessage);
    }
    else  {
      socket.emit("update", "ur not the host get a day job");
    }
  });

  // when the client emits 'new host message', this listens and executes
  socket.on('new message', function (data) {

    var fullMessage = {
      username: ourHero.username,
      message: data
    };

    if(ourHero.owns == socket.room) {
      console.log(" ourhero owns : socket.room : "+ourHero.owns+" : "+socket.room);
      socket.broadcast.to(socket.room).emit("new host message", fullMessage);
      pushMessageToDB(getRoomWithID(socket.room).name, socket.room, fullMessage);
    }
    else {
      socket.broadcast.to(socket.room).emit("new fan message", fullMessage);
    }
  });

  // when the client emits 'make host', this listens and executes
  socket.on('make host', function (username) {
    
    if(ourHero.owns == socket.room) {

      var userToUpgrade = _.where(people, {username: username})[0];

      if(userToUpgrade.owns == null ) {
        var roomForUpgrade = getRoomWithID(ourHero.owns);
        roomForUpgrade.promoteFanToHost(userToUpgrade.id);
        socket.emit("update", "just made "+username+" a host.");
        socket.broadcast.to(socket.room).emit("set iAmHost", username, true); 
      }
      else {
        socket.emit("update", "that person is already a host hahahahahhahaha");
      }
    }
    else {
      socket.emit("update", "ur not the host u cant upgrade people");
    }
  });

  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    if(ourHero.owns == socket.room) {
      console.log(" hostrepost ourhero owns : socket.room : "+ourHero.owns+" : "+socket.room);
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

  socket.on('enter chat', function (chatname) {

    if (ourHero.owns) {
      socket.emit("update", "You already own a room! This is madness!");
      return;
    }

    //LETS DO THIS
    //socket.emit("clear messages", {});

    socket.emit("update", "ourHero ("+ourHero.username + ") wants to enter chat: "+chatname);

    if (ourHero.inroom) {
      socket.emit("update", "You are already in a room.  Going to remove you from room "+ourHero.inroom);
      getRoomWithID(ourHero.inroom).removeFan(ourHero.id);
    }

    //what if the chatroom already exists!!
    if(getRoomWithName(chatname)) {
      var existingRoom = getRoomWithName(chatname);
      if(existingRoom.peopleNum == 0) {
        getRoomWithName(chatname).addHost(ourHero);
        socket.emit("set iAmHost", ourHero.username, true); 
        socket.emit("update", "the room "+chatname + " already exists.  adding you as a HOST. now "+chatname + " has "+getRoomWithName(chatname).peopleNum+" people");
      }
      else {
        getRoomWithName(chatname).addFan(ourHero);
        socket.emit("update", "the room "+chatname + " already exists.  adding you as a FAN. now "+chatname + " has "+getRoomWithName(chatname).peopleNum+" people");
      }

      // RoomModel.findOne({ 'id' :  getRoomWithName(chatname).id}, function(err, room) {
    }
    else { //room doesnt exist. create it
      socket.emit("update", "the room "+chatname + " doesnt exist yet.  adding you as host");

      var id = uuid.v4();
      var room = new Room(chatname, id, ourHero);
      socket.emit("update", "ourhero owns "+ourHero.owns);
      rooms.push(room);
      //add room to socket, and auto join the creator of the room
      socket.emit("set iAmHost", ourHero.username, true); 
    }
    socket.leave(socket.room);
    socket.room = getRoomWithName(chatname).id;
    socket.join(socket.room);

    RoomModel.findOne({'name' : chatname}, function(err, room) {
      if (err)
        console.log("database ERR getting hostMessages: "+err);
      if (room) {
        console.log("database found room with name: "+room.name);
        socket.emit("add database messages", room.hostMessages);
      } else {
        console.log("database couldnt find "+chatname+" to load messages from");
      }
    });

    socket.broadcast.emit("update", ourHero.username+" is now in room "+chatname+". There are now "+_.size(rooms)+" rooms: "+getRoomList());
    io.sockets.emit("update roomsList", rooms);

  });

  socket.on('end chat', function (data) {
    if(ourHero.owns == socket.room) {
      socket.emit("update", ourHero.username + "wants to end the chat");
    }
    else {
      socket.emit("update", "ur not the own omg freakin buzz off");
    }
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    if(ourHero.owns == socket.room) { //we only give a shit if they are a host
      socket.broadcast.to(socket.room).emit('typing', {
        username: ourHero.username
      });
    }
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {

    if(ourHero.owns == socket.room) { //we only give a shit if they are a host
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

      if(ourHero.owns == null) {
        roomForDeletingUser.removeFan(ourHero.id);
      } else {
        var newHost = roomForDeletingUser.removeHost(ourHero.id);
        if(newHost) {
          socket.broadcast.to(socket.room).emit("set iAmHost", newHost.username, true); 
        }
      }


      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: ourHero.username,
        chatname: roomForDeletingUser.name,
        numUsers: _.size(people) - 1,
        numUsersInChat: roomForDeletingUser.peopleNum
      });
      io.sockets.emit("update roomsList", rooms);


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
