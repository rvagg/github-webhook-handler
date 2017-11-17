require('dotenv').config();

const url = require('url');

var https = require('https'),
    fs  = require('fs'),
    tmp = require('tmp');

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
        
        var isMaster = 'refs/heads/master' == event.payload.ref;
        
        //console.log(options);
        
        https.get(options, (res) => {
            
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

                    if( re.test( aFork.full_name) ){
                        
                        //console.log("Found %s", aFork.full_name);
                        
                        //this is one of 'our' forks
                        
                        //Upstream repo was push to branch :. we need to find matching downstream branch
                        if( !isMaster ) {
                            
                            options.path = url.parse(aFork.branches_url).pathname;
                            console.log(options);
                            
                            https.get(options, (res) => {
                                
                                //console.log('statusCode:', res.statusCode);
                                //console.log('headers:', res.headers);
                                var sBranchResponse = '';
                            
                                res.on('data', (d) => { sBranchResponse += d; });
                                
                                res.on('end', (d) => {
                    
                                    var oBranches = JSON.parse(sBranchResponse);
                                    
                                    console.log(oBranches);
                                });                                
                                
                            }).on('error', (e) => {
                                console.error(e);
                            });                                    
                        }
                    }
                }
                
            });
        }).on('error', (e) => {
          console.error(e);
        });    
        
        //https://gist.github.com/CristinaSolana/1885435
    }
}