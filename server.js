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
var MongoStore = require('express-session-mongo')
var passport = require('passport');
var flash    = require('connect-flash');
var path = require('path');
var logger = require('morgan'); //hoping this will make debugging easier
var _ = require('underscore')._; //tool for doing things like calling .size on an array
var uuid = require('node-uuid'); //for generating IDs for things like rooms

var Room = require('./room.js');

//
// database variables
//
var mongoose = require('mongoose');
var configDB = require('./config/database.js')
// var mongo = require('mongodb');
// var monk = require('monk');
// var db = monk('localhost:27017/cherp');
var messageData;

var Room = require('./room.js');

// configuration ===============================================================

mongoose.connect(configDB.url);

require('./config/passport')(passport); // pass passport for configuration

// allows us to parse the HTML body. currently used to parse newmessage.html
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//i think we need this to print the stack trace in the event of an error
app.use(logger('dev'));

app.use(cookieParser());

// passport
app.use(session({
  cookie : {
    maxAge: 3600000 // see below
  },
  secret: 'devon is gay', // session secret
  resave: true,
  saveUninitialized: true,
  store : new MongoStore({ db: 'cherp' })
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

//
// Make our db accessible to our router and populate messageData with stored messages
//
// app.use(function(req, res, next) {
//   req.db = db;
//   var collection = db.get('messagecollection');
//     collection.find({},{},function(e,docs){
//       messageData = docs;
//   });
//   next();
// });

//
// Routing
//
// app.use(express.static(__dirname + '/public'));
require('./routes/routes.js')(app, passport); // pass in app and passport
app.use(express.static(path.join(__dirname, 'public')));

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
// error handlers
//
// development error handler -- will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler -- no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

//
// Chatroom
//

// people which are currently connected to the chat
var people = {}; 
var numUsers = 0; //deprecate this
var hostName = "hostName not set lol"; //deprecate this

var rooms = {};
var sockets = [];

io.on('connection', function (socket) {
  
  var addedUser = false;

  //Received an image: broadcast to all
  socket.on('new host image', function (data) {
    socket.broadcast.emit('new host image', people[socket.id].username, data);
  });

  // when the client emits 'new host message', this listens and executes
  socket.on('new message', function (data) {

    if(people[socket.id].owns == socket.room) {
      // socket.emit("update", "sending HOST message. socket.room: "+socket.room+ " and you own "+people[socket.id].owns);
  
      io.sockets.in(socket.room).emit("new host message", {
        username: people[socket.id].username,
        message: data
      });

    }
    else {
      // socket.emit("update", "sending FAN message. socket.room: "+socket.room+ " and you own "+people[socket.id].owns);
      io.sockets.in(socket.room).emit("new fan message", {
        username: people[socket.id].username,
        message: data
      });
    }
  });

  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    if(people[socket.id].owns == socket.room) {
      io.sockets.in(socket.room).emit('host repost', data);
    }
    else {
      socket.emit("update", "ur not the host lol pull out homie");
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {

    //set the hostname
    // if(_.size(people) === 0) {
    //   hostName = username;
    // }

    ++numUsers;
    addedUser = true;

    people[socket.id] = {"username" : username, "owns" : null, "inroom": null};
    socket.emit("update", "You have connected to the server");
    io.sockets.emit("update", people[socket.id].username + " is online.")
    sizePeople = _.size(people);
    sizeRooms = _.size(rooms);
    socket.emit("update", "people.size: "+sizePeople);
    socket.emit("update", "people are: "+JSON.stringify(people));
    socket.emit("update", "rooms.size: "+sizeRooms);
    sockets.push(socket);

    //sets connected = true and displays welcome messages
    socket.emit('login', {
      numUsers: numUsers,
      hostName: hostName
    });

    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: people[socket.id].username,
      numUsers: sizePeople
    });

    socket.emit('add database messages', messageData);
  });

  socket.on('enter chat', function (chatname) {

    if (people[socket.id].inroom) {
      socket.emit("update", "You are already in a room.");
    }
    else if (people[socket.id].owns) {
      socket.emit("update", "You already own a room! This is madness!");
    }
    else { //LETS DO THIS
            
      //what if the chatroom already exists!!
      if(chatname in rooms) { 
        socket.emit("update", chatname + " already exists.  adding you as a fan");
        rooms[chatname].addFan(people[socket.id].username);
        people[socket.id].inroom = chatname;
      }
      else { //room doesnt exist. create it
        socket.emit("update", chatname + " doesnt exist.  adding you as host");

        var id = uuid.v4();
        var room = new Room(chatname, id, people[socket.id]);
        rooms[chatname] = room;
        //add room to socket, and auto join the creator of the room
        people[socket.id].owns = chatname;
      }

        socket.room = chatname;
        socket.join(socket.room);
        socket.emit("update", "Welcome to " + chatname + ".");
    }
  });


  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: people[socket.id].username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: people[socket.id].username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global people list
    var usernameToDelete;
    if (addedUser) {
      usernameToDelete = people[socket.id].username;
      delete people[socket.id];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: usernameToDelete,
        numUsers: numUsers
      });
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
