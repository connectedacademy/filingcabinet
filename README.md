# Social Media Processing Service (filingcabinet)

Applicationwhich monitors beanstalk and writes incoming messages from the queue to the OrientDB.

Designed to be a single instance in a cluster which bridge the gap between multiple incoming message sources (`filingcabinet-*`) and `OrientDB|Redis`.

> This application is horizontally scalable

## Operation

- Subscribes to Beanstalk queue for incoming messages from a producer (i.e. filingcabinet-twitter)
- For each incoming message, writes to OrientDB
- Parses message for fields specified in the settings.json file
- Builds links to user record, and reply-to edges in DB
- If the message matches the regex submission profile in settings.json - then the submission is created, content is cached against the cache profile.
- Once these steps are completed, new message notification pushed onto Redis to notify any subscribers.

# Configuration

Configuration of how incoming messages should be parsed, linked and submissions created is stored in the settings.json configuration file in `app\settings.json`.

Example settings file (for Connected Academy use):

```json
{
    "relationships": {
        "tokens": [
            {
                "name": "course",
                "regex": "https:\/\/(.*\\.connectedacademy\\.io)\\.*",
                "compositeindex":true
            },
            {
                "name": "class",
                "regex": "https:\/\/.*\\.connectedacademy\\.io\/#\/course\/(.*)\/.*\/.*$",
                "compositeindex":true
            },
            {
                "name": "content",
                "regex": "https:\/\/.*\\.connectedacademy\\.io\/#\/course\/.*\/(.*)\/.*$",
                "compositeindex":true
            },
            {
                "name": "segment",
                "regex": "https:\/\/.*\\.connectedacademy\\.io\/#\/course\/.*\/.*\/(.*)$",
                "compositeindex":true
            },
            {
                "name": "tag",
                "regex": "https:\/\/.*\\.connectedacademy\\.io\/#\/course\/(.*\/\\D*)$"
            }
        ]
    },
    "cache": {
        "validate": "https:\/\/.*\\.connectedacademy\\.io\/#\/submission\/(.*\/\\D*)$",
        "tokens": [
            {
                "name": "course",
                "regex": "https:\/\/(.*\\.connectedacademy\\.io)\\.*"
            },
            {
                "name": "class",
                "regex": "https:\/\/.*\\.connectedacademy\\.io\/#\/submission\/(.*)\/.*"
            },
             {
                "name": "content",
                "regex": "https:\/\/.*\\.connectedacademy\\.io\/#\/submission\/.*\/(.*)"
            }
        ],
        "capture": [
            "(<script.*src.*\/dist\/4c\\.js.*?<\/script>)",
            "(<script.*?data-4c-meta[\\S\\s]*?<\/script>)",
            "(<img.*?data-4c.*?>)"
        ],
        "preview": "<img.*src\\=[\"'](.*?)[\"'] .*\\/>"
    }
}
```

----
This project is part of the [Connected Academy](https://connectedacademy.io) online learning platform developed by [Open Lab](https://openlab.ncl.ac.uk) @ Newcastle University