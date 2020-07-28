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

app.get('/', async(req, res, next) => {
  games = await Notification.find({}).distinct('game');
  docs = []
  console.log(games)
  for (i = 0; i < games.length; i++) {
    console.log("game " + games[i])
    doc = await Notification.findOne({'game': games[i]}).sort({ field: 'asc', _id:-1}).limit(1);
    console.log("doc " + doc);
    docs.push(doc)
  }

  console.log(docs);
  res.render('main', {
    'docs': docs,
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
