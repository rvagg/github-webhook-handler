# github-webhook-handler

Fork of https://github.com/rvagg/github-webhook-handler.

Extended to create auto follow branches up upstream repos.
E.g. if commit is pushed to repo branch: repo_with_webhook/dev_branch then
if one of your repos is a fork then the push will be automatically synced to your-forked-repo/autofollow_dev_branch

[![NPM](https://nodei.co/npm/github-webhook.png?downloads=true&downloadRank=true)](https://nodei.co/npm/github-webhook/)
[![NPM](https://nodei.co/npm-dl/github-webhook.png?months=6&height=3)](https://nodei.co/npm/github-webhook/)

GitHub allows you to register **[Webhooks](https://developer.github.com/webhooks/)** for your repositories. Each time an event occurs on your repository, whether it be pushing code, filling issues or creating pull requests, the webhook address you register can be configured to be pinged with details.

## Tips

In Github Webhooks settings, Content type must be `application/json`.

`application/x-www-form-urlencoded` won't work at present.

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