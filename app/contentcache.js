//S3 storage

class ContentCache
{

    constructor(database, logger)
    {
        this.database = database;
        this.logger = logger;
    }

    async HandleMessage(message)
    {
        //if message matches profile, then 
        logger.verbose('Checking message against profile',message.id);

    }
}

module.exports = ContentCache;