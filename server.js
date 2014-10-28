// set up ======================================================================
// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var passport = require('passport');
var flash    = require('connect-flash');
var path = require('path');
var logger = require('morgan'); //hoping this will make debugging easier
var _ = require('underscore')._; //tool for doing things like calling .size on an array
var uuid = require('node-uuid'); //for generating IDs for things like rooms

//
// database variables
//
var mongoose = require('mongoose');
var configDB = require('./config/database.js')

// configuration ===============================================================

mongoose.connect(configDB.url, configDB.options);

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
  cookie : {
    maxAge: 3600000 // see below
  },
  secret: 'devon is gay', // session secret
  resave: true,
  saveUninitialized: true,
  store : require('mongoose-session')(mongoose)
});
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

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
var rooms = {};
var sockets = [];

      //socket.broadcast.to(socket.room).emit("new host message", {


function getPeopleList () {
  var toReturn = "";
  var first = true;
  for (var key in people) {
    if (people.hasOwnProperty(key)) {
      if (first) {
        toReturn = people[key].username;
        first = false;
      } else {
        toReturn += ", " + people[key].username;
      }
    }
  }
  return toReturn;
}

io.on('connection', function (socket) {

  var ourHeroID;
  var authorizedUser = socket.request.session.passport.user;
  if (authorizedUser) {
      console.log('socket connecton from twitter user');
      ourHeroID = authorizedUser;
  }
  else {
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
      rooms[socket.room].hostMessages.push(fullMessage);
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
      socket.broadcast.to(socket.room).emit("new host message", fullMessage);
      rooms[socket.room].hostMessages.push(fullMessage);
    }
    else {
      socket.broadcast.to(socket.room).emit("new fan message", fullMessage);
    }
  });

  // when the client emits 'make host', this listens and executes
  socket.on('make host', function (username) {
    
    if(ourHero.owns == socket.room) {

      var userToUpgrade = _.where(people, {username: username});
      var roomForUpgrade = rooms[ourHero.owns];

      roomForUpgrade.promoteFanToHost(userToUpgrade.id);

      socket.emit("update", "just made "+username+" a host.");
      socket.broadcast.to(socket.room).emit("set iAmHost", username, true); 
    }
    else {
      socket.emit("update", "ur not the host u cant upgrade people");
    }
  });

  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    if(ourHero.owns == socket.room) {
      socket.broadcast.to(socket.room).emit('host repost', data);
      rooms[socket.room].hostMessages.push(data);
    }
    else {
      socket.emit("update", "ur not the host lol pull out homie");
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (user) {

    addedUser = true;
    ourHero = { "id" : user.id,
                "socketID" : socket.id, 
                "username" : user.username, 
                "owns" : null, 
                "inroom": null};
    people.push(ourHero);

    socket.emit("update", "ourhero is "+JSON.stringify(ourHero));

    //messaging
    io.sockets.emit("update", ourHero.username + " is online.");
    socket.emit('login', "Welcome to the world. You have connected to the server. People are: "+getPeopleList()); //sets connected = true
    
    sockets.push(socket);

  });

  // when the client emits 'add username', this listens and executes
  socket.on('add username', function (user) {
    ourHero.username = user.username;
  });

  socket.on('enter chat', function (chatname) {

    socket.emit("update", "ourHero has the username "+ourHero.username + " and wants to enter chat: "+chatname);

    if (ourHero.owns) {
      socket.emit("update", "You already own a room! This is madness!");
    }
    else if (ourHero.inroom) {
      socket.emit("update", "You are already in a room.");
    }
    else { //LETS DO THIS  
      //what if the chatroom already exists!!
      if(chatname in rooms) {
        var existingRoom = rooms[chatname];
        if(existingRoom.peopleNum == 0) {
          rooms[chatname].addHost(ourHero);
          socket.emit("set iAmHost", ourHero.username, true); 
          socket.emit("update", "the room "+chatname + " already exists.  adding you as a HOST. now "+chatname + " has "+rooms[chatname].peopleNum+" people");
        }
        else {
          rooms[chatname].addFan(ourHero);
          socket.emit("update", "the room "+chatname + " already exists.  adding you as a FAN. now "+chatname + " has "+rooms[chatname].peopleNum+" people");
        }

        //fill the new user in on old messages
        for(var i = 0; i < rooms[chatname].hostMessages.length; i++) {
          socket.emit("new host message", rooms[chatname].hostMessages[i]);
        }
      }
      else { //room doesnt exist. create it
        socket.emit("update", "the room "+chatname + " doesnt exist yet.  adding you as host");

        var id = uuid.v4();
        var room = new Room(chatname, id, ourHero);
        socket.emit("update", "ourhero owns "+ourHero.owns);

        rooms[chatname] = room;
        //add room to socket, and auto join the creator of the room
        socket.emit("set iAmHost", ourHero.username, true); 
      }
      socket.emit("update", "there are now "+_.size(rooms)+" rooms ");
      socket.room = chatname;
      socket.join(socket.room);
    }
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined chat', {
      username: ourHero.username,
      chatname: chatname
    });
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
    var usernameToDelete;
    var roomForDeletingUser;
    if (addedUser) {
      roomForDeletingUser = rooms[socket.room];

      if(ourHero.owns == null) {
        roomForDeletingUser.removeFan(ourHero.username);
      } else {
        var newHost = roomForDeletingUser.removeHost(ourHero.username);
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
