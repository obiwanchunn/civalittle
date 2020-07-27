#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var multer = require('multer');
var app = express();
var upload = multer();
app.use(express.static('views'));
app.use(bodyParser.json());

var config = require('./config')

app.post('/', upload.array(), function(req, response) {
  console.log(req.body);
  console.log(req.body.value2);
  var playerId = config.playerMapping[req.body.value2];
  var server = config.serverMapping[req.body.value1];
  var gamename = req.body.value1;
  var mention = '';

  console.log(playerId);
  var turnNumber = req.body.value3;

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
        turnNumber + ' in \'' + gamename + '\'!';
    sendMessage(server, content);
    console.log('Done triggering.');
  } else {
    var content = 'Error in data, missing game \'' + req.body.value1 + '\'?';
    sendMessage(config.debugserver, content);
    console.log(content);
  }

  response.end();
});

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

// listen for requests :)
var listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
});
