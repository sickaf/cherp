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
  var $usernameInput = $('.usernameInput'); // Input for username
  var $hostMessages = $('.hostMessages'); // host messages area
  var $fanMessages = $('.fanMessages'); // fan messages area
  var $inputMessage = $('.inputMessage'); // Input message input box
  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  // Prompt for setting a username
  var username;
  var iAmHost = false; //this probably needs to be kept by the server
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage (data) {
    var message = '';
    
    //if there is a list of users, print them out.
    if ("usernames" in data){
        var usernamesList = data.usernames
        var names = "";

        for (var key in usernamesList) 
        {
            if (usernamesList.hasOwnProperty(key)) 
            {
                names += " " + key;
            }
        }
        log("there are " + data.numUsers + " people here: " + names);
    }

    if (data.numUsers === 1) {
      iAmHost = true;
      message += "you're the host";
      log(message)
    } 
  }

  // Sets the client's username
  function setUsername () {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage () {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      
      if(iAmHost) 
      {
        addHostMessage({
          username: username,
          message: message
        });

        // tell server to execute 'new message' and send along one parameter
        socket.emit('new host message', message);
      }
      else 
      {
        addFanMessage({
          username: username,
          message: message
        });
        
        // tell server to execute 'new fan message' and send along one parameter
        socket.emit('new fan message', message);
      }
    }
  }

  // Log a message
  function log (message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }


 // Adds the visual chat image to the message list
  function addHostImage (from, base64Image) {


    var $usernameDiv = $('<span class="username"/>')
      .text(from)
      .css('color', getUsernameColor(from));

    var $messageBodyDiv = $('<span class="messageBody">')
      .append('<img src="' + base64Image + '"/>');

    var $messageDiv = $('<li class="message"/>')
      .data('username', from)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv);
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
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var repostClass = data.repost ? 'repost' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .addClass(repostClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

 // Adds the visual fan message to the message list
  function addFanMessage (data, options) {

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .append($usernameDiv, $messageBodyDiv);

    //sets up a listener so that if the host clicks it, it gets copied to the host's messages
    $messageDiv.click(function () {
      if(iAmHost){
        data.repost = true;
        addHostMessage(data);
        socket.emit('host repost', data);
      }
      else {
        log("youre not the host... faggot");
      }
    });

    addFanMessageElement($messageDiv, options);
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement (el, options) {
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
      $hostMessages.prepend($el);
    } else {
      $hostMessages.append($el);
    }
    $hostMessages[0].scrollTop = $hostMessages[0].scrollHeight;
  }

 // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addFanMessageElement (el, options) {
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
      $fanMessages.prepend($el);
    } else {
      $fanMessages.append($el);
    }
    $fanMessages[0].scrollTop = $fanMessages[0].scrollHeight;
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
    if (connected) {
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

  //this wont work for dates or arrays
  function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}


  ////////////////////////////////////////////////////
  //////////////////////////////////////////////////
  //////////////////////////////////////////////////
  //////////////////////////////////////////////////
  // dom manipulation code to send images
  // THIS NEEDS TO BE UPDATED TO NOT LOOK SO GAY
  //
  $(function () {
    $('#imagefile').bind('change', function(e){
      var data = e.originalEvent.target.files[0];
      var reader = new FileReader();
      reader.onload = function(evt){
        if(iAmHost)
        {
          addHostImage("me", evt.target.result);
          socket.emit('new host image', evt.target.result);
        }
        else {
          log("YOURE NOT THE FUCKING HOST.  Not going to send that image");
        }
      };
      reader.readAsDataURL(data);
    });
  });
  //////////////////////////////////////////////////
  //////////////////////////////////////////////////
  //////////////////////////////////////////////////
  //////////////////////////////////////////////////


  // Keyboard events

  $window.keydown(function (event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });

  $inputMessage.on('input', function() {
    //we're only interested in typing events for the hosts
    if(iAmHost) {
          updateTyping();
    }
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function () {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function () {
    $inputMessage.focus();
  });
  

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function (data) {
    connected = true;
    // Display the welcome message
    var message = "Hi.  This is Cherp by sick.af";
    log(message, {
      prepend: true
    });

    if ("hostName" in data && data.numUsers > 1) {
      log("The host is " + data.hostName);
    };

    addParticipantsMessage(data);
  });

  //receive host image from server
  socket.on('new host image', function(from, base64Image) {
    addHostImage(from, base64Image);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new host message', function (data) {
    addHostMessage(data);
  });

  // Whenever the server emits 'new fan message', update the chat body
  socket.on('new fan message', function (data) {
    addFanMessage(data);
  });

    // Whenever the server emits 'host repost', update the chat body
  socket.on('host repost', function (data) {
    addHostMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function (data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeHostTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function (data) {
    addHostTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function (data) {
    removeHostTyping(data);
  });
});
