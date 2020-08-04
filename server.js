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

// From: https://stackoverflow.com/a/18234317/4914560
String.prototype.formatUnicorn = String.prototype.formatUnicorn ||
function () {
    "use strict";
    var str = this.toString();
    if (arguments.length) {
        var t = typeof arguments[0];
        var key;
        var args = ("string" === t || "number" === t) ?
            Array.prototype.slice.call(arguments)
            : arguments[0];

        for (key in args) {
            str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
        }
    }

    return str;
};

function genMessage(mention, game, turnNumber) {
  messageFormats = [
    "Hey {0}, it's time to take turn #{2} in {1}!",
    "{0} It's turn #{2} in {1} and you're up!",
    "{0} everybody's waiting on you to take turn #{2} in {1}.",
    "{0}: Turn #{2} in {1}.",
    "{0}, your mission, should you choose to accept it: Take turn #{2} in {1}.",
    "One more turn, {0}? It's turn #{2} in {1}.",
    "You haven't lost in {1} yet, {0}?  It's turn #{2}.",
    "Game: {1}. Turn: {2}. Player: {0}.",
    "No time to waste, {0}. Turn #{2} now in {1}!",
    "Et tu, {0}? Caeser awaits betrayal in {1}, turn #{2}.",
    "Mars won't colonize itself in {1}, {0}, It's turn #{2}, so get to it!",
    "Turn #{2} in {1} awaits your steady hand, {0}.",
    "Don't be a Chunn and wait forever, {0}. Take turn #{2} in {1}, quickly!",
    "Sunshine on my shoulder makes me happy when {0} takes turn #{2} in {1}.",
    "Bad news: must social distance. Good news: {0}, it's turn #{2} in {1}.",
    "Knock knock, {0}. Who's there you ask? It's turn #{2} in {1}. Open the door.",
  ];

  randomIdx = Math.floor(Math.random() * messageFormats.length);
  return messageFormats[randomIdx].formatUnicorn('**' + mention + '**', '**' + game + '**', '**' + turnNumber + '**');
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
    now = new Date();
    timeSinceLastMoves.push(dateToUnits(now.getTime() - data[0].timestamp.getTime()));
    console.log("time " + timeSinceLastMoves);

    // Current player
    currentPlayers.push(data[0].player);
    console.log("player " + currentPlayers);
  }

  res.render('main', {
    'games': games,
    'currentPlayers': currentPlayers,
    'timeSinceLastMoves': timeSinceLastMoves,
  });
});

app.get('/games/:game', async(req, res, next) => {
  game = req.params.game;
  games = await Notification.find({'game': game}).distinct('game');
  console.log(game + " " + games);
  if (games.length != 1) {
    res.status(500).send('Mismatch');
    return;
  }

  turns = await Notification.find({'game': game}).sort({timestamp: 'desc', _id:-1});
  console.log(turns);
  turnTime = {};
  players = [];
  for (idx in turns) {
    turn = turns[idx];
    if (!turnTime[turn['player']]) {
      players.push(turn['player']);
      turnTime[turn['player']] = {}
      turnTime[turn['player']]['totalTime'] = 0;
      turnTime[turn['player']]['numTurns'] = 0;
    }
    if (idx == 0) {
      addTime = (new Date()).getTime() - turn['timestamp'];
    } else {
      addTime = turns[idx - 1]['timestamp'] - turn['timestamp'];
    }
    console.log("player " + turn['player'] + " addtime " + addTime);
    turnTime[turn['player']]['totalTime'] += addTime;
    turnTime[turn['player']]['numTurns'] += 1;
    turnTime[turn['player']]['avgTimePerTurn'] = Math.round(turnTime[turn['player']]['totalTime'] / turnTime[turn['player']]['numTurns']);
    turnTime[turn['player']]['avgTimePerTurnString'] = dateToUnits(turnTime[turn['player']]['avgTimePerTurn']);    console.log(turnTime);
  }

  maxRound = 250; // Online games default to 250. TODO: support other max turn settings
  currentRound = turns[0]['turn'];
  currentPlayer = turns[0]['player'];
  timeSinceLastTurn = dateToUnits((new Date()).getTime() - turns[0]['timestamp']);
  firstRound = turns[turns.length-1]['turn'];
  firstRoundTimestamp = turns[turns.length-1]['timestamp'];
  numTurnsPerRound = players.length;
  currentTime = (new Date()).getTime();
  totalGameTime = currentTime - firstRoundTimestamp;
  RoundsPlayed = currentRound - firstRound;
  averageTimePerRound = RoundsPlayed ? totalGameTime / RoundsPlayed : 0;
  maxEstimatedTimeLeft = averageTimePerRound * (maxRound - currentRound + 1); // don't current Current round as done
  maxEstimatedDateComplete = new Date(maxEstimatedTimeLeft + currentTime);

 res.render('game', {
    'game': game,
    'players': players.sort((a,b) => turnTime[b]['avgTimePerTurn'] - turnTime[a]['avgTimePerTurn']),
    'turnTime': turnTime,
    'currentRound': currentRound,
    'currentPlayer': currentPlayer,
    'timeSinceLastTurn': timeSinceLastTurn,
    'maxRound': maxRound,
    'averageTimePerRound': dateToUnits(averageTimePerRound),
    'maxEstimatedTimeLeft': dateToUnits(maxEstimatedTimeLeft),
    'maxEstimatedDateComplete': maxEstimatedDateComplete.toLocaleString("en-US", {timeZone: "America/Chicago"}),
  });

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

  // The rest of the code will forward notification to
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
    content = genMessage(mention, game, turnNumber);
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
