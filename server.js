// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;
var bodyParser = require('body-parser');
var logger = require('morgan'); //hoping this will make debugging easier


var Room = require('./room.js');


//
// database variables
//
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/cherp');
var messageData;

// allows us to parse the HTML body. currently used to parse newmessage.html
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//i think we need this to print the stack trace in the event of an error
app.use(logger('dev'));

//
// Make our db accessible to our router and populate messageData with stored messages
//
app.use(function(req, res, next) {
  req.db = db;
  var collection = db.get('messagecollection');
    collection.find({},{},function(e,docs){
      messageData = docs;
  });
  next();
});

//
// Routing
//
app.use(express.static(__dirname + '/public'));
var routes = require('./routes/index');
app.use('/', routes);

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
var people = {};  //this should become people
var numUsers = 0; //deprecate this
var hostName = "hostName not set lol"; //deprecate this

var rooms = {};
var sockets = [];

io.on('connection', function (socket) {
  var addedUser = false;

  //Received an image: broadcast to all
  socket.on('new host image', function (data) {
    socket.broadcast.emit('new host image', socket.username, data);
  });

  // when the client emits 'new host message', this listens and executes
  socket.on('new host message', function (data) {
    // we tell the client to execute 'new host message'
    socket.broadcast.emit('new host message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'new fan message', this listens and executes
  socket.on('new fan message', function (data) {
    // we tell the client to execute 'new fan message'
    socket.broadcast.emit('new fan message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'host repost', this listens and executes
  socket.on('host repost', function (data) {
    socket.broadcast.emit('host repost', data);
  });

    // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    people[username] = username;
    
    //set the hostname
    if(numUsers === 0) {
      hostName = username;
    }

    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers,
      hostName: hostName
    });
    // echo globally (all clients) that a person has connected

    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers,
      usernames: people
    });

    socket.emit('add database messages', messageData);

  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global people list
    if (addedUser) {
      delete people[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});

module.exports = app; 