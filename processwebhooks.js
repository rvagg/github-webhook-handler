require('dotenv').config();
const { spawn } = require('child_process');

const url  = require('url');
const util = require('util');

var https = require('https'),
    fs  = require('fs'),
    tmp = require('tmp');

//https://help.github.com/articles/configuring-a-remote-for-a-fork/
//https://help.github.com/articles/syncing-a-fork/
//https://stackoverflow.com/questions/4410091/github-import-upstream-branch-into-fork

module.exports = {
    push : function(event) { // https://developer.github.com/v3/activity/events/types/#pushevent
        
        const GHUrl = url.parse(event.payload.repository.forks_url);        
    
        var options = {
            host     : GHUrl.hostname,
            path     : GHUrl.pathname,
            headers  : {
                'User-Agent': event.payload.repository.full_name
              }            
        };
        
        var isMaster   = 'refs/heads/master' == event.payload.ref,
            branch     = event.payload.ref.split('/').slice(-1)[0],
            autofollow = "autofollow-" + branch;
        
        //console.log(options);
        
        https.get(options, (res) => {
            
            console.log("Getting forks for %s", event.payload.repository.full_name);
            
            //console.log('statusCode:', res.statusCode);
            //console.log('headers:', res.headers);
            var sForkResponse = '';
            
            res.on('data', (d) => { sForkResponse += d; });
            
            res.on('end', (d) => {
                //console.log(sForkResponse);
                var oForks = JSON.parse(sForkResponse),
                    re     = new RegExp('^'+process.env.GITHUB_USERNAME+'\/.*$', 'i');

                //for each fork find the one that has 'our' username in it
                for( var aForkIndex in oForks ){
                  
                    var aFork = oForks[ aForkIndex ];

                    //is this is one of 'our' forks
                    if( re.test(aFork.full_name) ){
                        
                        console.log("Found downstream fork %s", aFork.full_name);
                        
                        //find auto follow branch
                        options.path = url.parse(aFork.branches_url.replace('{/branch}', '')).pathname;

                        https.get(options, (res) => {
                            
                            console.log("Retrieving branches for %s", aFork.full_name);
                            
                            //console.log('statusCode:', res.statusCode);
                            //console.log('headers:', res.headers);
                            var sBranchResponse = '';
                        
                            res.on('data', (d) => { sBranchResponse += d; });
                            
                            res.on('end', (d) => {
                
                                var oBranches = JSON.parse(sBranchResponse),
                                    found_branch = false;

                                //loop branches                              
                                for( var iBranchIndex in oBranches ) {

                                    found_branch = found_branch || oBranches[ iBranchIndex ].name == autofollow;
                                }
                                
                                console.log("Found autofollow branch %s : %s", autofollow, JSON.stringify(found_branch));
                                
                                var params = util.format("%s/%s %s %s %s %s %s", __dirname, 'github-webhook.sh', !found_branch ? "addbranch" : "syncbranch", autofollow, branch, aFork.full_name, event.payload.repository.full_name);
                                
                                console.log("spawn: bash -c '%s'", params);
                                
                                if( process.env.DRY_RUN && JSON.parse(process.env.DRY_RUN) ){
                                
                                    console.log("Dry run - exiting");
                                    return;
                                }
                                
                                //hand over to bash
                                var command = spawn('bash',['-c', params], {
                                              env  : Object.assign({}, process.env)
                                            });
                                            
                                command.stdout.on('data', (data) => {
                                    console.log(data.toString());
                                });
                                
                                command.stderr.on('data', (data) => {
                                    console.error(`stderr: ${data}`);
                                });
                                
                                command.on('close', (code) => {
                                    
                                    //if (code !== 0) {
                                    console.log(`process exited with code ${code}`);
                                    //}
                                });
                            });                                
                            
                        }).on('error', (e) => {
                            console.error('https.get', e);
                        });                                    
                    }
                }
                
            });
        }).on('error', (e) => {
          console.error(e);
        });    
        
        
    }
}