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