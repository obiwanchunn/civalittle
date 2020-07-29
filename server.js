#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var multer = require('multer');
var app = express();
var upload = multer();
var mongoose = require('mongoose')

app.set('view engine', 'pug');
app.set('views', __dirname + '/views');

app.use(bodyParser.json());

var config = require('./config')

mongoose.connect(config.dburl)

var notificationSchema = mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  game: String,
  player: String,
  turn: Number
});
var Notification = mongoose.model("Notification", notificationSchema);

function sendMessage(server, content) {
  request(
      {uri: server, body: {'content': content}, json: true, method: 'POST'},
      function(error, response, body) {
        if (!error && response.statusCode == 200) {
          console.log(body);
        } else {
          console.log(response.statusCode);
          console.log(body);
        }
      });
}

function dateToUnits(date) {
  var seconds = Math.floor(date)/1000;
  var minutes = Math.floor(seconds/60);
  var hours = Math.floor(minutes/60);
  var days = Math.floor(hours/24);

  hours = hours-(days*24);
  minutes = minutes-(days*24*60)-(hours*60);
  seconds = Math.trunc(seconds-(days*24*60*60)-(hours*60*60)-(minutes*60));

  str = ""
  if (days) {
    str += days + (days == 1 ? " day " : " days ");
  }
  if (hours) {
    str += hours + (hours == 1 ? " hour " : " hours ");
  }
  if (minutes) {
    str += minutes + (minutes == 1 ? " minute " : " minutes ");
  }
  if (seconds) {
    str += seconds + (seconds == 1 ? " second " : " seconds ");
  }
  return str;
}

app.get('/', async(req, res, next) => {
  games = await Notification.find({}).distinct('game');
  currentPlayers = []
  timeSinceLastMoves = []
  console.log(games)
  for (i = 0; i < games.length; i++) {
    console.log("game " + games[i])
    data = await Notification.find({'game': games[i]}).sort({timestamp: 'desc', _id:-1});
    console.log("data " + data);

    // Time since last move
    //timeSinceLastMoves.push(dateToUnits(res[0].timestamp - res[1].timestamp))
    now = new Date()
    timeSinceLastMoves.push(dateToUnits(now.getTime() - data[0].timestamp.getTime()))
    console.log("time " + timeSinceLastMoves)

    // Current player
    currentPlayers.push(data[0].player)
    console.log("player " + currentPlayers)
  }

  res.render('main', {
    'games': games,
    'currentPlayers': currentPlayers,
    'timeSinceLastMoves': timeSinceLastMoves,
  });

  res.render('main');
});

app.post('/', upload.array(), function(req, response) {
  console.log(req.body);

  var game = req.body.value1;
  var player = req.body.value2;
  var turnNumber = req.body.value3;

  var playerId = config.playerMapping[player]
  var server = config.serverMapping[game];
  var mention = '';

  console.log(playerId);

  // Save in db
  var newNotification = new Notification({
    game: game,
    player: player,
    turn: turnNumber
  });
  newNotification.save()

  // Test rest of the code will forward notification to
  //   another webhook, e.g. Discord webhook

  if (!server) {
    server = config.defaultServer;
  }

  if (playerId) {
    mention = '<@' + playerId + '>';
  } else {
    mention = '@' + req.body.value2;
  }

  if (server) {
    var content = 'Hey ' + mention + ', it\'s time to take your turn #' +
        turnNumber + ' in \'' + game + '\'!';
    sendMessage(server, content);
    console.log('Done triggering.');
  } else {
    var content = 'Error in data, missing game \'' + req.body.value1 + '\'?';
    sendMessage(config.debugserver, content);
    console.log(content);
  }

  response.end();
});

// listen for requests
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
