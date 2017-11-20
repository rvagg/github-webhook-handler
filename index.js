require('dotenv').config();

var http = require('http')
var createHandler = require('./github-webhook-handler')
var handler = createHandler({ path: '/webhook', secret: process.env.SECRET_KEY })
var events = require('./events.json')
var processwebhook = require('./processwebhooks.js')

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end('no such location');
  })
}).listen(process.env.PORT || 5000);

//read events file
handler.on('error', function (err) {
  console.error('Error:', err.message)
})

//handle ping event
handler.on('ping', function (event) {

  try {        
    console.log('Received a %s event for %s', event.event, (event.payload.repository||{}).name||"unknown");
    console.log(event, event.payload);
  } catch (e) {
    return console.error(e);
  }
})

//handle ping event
handler.on('*', function (event) {

  try {        
    console.log('Received a %s event for %s', event.event, (event.payload.repository||{}).name||"unknown");
    //console.log(event, event.payload);
    
    if( processwebhook[event.event] ) {
    
      console.log('calling handler %s', event.event);
      
      processwebhook[event.event](event);
    }    
  } catch (e) {
    return console.error(e);
  }
})

