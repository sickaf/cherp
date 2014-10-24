// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

//temporary.  needs to be updated
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/cherp');

app.use(function(req, res, next) {
  req.db = db;
  next();
});

////////////////
// var routes = require('./routes/index');
// var users = require('./routes/users');
////////////////


server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
  res.render('index.html');
});

app.get('/fartmanshit', function(req, res) {
  res.render('index.html');
});




// var router = express.Router();
// app.get('/:name', function(req, res) {
//   res.send('hello ' + req.params.name + '!');
// });

/* GET Userlist page. */
app.get('/messagelist', function(req, res) {
    var db = req.db;
    var collection = db.get('messagecollection');
    collection.find({},{},function(e,docs){
      socket.broadcast.emit('add database messages', data);
    });
});

var app = express();

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;
var hostName = "hostName not set lol";

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
    usernames[username] = username;
    
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
      usernames: usernames
    });
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
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
