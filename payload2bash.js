const { spawn } = require('child_process');
var fs  = require('fs'),
    tmp = require('tmp');

module.exports = function(event) {
    
    var tmp_name = tmp.tmpNameSync() + ".json";
    console.log(tmp_name);
    fs.writeFile(tmp_name, JSON.stringify(event, null, 4));

    //hand over to bash
    var command = spawn('bash',['-c', __dirname + '/github-webhook.sh ' + event.event], {
                  env  : Object.assign({}, process.env, {GITHUB_PAYLOAD : tmp_name})
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
        
        //remove temp file
        fs.unlinkSync(tmp_name);
    });
}