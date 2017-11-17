require('dotenv').config();

const url = require('url');

var https = require('https'),
    fs  = require('fs'),
    tmp = require('tmp');

module.exports = {
    push : function(event) {
        
        const GHUrl = url.parse(event.payload.repository.forks_url);        
    
        var options = {
            host     : GHUrl.hostname,
            path     : GHUrl.pathname,
            headers  : {
                'User-Agent': event.payload.repository.full_name
              }            
        };
        
        //console.log(options);
        
        https.get(options, (res) => {
            
            console.log('statusCode:', res.statusCode);
            console.log('headers:', res.headers);
        
            res.on('data', (d) => {

                //for each fork find the one that has our username init
                var oForks = JSON.parse(d);
                
                GITHUB_USERNAME
                
            });
        
        }).on('error', (e) => {
          console.error(e);
        });    
        
        //https://gist.github.com/CristinaSolana/1885435
    }
}