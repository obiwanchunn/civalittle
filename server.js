#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var multer = require('multer');
var app = express();
var upload = multer();
var mongoose = require('mongoose')

var debug = false;

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

async function dbGameAnalysis(game) {
  res = {}
  games = await Notification.find({'game': game}).distinct('game');
  if (debug) console.log(game + " " + games);
  if (games.length != 1) {
    return res;
  }

  turns = await Notification.find({'game': game}).sort({timestamp: 'desc', _id:-1});
  if (debug) console.log(turns);

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
    if (debug) console.log("player " + turn['player'] + " addtime " + addTime);
    turnTime[turn['player']]['totalTime'] += addTime;
    turnTime[turn['player']]['numTurns'] += 1;
    turnTime[turn['player']]['avgTimePerTurn'] = Math.round(turnTime[turn['player']]['totalTime'] / turnTime[turn['player']]['numTurns']);
    turnTime[turn['player']]['avgTimePerTurnString'] = dateToUnits(turnTime[turn['player']]['avgTimePerTurn']);
    if (debug) console.log(turnTime);
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

  res['game'] = game;
  res['players'] = players.sort((a,b) => turnTime[b]['avgTimePerTurn'] - turnTime[a]['avgTimePerTurn']);
  res['turnTime'] = turnTime;
  res['currentRound'] = currentRound;
  res['currentPlayer'] = currentPlayer;
  res['timeSinceLastTurn'] = timeSinceLastTurn;
  res['maxRound'] = maxRound;
  res['averageTimePerRound'] = dateToUnits(averageTimePerRound);
  res['maxEstimatedTimeLeft'] = dateToUnits(maxEstimatedTimeLeft);
  res['maxEstimatedDateComplete'] = maxEstimatedDateComplete.toLocaleString("en-US", {timeZone: "America/Chicago"});

  return res;
}

function genMessage(mention, game, turnNumber, playerSlowest) {
  messageFormats = [
    "Hey {0}, it's time to take turn #{2} in {1}!",
  ];

  // Override default messageFormats with user specified ones if specified
  if (config.messageFormats)
    messageFormats = config.messageFormats;

  randomIdx = Math.floor(Math.random() * messageFormats.length);
  return messageFormats[randomIdx].formatUnicorn('**' + mention + '**', '**' + game + '**', '**' + turnNumber + '**', '**' + playerSlowest + '**');
}

app.get('/', async(req, res, next) => {
  games = await Notification.find({}).distinct('game');
  currentPlayers = []
  timeSinceLastMoves = []
  if (debug) console.log(games)
  for (i = 0; i < games.length; i++) {
    if (debug) console.log("game " + games[i])
    data = await Notification.find({'game': games[i]}).sort({timestamp: 'desc', _id:-1});
    if (debug) console.log("data " + data);

    // Time since last move
    now = new Date();
    timeSinceLastMoves.push(dateToUnits(now.getTime() - data[0].timestamp.getTime()));
    if (debug) console.log("time " + timeSinceLastMoves);

    // Current player
    currentPlayers.push(data[0].player);
    if (debug) console.log("player " + currentPlayers);
  }

  res.render('main', {
    'games': games,
    'currentPlayers': currentPlayers,
    'timeSinceLastMoves': timeSinceLastMoves,
  });
});

app.get('/games/:game', async(req, res, next) => {
  game = req.params.game;

  analysis = await dbGameAnalysis(game);
  if (!analysis['game']) {
    res.status(500).send('Mismatch');
    return;
  }

 res.render('game', {
    'game': analysis['game'],
    'players': analysis['players'],
    'turnTime': analysis['turnTime'],
    'currentRound': analysis['currentRound'],
    'currentPlayer': analysis['currentPlayer'],
    'timeSinceLastTurn': analysis['timeSinceLastTurn'],
    'maxRound': analysis['maxRound'],
    'averageTimePerRound': analysis['averageTimePerRound'],
    'maxEstimatedTimeLeft': analysis['maxEstimatedTimeLeft'],
    'maxEstimatedDateComplete': analysis['maxEstimatedDateComplete'],
  });
});

app.post('/', upload.array(), async(req, response) => {
  // We got the message. No need for Ack'ing Civ client after doing work.
  response.end();

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

  // Flavor for notifications: find slowest person
  analysis = await dbGameAnalysis(game);
  playerSlowest = analysis['players'][0];
  playerSlowestId = config.playerMapping[playerSlowest];
  if (playerSlowest == player) {
    playerSlowest = "you";
  } else if (playerSlowestId) { // Mention the slowest player as well. (Penalty? Or should I take this out? :) )
    playerSlowest = '<@' + playerSlowestId + '>';
  }


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
    content = genMessage(mention, game, turnNumber, playerSlowest);
    sendMessage(server, content);
    console.log('Done triggering.');
  } else {
    var content = 'Error in data, missing game \'' + req.body.value1 + '\'?';
    sendMessage(config.debugserver, content);
    console.log(content);
  }

});

// listen for requests
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
