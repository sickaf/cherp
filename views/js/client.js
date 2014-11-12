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
  var $chatRoom = $('#chatRoom'); // fan messages area
  var $inputMessage = $('#chat_input'); // Input message input box
  var $sendButton = $('#send_button');
  var $chatRoomField = $('#chat-room-field');
  var $trendingRoomsDiv = $('#trending-rooms');
  var $createRoomButton = $('#create-room-button');
  var $hostLabel = $("#host-label");
  var $membersLabel = $("#members-label");
  var $textGroup = $(".text-input");
  

  // Prompt for setting a username
  var username = null;
  var chatname;
  var id = null;
  var iAmHost = false;
  var currentlyInRoom = false;
  var typing = false;
  var lastTypingTime;
  var currentHosts;
  var currentRoomID;

  var socket = io();
  
  if (user.wantsToJoin) {
    socket.emit('join chat by owner', user.wantsToJoin);
  } else {
    socket.emit('join trending chat');
  }

  $('#create-room-button').click(function() {
    smoke.prompt("Name your room", function(e){
      if (e) { 
        socket.emit('enter chat with id', { id : null, name : e});
      } 
      }, {
      ok: "Create Conversation",
      cancel: "Cancel",
      classname: "room-name-field",
      value: randomRoomName()
    });
  });

  $('#twitter-signin').click(function() {
    window.location.replace("/auth/twitter");
  });


  ///////////////////////////////////////////////////////////////
  ///////                                                  //////
  ///////  PROFILE FUNCTIONS                               //////
  ///////                                                  //////
  ///////////////////////////////////////////////////////////////

  $('#profile-link').click(function () {
      $("#profile-dropdown").click()
      showProfileForMe();
      return false;  
  });

  function showProfileForMe() {

      // Set username title regardless of user
      $('.modal-title').text(username);

      // Set appropriate info
      setProfileInfoForUser(user);

      // Show the profile
      $('#profile-modal').modal('show');

      // Get archived chats
      getArchivedChatsAndDisplayInProfileForUser(user._id);
  }

  // global variables used to reference requests so we can cancel them if profile is closed before they finish
  var profileRequest;
  var archivesRequest;

  function showProfileForUser(data) {

    // Set username title regardless of user
    $('.modal-title').text(data.username);
    // Bio text should be loading...
    $('.profile-bio').text('Loading...');

    // Show profile
    $('#profile-modal').modal('show');

    // Retrieve profile data and update profile
    var url = "/api/v1/profile/"+data.id;
    profileRequest = $.getJSON(url, {}, function(result) {

      setProfileInfoForUser(result);

    });

    getArchivedChatsAndDisplayInProfileForUser(data.id);
  }

  function setProfileInfoForUser(thisUser) {
    // Check if we're the logged in user we want to see the profile for
      $('.modal-title').text(thisUser.username);
      $('.profile-bio').text(thisUser.bio);
      $('#profile-avatar').attr('src', thisUser.avatar_url);
      $('#profile-twitter-link').attr('href', 'https://twitter.com/' + thisUser.twitter.username).attr("target", "_blank");
  }

  $('#profile-modal').on('hidden.bs.modal', function (e) {

      // abort all REST requests currently in process
      if (profileRequest) {
        profileRequest.abort();
      };
      
      archivesRequest.abort();

      $('.archived-chats-list').empty();
      var $loadingDiv = $('<li id="loading">Loading...</li>');
      $('.archived-chats-list').append($loadingDiv);

      $('.modal-title').text('');
      $('.profile-bio').text('');
      $('#profile-avatar').attr('src', '');
      $('#profile-twitter-link').attr('href', '#').attr("target", "_blank");
  })

  function getArchivedChatsAndDisplayInProfileForUser(userID) {
      // Get archived chat info
      var url = "/api/v1/profile/archives/"+userID;
      archivesRequest = $.getJSON(url, {}, function(data) {

        if (data.length == 0) {
          $('#loading').text('No archived chats');
          return;
        }

        $('#loading').hide();
        $.each(data, function(index, element) {
          var $roomDiv = constructArchiveDiv(element);
          $('.archived-chats-list').append($roomDiv);
        });
    });
  }

  function constructArchiveDiv(element) {

      // create an element with an object literal, defining properties
      var listItem = $("<li />", {
        "class": "list-group-item archive-list",
      });

      var row = $('<div class="row" id="archive-chat-row" />');
      var col = $('<div class="col-md-10 panel" />');
      var col2 = $('<div class="col-md-2 panel" id="delete-column" />');

      var title = $("<h4 />");

      var linkItem = $("<a />", {
        href: '',
        "class": "archive-link",
        text: element.name
      });

      linkItem.click(function() {
        switchToArchivedRoom(element.id)
        $('#profile-modal').modal('hide');
        $('#profile-dropdown').click();
        return false;
      });

      title.append(linkItem);

      var c = new Date(element.created_at).yyyymmdd();
      
      var created = $("<h5 />", {
        text: c
      });
      
      col.append(title);
      col.append(created);

      var button = $('<button type="button" class="btn btn-danger" id="archive-delete-button">Delete</button>');
      button.on('click', function() {
        var url = '/api/v1/archives/' + element.id;
        listItem.remove();
        $.ajax({
            url: url,
            type: 'DELETE'
        });
      });

      col2.append(button);

      row.append(col);
      row.append(col2);
      listItem.append(row);

      return listItem;
  }

  ///////////////////////////////////////////////////////////////
  ///////                                                  //////
  ///////  UI HELPERS                                      //////
  ///////                                                  //////
  ///////////////////////////////////////////////////////////////

  // Enable or disable nav buttons if user is logged in or not
  function configureRightNavBar () {
    if (!user.twitter) {
      $("#right-nav-signed-out").show();
      $("#username-label").text('You are currently anonymous (' + username + ')');
    }
    else {
      $("#right-nav-signed-in").show();
      $("#username-label").text('signed in as ' + username);
    }
  }

  //someone needs to get rid of this dumb function
  function addParticipantsMessage (data) {
    var message = '';

    normalLog("there are " + data.numUsers + " people in this room.");

    if (data.numUsers === 1) {
      iAmHost = true;
      message += "you're the host";
      normalLog(message)
    } 
  }

  function addChatroomUpdate (data) {
    var message = '';

    normalLog("there are " + data.numUsers + " people in this room.");

    if (data.numUsers === 1) {
      iAmHost = true;
      message += "you're the host";
      normalLog(message)
    } 
  }

  function updateRoomsList (data, options) {
    $trendingRoomsDiv.html("");
    if(data.length == 0) {
      $trendingRoomsDiv.append($('<li class="trending-room">no rooms yet</li>'));
      if(!$chatRoom.is(":visible")) {
        $("#noRoomsImage").show();
      }
    }

    for (var i = 0; i <data.length; i++) {
      addRoomToRoomsList(data[i]);
    }
  }

  function addRoomToRoomsList(room){
    var $roomDiv = $('<li class="trending-room"><a>'+room.owner.username+' ('+room.peopleNum+')</a></li>');

    $roomDiv.click(function () {
      switchToRoom(room.id);
      return false;
    });
    $trendingRoomsDiv.append($roomDiv);
  }

  function switchToRoom(roomID) {
    currentHosts = null;
    currentRoomID = null;
    socket.emit('enter chat with id', { "id" : roomID, "name" : null});
  }

  function switchToArchivedRoom(roomID) {
    currentHosts = null;
    currentRoomID = null;
    socket.emit('enter archived chat', roomID);
  }

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
            message: message,
            id: id,
            avatar_url: user.avatar_url
          });
        } else {
          addFanMessage({
            username: username,
            message: message,
            id: id,
            avatar_url: user.avatar_url,
            anon: !user.twitter
          });
        }
      } 
    }
  }

  // Log a message
  function normalLog (message, options) {
    log('list-group-item-info', message, options);
  }

  function dangerLog (message, options) {
    log('list-group-item-danger', message, options);
  }

  function successLog(message, options) {
    log('list-group-item-success', message, options);
  }

  function log (type, message, options) {
    var $el = $('<li class="list-group-item ' + type +  ' log-message">').addClass('log').text(message);
    addHostMessageElement($el, options);
  }

  function showToastNotification (type, title, message) {
    toastr.options = {
      "debug": false,
      "positionClass": "toast-bottom-left",
      "onclick": null,
      "fadeIn": 300,
      "fadeOut": 300,
      "timeOut": 2000,
      "extendedTimeOut": 1000
    }
    switch (type) {
      case 'info':
        toastr.info(message, title);
        break;
      case 'warning':
        toastr.warning(message, title);
        break;
      case 'success':
        toastr.success(message, title);
        break;
      case 'error':
        toastr.error(message, title);
        break;
      default:
        toastr.info(message, title);
        break;
    }
  }

  function showFullscreenNotification(message) {
    smoke.signal(message, function(e){
    }, {
      duration: 2000,
      classname: "custom-class"
    });
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

    if (data.avatar_url) $avatarDiv = $('<img/>').attr('src', data.avatar_url);
    else $avatarDiv = $('<div/>').css('background-color', getUsernameColor(data.username));
    $avatarDiv.attr('id', 'host-avatar');
    
    var $usernameDiv = $('<span class="username"/>')
      .text(data.username + ' ')
      .css('color', getUsernameColor(data.username));

    var $messageBodyDiv;
    
    //if it's an image, do that
    if(data.base64Image) {
      $messageBodyDiv = $('<span class="messageBody">')
      .append('<img src="' + data.base64Image + '"/>');
    } else {
      var messageText = linkify(data.message, true);
      $messageBodyDiv = $('<span class="messageBody">')
      .append(messageText);
    }

    $menuDiv = getMenuDiv(data, false);

    var typingClass = data.typing ? 'typing' : '';
    var repostClass = data.repost ? 'repost' : '';


    var $messageDiv = $('<li id="'+data.id+'" class="list-group-item message dropdown-toggle" id="dropdownMenu1" data-toggle="dropdown"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .addClass(repostClass)
      .append($avatarDiv, $usernameDiv, $messageBodyDiv);

    var $parentDiv = $('<div class="dropdown"/>')
      .append($messageDiv, $menuDiv);

    addHostMessageElement($parentDiv, options);
  }

  function getMenuDiv(data, forFan) {
    $repostItem = $('<li role="presentation"><a role="menuitem">Forward Message</a></li');
    $repostItem.click(function () {
      data.repost = true;
      socket.emit('host repost', data);
      if(iAmHost) addHostMessage(data);
    });   

    $promoteMenuItem = forFan ? $('<li role="presentation"><a role="menuitem">Make Host</a></li') : $('<li role="presentation"><a role="menuitem">Demote host</a></li');
                            
    $promoteMenuItem.click(function () {
      if(forFan) socket.emit('promote fan', data.id);
      else socket.emit('demote host', data.id);
    });

    if (!data.anon) {
      $profileMenuItem = $('<li role="presentation"><a role="menuitem" href="#">Profile</a></li');
      $profileMenuItem.click(function () {
        if (data.id == user._id) {
          showProfileForMe();
        } else {
          showProfileForUser(data);
        }
      }); 
    }

    $menuDiv = $('<ul class="dropdown-menu" role="menu" aria-labelledby="dropdownMenu1"/>')
      .append($repostItem, $promoteMenuItem, data.anon ? null : $profileMenuItem);

    return $menuDiv;
  }

 // Adds the visual fan message to the message list
  function addFanMessage (data, options) {

    if (data.avatar_url) $avatarDiv = $('<img/>').attr('src', data.avatar_url);
    else $avatarDiv = $('<div/>').css('background-color', getUsernameColor(data.username));
    $avatarDiv.attr('id', 'fan-avatar');

    $usernameDiv = $('<span class="username"/>')
    .text(data.username + ' ')
    .css('color', getUsernameColor(data.username));

    var messageText = linkify(data.message, false);
    $messageBodyDiv = $('<span class="messageBody">')
      .append(messageText);

    $menuDiv = getMenuDiv(data, true);

    var $messageDiv = $('<li id="'+data.id+'" class="list-group-item message dropdown-toggle" id="dropdownMenu1" data-toggle="dropdown"/>')
      .data('username', data.username)
      .append($avatarDiv, $usernameDiv, $messageBodyDiv);

    var $parentDiv = $('<div class="dropdown"/>')
      .append($messageDiv, $menuDiv);

    addFanMessageElement($parentDiv, options);
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
    if (!options) options = {};
    if (typeof options.fade === 'undefined') options.fade = true;
    if (typeof options.prepend === 'undefined') options.prepend = false;

    // Apply options
    if (options.fade) $el.hide().fadeIn(FADE_TIME);
    
    if (options.prepend) div.prepend($el);
    else div.append($el);
    
    //DONT HARDCODE 600 maybe try to work in div.height()
    if((div[0].scrollTop+600) > div[0].scrollHeight) {
      div[0].scrollTop = div[0].scrollHeight;  
    } 
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

  function randomRoomName() {
    var nouns = ['fart','weed','420','snowboard','longboarding','blaze','pussy'];
    var descriptors = ['room'];
    var numbers = ['420','69'];
    var noun = nouns[Math.floor(Math.random() * nouns.length)];
    var descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];
    var number = numbers[Math.floor(Math.random() * numbers.length)];
    return noun+descriptor+number;
  }

  // function createFirstRoom() {   
  //    socket.emit('enter chat with id', { id : null, name : 'First Room'});
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
    if (!(event.ctrlKey || event.metaKey || event.altKey) && $(".room-name-field").length == 0) {
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

  // Whenever the server emits 'new message', update the chat body
  socket.on('update', function (data) {
    normalLog(data);
  });

  socket.on('set client username and id', function (usernameParam, idParam) {
    username = usernameParam;
    id = idParam;
    configureRightNavBar();
    $createRoomButton.show();
  });

  socket.on('set iAmHost', function (usrname, bool) {
    if(username == usrname) {
      iAmHost = bool;
    }
  });

  socket.on('set in active room', function (bool) {
    currentlyInRoom = bool;
    if(bool) {
      $chatRoom.show();  //this isn't the best long term place for this
      $fanMessages.show();
      $textGroup.show();
      $("#noRoomsImage").hide();
    } else {
      $hostLabel.text("This room is archived.");
      $membersLabel.text('');
      $fanMessages.hide();
      $textGroup.hide();
    }
  });

  // Whenever the server emits 'clear messages', update the chat body
  socket.on('clear messages', function (data) {
    clearMessages();
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new host message', function (data) {
    console.log(data);
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

  //TODO this needs to work with the browser's back and forward buttons
  //this is so that when you enter a room it says that rooms name in the browser
  socket.on('push state', function (suffix) {
    var stateObj = { ownerName : suffix };
    history.pushState(stateObj, "", suffix);
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
    successLog(data.username + ' joined chatroom '+data.chatname);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function (data) {
    dangerLog(data.username + ' left. they were in chatroom: '+data.chatname+". "+data.numUsers+" left, and "+data.numUsersInChat+" left in chatroom: "+data.chatname);
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

    // Update total members label
    var totalPeopleInRoom = room.peopleNum;
    $membersLabel.text('Members: ' + totalPeopleInRoom);

 

    // Update hosts label
    $hostLabel.html("");
    var st = "<strong>"+room.name+"</strong> by: " + room.owner.username;
    for(var i = 0; i < room.hosts.length; i++) {
      st += ', ' + room.hosts[i].username;
    }
    $hostLabel.append($('<div>'+st+'</div>'));
  });

  function get_products_of_all_ints_except_at_index(array) {
    var prevProd = 1;
    var resultsArray = [];

    for(var i = 0; i < array.length; i ++) {
      var resultForI = prevProd;
      for (var x = i+1; x < array.length; x++) {
        resultForI *= array[x];
      }
      resultsArray.push(resultForI);
      prevProd *=array[i];
    }
    return resultsArray;
  }

  // NOTIFICATIONS

  socket.on('created room', function (data) {
    normalLog('You are now the owner of this conversation! Send some messages to get started');
  });

  socket.on('fan joined room', function(username) {
    showToastNotification('info', '', username + ' joined your room!');
  });

  // socket.on('no rooms', function() {
  //   createFirstRoom();
  //   showToastNotification('info', '',"looks like you're the first one here! We've gone ahead and made you a host");
  // });

  socket.on('user was promoted', function(username) {
    showFullscreenNotification(username + ' was promoted to host!');
  });

  socket.on('user was demoted', function(username) {
    showFullscreenNotification(username + ' was demoted :(');
  });

  socket.on('message was forwarded', function(username) {
    showFullscreenNotification(username + ' forwarded your message!');
  });

  socket.on('toast notification', function(options) {
    showToastNotification(options.type, options.title, options.message);
  });

  socket.on('log notification', function(options) {
    switch (options.type) {
      case 'normal':
        normalLog(options.message);
        break;
      case 'danger':
        dangerLog(options.message);
        break;
      case 'success':
        successLog(options.message);
        break;
      default:
        normalLog(options.message);
        break;
    }
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

  // $('a').live('click', function() {
  //   window.open($(this).attr('href'));
  //   return false;
  // }); 
});



// Utilities

Date.prototype.yyyymmdd = function() {
   var yyyy = this.getFullYear().toString();
   var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
   var dd  = this.getDate().toString();
   return (mm[1]?mm:"0"+mm[0]) + '-' + (dd[1]?dd:"0"+dd[0]) + '-' + yyyy; // padding
};


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