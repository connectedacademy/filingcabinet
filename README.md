# Filing Cabinet

NodeJS script which monitors beanstalk and writes incoming messages from the queue to the OrientDB.

Designed to be a single instance in a cluster which bridge the gap between multiple incoming message sources (filingcabinet-*) and OrientDB.

## Deployment

`docker-compose up -d`

## Operation

- Subscribes to Branstalk queue
- For each incoming message, writes to OrientDB
- Parses message for fields specified in the settings.json file
- Builds links to user record, and reply-to edges in DB
- If the message matches the regex submission profile in settings.json - then the submission is created, content is cached against the cache profile.
- Once these steps are completed, new message notification pushed onto Redis.

# Configuration

Configuration of how incoming messages should be parsed, linked and submissions created is stored in the settings.json configuration file in `app\settings.json`.

Example settings file:

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
            "(<script.*data-4c-meta[\\S\\s]*?<\/script>)",
            "(<img.*data-4c.*>)",
            "(<script.*src.*fourcorners\\/dist.*?<\\/script>)"
        ],
        "preview": "<img.*src\\=[\"'](.*)[\"'] .*\\/>"
    }
}
```