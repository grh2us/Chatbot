var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var MongoClient = require('mongodb').MongoClient;
var dbConfig = require('./config/db');
var bodyParser = require('body-parser');

var database_glb = null;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('media'));

MongoClient.connect(dbConfig.url, function(err, database) {

    if (err){
      return console.log(err);
    } else {
      database_glb = database;
    }

});

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/views/login.html');
});

app.post('/chat', function (req, res) {
  console.log(req.body);
  res.sendFile(__dirname + '/views/chat.html');
  const user_info = {username: req.body.uname,
                     password: req.body.psw, 
                     nameDB: '', 
                     ageDB: '', 
                     birth_placeDB : '',
                     state: 0};
  db = database_glb.db("test-api-db");
  db.collection('users').insert(user_info, function(err,result){
        if(err){
          console.log(err);
        } else {
          console.log(result);
        }
    });

  chatbot(database_glb,req)
});

http.listen(3000, function () {
  console.log('Example app listening on port 3000!')
});

function chatbot(database, req){
io.on('connection', function(socket){
  console.log('A new WebSocket connection has been established');
  
  socket.on('chat message', function(msg){

    console.log('message: ' + msg);
    console.log(req.body);
    const details = {username: req.body.uname};
    var stateServ = -1;

    db = database.db("test-api-db");
    db.collection('users').findOne(details, function(err,results){
      if(err){
        console.log(err);
      } else{
        console.log(results.state);
        stateServ = results.state;

        if(stateServ == 0){
          socket.emit('chat message', 'What is your name?');
          stateServ++;
          const query = {username: req.body.uname};
          const updateValue = {$set: {state: stateServ}}
          db = database.db("test-api-db");
          db.collection('users').updateOne(query, updateValue, function(err,results){
            if(err){
              console.log(err);
            } else{
              console.log('Updated at state 0');
            }
          });

        } else if (stateServ == 1){
          var name = msg;
          socket.emit('chat message', 'What is your age?');
          stateServ++;
          const query = {username: req.body.uname};
          const updateValue = {$set: {nameDB: name, state: stateServ}}
          db = database.db("test-api-db");
          db.collection('users').updateOne(query, updateValue, function(err,results){
            if(err){
              console.log(err);
            } else{
              console.log('Updated at state 1');
            }
          });

        } else if (stateServ == 2){
          var age = msg;
          socket.emit('chat message', 'Where were you born?');
          stateServ++;
          const query = {username: req.body.uname};
          const updateValue = {$set: {ageDB: age, state: stateServ}}
          db = database.db("test-api-db");
          db.collection('users').updateOne(query, updateValue, function(err,results){
            if(err){
              console.log(err);
            } else{
              console.log('Updated at state 2');
            }
          });

        } else if (stateServ == 3){
          var birth_place = msg;
          socket.emit('chat message', 'Thank you that is all the information I need');
          const query = {username: req.body.uname};
          const updateValue = {$set: {birth_placeDB: birth_place, state: 0}}
          db = database.db("test-api-db");
          db.collection('users').updateOne(query, updateValue, function(err,result){
            if(err){
              console.log(err);
            } else {
              console.log('Updated at state 3');
            }
          });

        }
      }
    });
    
  });


  socket.on('disconnect', function(){
    console.log('A client has disconnected');
    state = 0;
  });

});

}
