# github-webhook-handler

Fork of https://github.com/rvagg/github-webhook-handler

[![NPM](https://nodei.co/npm/github-webhook.png?downloads=true&downloadRank=true)](https://nodei.co/npm/github-webhook/)
[![NPM](https://nodei.co/npm-dl/github-webhook.png?months=6&height=3)](https://nodei.co/npm/github-webhook/)

GitHub allows you to register **[Webhooks](https://developer.github.com/webhooks/)** for your repositories. Each time an event occurs on your repository, whether it be pushing code, filling issues or creating pull requests, the webhook address you register can be configured to be pinged with details.
Hands over processing to a bash script

## Tips

In Github Webhooks settings, Content type must be `application/json`.

`application/x-www-form-urlencoded` won't work at present.

## License

**github-webhook-handler** is Copyright (c) 2014 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licensed under the MIT License. All rights not explicitly granted in the MIT License are reserved. See the included [LICENSE.md](./LICENSE.md) file for more details.

## Testing with www.hurl.it

Ensure the app is shared via c9 

Set the following :
+ POST  `https://<this url>/webhook`
+ Headers
  - Cookie            : `c9.live.user.click-through=ok`
  - X-Hub-Signature   : `<whatever the secret key is>`
  - X-Github-Event    : `<the github event name>`
  - X-GitHub-Delivery : `1`
+ Body
```{"test":1}```
