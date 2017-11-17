require('dotenv').config();

var http = require('http')
var createHandler = require('./github-webhook-handler')
var handler = createHandler({ path: '/webhook', secret: process.env.SECRET_KEY })
var events = require('./events.json')

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

for( var event_name in (events||{}) ) {
  
    if( '*' != event_name && 'ping' != event_name ) {
      
      //console.log('registering handler %s', event_name);
      
      handler.on(event_name, function (event) {

        try {        
          console.log('Received a %s event for %s', event.event, (event.payload.repository||{}).name||"unknown");
          console.log(event, event.payload);

          //write to a file using utils
var fs = require('fs');

fs.writeFile('test.json', JSON.stringify({ a:1, b:2, c:3 }, null, 4));

          //construct envars from payload
          var envars = {};
          
          Object.keys(event.payload).map(function(k,v) {
            envars['GITHUB_' + k] = v;  
          });
          
          //hand over to bash
          var command = spawn('bash',['-c', __dirname + '/github-webhook.sh ' + event.event], {
                          env  : Object.assign({}, process.env, envars)
                        });
                        
          command.stdout.on('data', (data) => {
            console.log(data.toString());
          });
          
          command.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
          });
          
          command.on('close', (code) => {
            if (code !== 0) {
              console.log(`process exited with code ${code}`);
            }
          });
        } catch (e) {
          return console.error(e);
        }
      });
    }
}

//handle ping event
handler.on('ping', function (event) {

  try {        
    console.log('Received a %s event for %s', event.event, (event.payload.repository||{}).name||"unknown");
    console.log(event, event.payload);
  } catch (e) {
    return console.error(e);
  }
});

