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
    secret: 'devon is gay', // session secret
    resave: true,
    saveUninitialized: true
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

    if(people[socket.id].username == hostName) {
      socket.emit("update", "sending HOST message. hostname: "+hostName+ " and you are "+people[socket.id].username);
      socket.broadcast.emit('new host message', {
        username: people[socket.id].username,
        message: data
      });
    }
    else {
      socket.emit("update", "sending FAN message. hostname: "+hostName+ " and you are "+people[socket.id].username);
      socket.broadcast.emit('new fan message', {
        username: people[socket.id].username,
        message: data
      });
    }
  });

  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    socket.broadcast.emit('host repost', data);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {

    var ownerRoomID = null;
    var inRoomID = 69;

    //set the hostname
    if(_.size(people) === 0) {
      hostName = username;
      ownerRoomID = 69;
    }

    ++numUsers;
    addedUser = true;

    people[socket.id] = {"username" : username, "owns" : ownerRoomID, "inroom": inRoomID};
    socket.emit("update", "You have connected to the server and are owner of room # " + ownerRoomID);
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
      numUsers: sizePeople,
      usernames: ["no longer keeping track this way"]
    });

    socket.emit('add database messages', messageData);
  });

  // socket.on('enter chat', function (chatname) {

  //     // var id = uuid.v4();
  //     var existingChat = rooms[chatname];
  //     if(existingChat) {
  //       existingChat[chatname].addFan(people[socket.id].username);
  //     }
  //     else {
  //       var id = uuid.v4();
  //       var room = new Room(chatname, id, people[socket.id].username);
  //       rooms[id] = room;
  //       //add room to socket, and auto join the creator of the room
  //       people[socket.id].owns = id;
  //     }
  //       socket.room = chatname;
  //       socket.join(socket.room);
  //       people[socket.id].inroom = id;
  //       socket.emit("new host message", "Welcome to " + room.name + ".");
  //       socket.emit("sendRoomID", {id: id});  
  // });


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