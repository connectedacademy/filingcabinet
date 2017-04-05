# Filing Cabinet

NodeJS script which monitors redis and writes incoming messages from the PUBSUB to the OrientDB.

Designed to be a single instance in a cluster which bridge the gap between multiple incoming message sources (filingcabinet-*) and OrientDB.

## Deployment

`docker-compose up -d`

## Operation

- Subscribes to Redis queue
- For each incoming message, writes to OrientDB