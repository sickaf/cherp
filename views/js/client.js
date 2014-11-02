$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms

//http://flatuicolors.com/
  var COLORS = [
    '#1abc9c', '#2ecc71', '#3498db',            '#34495e',
    '#16a085',                       '#8e44ad',
    '#f1c40f', '#e67e22', '#e74c3c',            
               '#d35400', '#c0392b',            '#7f8c8d'  
  ];

  // Initialize varibles
  var $window = $(window);
  var $hostMessages = $('#hostMessages'); // host messages area
  var $fanMessages = $('#fanMessages'); // fan messages area
  var $inputMessage = $('#chat_input'); // Input message input box
  var $sendButton = $('#send_button');
  var $chatRoomField = $('#chat-room-field');
  var $trendingRoomsDiv = $('#trending-rooms');
  var $createRoomButton = $('#create-room-button');
  var $hostLabel = $("#host-label");
  var $membersLabel = $("#members-label");

  // Prompt for setting a username
  var username = user.username;
  var chatname;
  var iAmHost = false;
  var currentlyInRoom = false;
  var typing = false;
  var lastTypingTime;

  var socket = io();

  socket.emit('set username', username);

  var ownerName = user.wantsToJoin;

  if (ownerName) {
    console.log("OWNER NAME EXISTS");
    socket.emit('join chat by owner', ownerName);
  } else {
    console.log("NEITHER EXISTS");
    socket.emit('join trending chat', null);
  }


  $('#create-room-button').click(function() {
      socket.emit('enter chat with id', null);
  });

  //someone needs to get rid of this dumb function
  function addParticipantsMessage (data) {
    var message = '';

    log("there are " + data.numUsers + " people in this room.");

    if (data.numUsers === 1) {
      iAmHost = true;
      message += "you're the host";
      log(message)
    } 
  }

  function addChatroomUpdate (data) {
    var message = '';

    log("there are " + data.numUsers + " people in this room.");

    if (data.numUsers === 1) {
      iAmHost = true;
      message += "you're the host";
      log(message)
    } 
  }

  function updateRoomsList (data, options) {
    $trendingRoomsDiv.html("");
    for (var i = 0; i <data.length; i++) {
      addRoomToRoomsList(data[i]);
    }
  }

  function addRoomToRoomsList(room){
    var $roomDiv = $('<li><a href="#">'+room.name+' ('+room.peopleNum+')</a></li>');
    $roomDiv.click(function () {
      socket.emit('enter chat with id', room.id);
      return false;
    });
    $trendingRoomsDiv.append($roomDiv);
  }

  // Sets the chatname
  /*
  * 
  * 
  * DEPRECATED
  * 
  * 
  */
  // function setChatname (name) {
  //     // Tell the server your chatname
  //     socket.emit('enter chat', name);
  // }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message) {
      $inputMessage.val('');  
      socket.emit('new message', message);

      if(currentlyInRoom) {

        if(iAmHost) {
          addHostMessage({
            username: username,
            message: message
          });
        } else {
          addFanMessage({
            username: username,
            message: message
          });
        }
      } 
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li class="list-group-item list-group-item-info log-message">').addClass('log').text(message);
    addHostMessageElement($el, options);
  }

  function clearMessages () {
    $hostMessages.html("");
    $fanMessages.html("");
  }

  // helper function for sending whatever is in the text field and for clearing it
  function sendTextFieldMessage() {
    sendMessage($inputMessage.val());
    socket.emit('stop typing');
    typing = false;
    $inputMessage.val('');
    $inputMessage.focus();
  }

  // Adds the visual chat message to the message list
  function addHostMessage (data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }
    
    var $usernameDiv = $('<span class="username"/>')
      .text(data.username + ' ')
      .css('color', getUsernameColor(data.username));

    //set up a listener so that if the own clicks this div they will become demoted to a fan
    $usernameDiv.click(function () {
      socket.emit('demote host', data.username);
    });

    var $messageBodyDiv;
    
    //if it's an image, do that
    if(data.image) {
      $messageBodyDiv = $('<span class="messageBody">')
      .append('<img src="' + data.base64Image + '"/>');
    } else {
      var messageText = linkify(data.message, true);
      $messageBodyDiv = $('<span class="messageBody">')
      .append(messageText);
    }

    //set up a listener so that if the host clicks this div itll get forwarded
    $messageBodyDiv.click(function () {
      data.repost = true;
      socket.emit('host repost', data);
      if(iAmHost){
        addHostMessage(data);
      }
    });

    var typingClass = data.typing ? 'typing' : '';
    var repostClass = data.repost ? 'repost' : '';

    var $messageDiv = $('<li class="list-group-item message">')
      .data('username', data.username)
      .addClass(typingClass)
      .addClass(repostClass)
      .append($usernameDiv, $messageBodyDiv);

    addHostMessageElement($messageDiv, options);
  }

 // Adds the visual fan message to the message list
  function addFanMessage (data, options) {

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username + ' ')
      .css('color', getUsernameColor(data.username));
    
    //set up a listener so that if the host clicks this div they will become the host
    $usernameDiv.click(function () {
      socket.emit('promote fan', data.username);
    });

    var messageText = linkify(data.message, false);
    $messageBodyDiv = $('<span class="messageBody">')
      .append(messageText);

    //set up a listener so that if the host clicks this div itll get forwarded
    $messageBodyDiv.click(function () {
      data.repost = true;
      socket.emit('host repost', data);
      if(iAmHost){
        addHostMessage(data);
      }
    });

    var $messageDiv = $('<li class="list-group-item message"/>')
      .data('username', data.username)
      .append($usernameDiv, $messageBodyDiv);

    addFanMessageElement($messageDiv, options);
  }

  function addHostMessageElement (el, options) {
    addMessageElement(el, $hostMessages, options);
  }

  function addFanMessageElement (el, options) {
    addMessageElement(el, $fanMessages, options);
  }


  function addMessageElement (el, div, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      div.prepend($el);
    } else {
      div.append($el);
    }
    div[0].scrollTop = div[0].scrollHeight;
  }

  // Adds the visual chat typing message
  function addHostTyping (data) {
    data.typing = true;
    data.message = 'is typing';
    addHostMessage(data);
  }

  // Removes the visual chat typing message
  function removeHostTyping (data) {
    getTypingMessages(data).fadeOut(function () {
      $(this).remove();
    });
  }

  // Prevents input from having injected markup
  function cleanInput (input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping () {
    if (currentlyInRoom) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function () {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages (data) {
    return $('.typing.message').filter(function (i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor (username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
       hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // //this wont work for dates or arrays
  // /*
  // *
  // * DEPRECATED
  // *
  // */
  // function clone(obj) {
  //   if (null == obj || "object" != typeof obj) return obj;
  //   var copy = obj.constructor();
  //   for (var attr in obj) {
  //       if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
  //   }
  //   return copy;
  // }

  // Image uploader
  var opts = {
    dragClass: "#hostMessages",
    accept: 'image/*',
    on: {
      load: function(e, file) {

        if (file.type.match(/image/)) {
          socket.emit('new image', e.target.result);
        }

      },
      error: function(e, file) {
        alert("Sorry, there was an error");
      },
      groupstart: function(group) {
      },
      groupend: function(group) {
      }
    }
  };

  $("#imagefile, #dropzone").fileReaderJS(opts);
  $("body").fileClipboard(opts);

  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $inputMessage.focus();
    }

    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      sendTextFieldMessage();
    }
  });

  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events
  $sendButton.click(function() {
    sendTextFieldMessage();
  });

  // Socket stuff

  // Whenever the server emits 'login', log the login message
  socket.on('tell client owner left', function (msg) {
    currentlyInRoom = false;
    iAmHost = false;
    log(msg);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('update', function (data) {
    log(data);
  });

  socket.on('set iAmHost', function (usrname, bool) {
    if(username == usrname) {
      iAmHost = bool;
    }
  });

  socket.on('set currentlyInRoom', function (bool) {
    currentlyInRoom = bool;
  });

  // Whenever the server emits 'clear messages', update the chat body
  socket.on('clear messages', function (data) {
    clearMessages();
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new host message', function (data) {
    addHostMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('add database messages', function (data) {
    for(var i = 0; i < data.length; i++) {
      addHostMessage(data[i]);
    }
  });

   // Whenever the server emits 'new message', update the chat body
  socket.on('update roomsList', function (data) {
    updateRoomsList(data);
  });

  // Whenever the server emits 'new fan message', update the chat body
  socket.on('new fan message', function (data) {
    addFanMessage(data);
  });

    // Whenever the server emits 'host repost', update the chat body
  socket.on('host repost', function (data) {
    addHostMessage(data);
  });

  // Whenever the server emits 'user joined chat', log it in the chat body
  socket.on('user joined chat', function (data) {
    log(data.username + ' joined chatroom '+data.chatname);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left. they were in chatroom: '+data.chatname+". "+data.numUsers+" left, and "+data.numUsersInChat+" left in chatroom: "+data.chatname);
    removeHostTyping(data); //data must include data.username
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addHostTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeHostTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('update room metadata', function (room) {
    $membersLabel.text('Members: ' + room.peopleNum);
    var st = "Hosts: " + room.owner.username;
    for(var i = 0; i < room.hosts.length; i++) {
      st += ', ' + room.hosts[i].username;
    }
    $hostLabel.text(st);
  });

    ///////////////////////////////////////////////////////////////
  ///////                                                  //////
  ///////  LINK HELPERS                                    //////
  ///////                                                  //////
  ///////////////////////////////////////////////////////////////

  function getHostName(url) {
    var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 &&
        typeof match[2] === 'string' && match[2].length > 0) {
    return match[2];
    }
    else {
        return null;
    }
  }

  function getDomain(url) {
    var hostName = getHostName(url);
    var domain = hostName;
    
    if (hostName != null) {
        var parts = hostName.split('.').reverse();
        
      if (parts != null && parts.length > 1) {
          domain = parts[1] + '.' + parts[0];
            
         if (hostName.toLowerCase().indexOf('.co.uk') != -1
                 && parts.length > 2) {
           domain = parts[2] + '.' + domain;
         }
      }
    }
    return domain;
  }

  //Creates the embed code from a url
  function youtubify(url){
    return '//www.youtube.com/embed/' + url.substring(url.indexOf('v=')+2);
  }

  // Adds link html around hyperlinks 
  function linkify(text, shouldEmbed) {
    var urlRegex = /(((https?:\/\/)|(www\.))[^\s]+)/g;
    return text.replace(urlRegex, function(url,b,c) {
        var fullURL = (c == 'www.') ?  'http://' +url : url;

        if (shouldEmbed) {

          if (getHostName(fullURL) == 'youtube.com'){
            var divWidth = $hostMessages.width() - 40;
            var divHeight = divWidth * 0.75;
            return '<iframe width=' + '"' + divWidth + '"' + 'height=' + '"' + divHeight + '"' + 'src="'+ youtubify(fullURL) + '" frameborder="0" allowfullscreen></iframe>';
          }

          else if (getDomain(fullURL) == "imgur.com"){
            return '<a class="embedly-card" href="' + fullURL + '" </a> <script async src="//cdn.embedly.com/widgets/platform.js" charset="UTF-8"></script>';
          }
         else if (getDomain(fullURL) == "soundcloud.com"){
            return '<a class="embedly-card" href="' + fullURL + '"></a> <script async src="//cdn.embedly.com/widgets/platform.js" charset="UTF-8"></script>';
          }
       } 
      return '<a href="' +fullURL+ '" target="_blank">' + url + '</a>';
    }) 
  } 
});

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