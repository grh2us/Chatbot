/*Require statements to include dependencies*/
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var MongoClient = require('mongodb').MongoClient;
var dbConfig = require('./config/db');
var bodyParser = require('body-parser');
var Validator = require('jsonschema').Validator;

/*Global variable to store instance of mongoDB*/
var database_glb = null;

/*This variable tores JSON Schema for validation*/
var schema = null;

/*This variable indicates if msg recieved by server is valid*/
/*0 is valid, 1 is invalid*/
var valid_msg = 0;

/*Validation message that needs to be sent*/
var validation_resp = null;

/*Instance of Validator*/
var v = new Validator();

/*Map of sockets to client_info*/
var socketsMap = {};

// Global request variable
var req_glb = null;

/*Allows us to access fields of data in get/post request parameter*/
app.use(bodyParser.urlencoded({ extended: true }));

/*Root directory for static files*/
app.use(express.static('media'));

/*Connect to MongoDB*/
MongoClient.connect(dbConfig.url, function(err, database) {
    if (err){
      return console.log(err);
    } else {
      database_glb = database;
    }
});

/*Method to handle get request to login page*/
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/views/login.html');
});

/*Method to handle post request from login page, gets called after hitting submit button*/
app.post('/chat', function (req, res) {
  //console.log(req.body);
  res.sendFile(__dirname + '/views/chat.html');
  req_glb = req;
  //chatbot(database_glb,req);
});

/*Create http server on port 3000*/
http.listen(3000, function () {
  //console.log('Example app listening on port 3000!')
});

/*Listener for creation of websockets*/
io.on('connection',function(socket){
  chatbot(req_glb,socket);
})

/*Contains all the logic for chatbot*/
function chatbot(req,socket){

  // Only run if a request has been made
  if (req != null) {

    //var localSocket = socket;

    // console.log("CHATBOT FUNCTION CALLED");

    // console.log(socket.id);

    if (socketsMap[socket.id] == undefined) {

      //console.log("NEW SOCKET ADDED");

      client_info = {
        uname: req.body.uname,
        psw : req.body.psw,
        state: 0,
        isDone: 0,
        attributes: [],
        fields: []
      };

      socketsMap[socket.id] = client_info;

      //socketsMap.set(socket, client_info);
    }

    // console.log("Socket ID:" + socket.id);

    // console.log('User ' + req.body.uname + ': A new WebSocket connection has been established');

    // console.log("Size " + Object.keys(socketsMap).length);

    for(var s in socketsMap) {
      console.log("MAP: " + JSON.stringify(s) + ", " + JSON.stringify(socketsMap[s]));
    }

    for(var socketMapId in socketsMap) {
      // console.log("Map value: " + socketMapId);
      // console.log("Current socket value: " + socket);
      if(socketMapId == socket.id){
        console.log("Using socket: " + socket.id)
        socketLogic(socket);
      }
    }

  }
}

function socketLogic(socket) {

  console.log("Calling socket logic");
  console.log("SocketLogic: " + socket.id);

  client_info = socketsMap[socket.id]

  console.log("Current user: " + client_info.uname);
  console.log(client_info);
  console.log('------------------------')

  /*Listener for chat message event*/
  socket.on('chat message', function(msg){
    
    console.log(client_info);
    
    var db = database_glb.db("test-api-db");

    /*Using promise to ensure that questions are loaded from DB before iterating through them*/
    var promise = new Promise(function(resolve,reject){
      db.collection('Questions').find({}, function(err,result){
        if (err) {
          reject(err);
        } else {
          resolve(result.toArray());
        }
      });
    }).then(function(result){
      /*Validate the message*/
      if (schema != null){

        /*Returns 1 if there are any errors*/
        var err = v.validate(msg,schema).errors.length;

        /*Assign value to valid msg*/
        valid_msg = err;
      }

      /*Checking if message is valid*/
      if (valid_msg == 0){

        /*Iterating through all the questions and choosing what to ask*/
        for(var i=0; i<result.length; i++){

          /*Making sure question state asked matches current state of client*/
          if (client_info.state == result[i].state){

            /*Grab validation info from this question*/
            schema = result[i].schema;
            validation_resp = result[i].validation;
          
            /*Sending message on websocket*/
            socket.emit('chat message', result[i].question);

            /*Update client_info object*/
            client_info.state++;
            client_info.isDone = result[i].isDone;
            client_info.attributes.push(msg);
            client_info.fields.push(result[i].field);

            // Update the state of the socket.
            console.log("Updating info");
            socketsMap[socket.id] = client_info;
            console.log(client_info);
            console.log('-------------------------------');

            break;
          }
        }

      } else {
        /*Message waas invalid so send validation message back to client*/
        socket.emit('chat message', validation_resp);
      }

      /*Inserting client_info object into DB*/
      if(client_info.isDone == 1){
        var db = database_glb.db("test-api-db");
        console.log(client_info);
        db.collection('Users').insert(client_info, function(err,result){
          if(err){
            console.log(err);
          } else {
            console.log('Sucessfully inserted information into database');
            socket.disconnect(0);
          }
        });
      }

    },function(err){
        console.log(err);
    })
  });

  /*Listener for disconnect i.e. when client closes browser window*/
  // socket.on('disconnect', function(){
  //   console.log('User ' + req.body.uname + ' has disconnected');
  // });
}
